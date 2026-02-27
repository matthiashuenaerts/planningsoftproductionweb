import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({ automated: true }));
    const { automated = true } = body;

    console.log(`Starting ${automated ? 'automated' : 'manual'} orders sync...`);

    // Determine configs to use — support multi-tenant
    let configsToProcess: Array<{ tenantId: string; baseUrl: string; username: string; password: string }> = [];

    if (body.baseUrl && body.username && body.password) {
      // Manual call with explicit credentials (legacy)
      configsToProcess.push({ tenantId: '', baseUrl: body.baseUrl, username: body.username, password: body.password });
    } else {
      // Load ALL tenant configs for 'orders' API type
      console.log('Loading ALL tenant orders API configs from database...');
      const { data: allConfigs, error: configError } = await supabase
        .from('external_api_configs')
        .select('*')
        .eq('api_type', 'orders');

      if (configError || !allConfigs || allConfigs.length === 0) {
        console.error('No orders API configs found:', configError);
        throw new Error('Orders API configuration not found. Please save the configuration in Settings first.');
      }

      console.log(`Found ${allConfigs.length} tenant orders API configs`);
      for (const cfg of allConfigs) {
        configsToProcess.push({
          tenantId: cfg.tenant_id,
          baseUrl: cfg.base_url,
          username: cfg.username,
          password: cfg.password
        });
      }
    }

    let totalSyncedCount = 0;
    let totalErrorCount = 0;
    let totalProjectsProcessed = 0;
    const allDetails: any[] = [];
    const allErrors: string[] = [];

    for (const tenantConfig of configsToProcess) {
      const { tenantId, baseUrl, username, password } = tenantConfig;
      console.log(`Processing orders for tenant ${tenantId || 'all'} with baseUrl: ${baseUrl}`);

      // Get projects for this tenant
      let query = supabase
        .from('projects')
        .select('id, name, project_link_id')
        .not('project_link_id', 'is', null);

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data: projects, error: projectsError } = await query;

      if (projectsError) {
        console.error(`Failed to fetch projects for tenant ${tenantId}:`, projectsError.message);
        allErrors.push(`Tenant ${tenantId}: ${projectsError.message}`);
        totalErrorCount++;
        continue;
      }

      console.log(`Found ${projects?.length || 0} projects for tenant ${tenantId || 'all'}`);
      totalProjectsProcessed += projects?.length || 0;

      for (const project of projects || []) {
        try {
          console.log(`Syncing orders for project ${project.name} (${project.project_link_id})`);

          // Authenticate directly with external API (no proxy needed)
          const authResponse = await fetch(`${baseUrl}/sessions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${btoa(`${username}:${password}`)}`
            }
          });

          if (!authResponse.ok) {
            const errText = await authResponse.text();
            throw new Error(`API authentication failed (${authResponse.status}): ${errText}`);
          }

          const authData = await authResponse.json();
          const token = authData?.response?.token;
          if (!token) throw new Error('No token received from Orders API');

          // Query orders for this project directly
          const layout = encodeURIComponent('API_order');
          const scriptName = encodeURIComponent('FindSupplierOrderByOrderNumber');
          const param = encodeURIComponent(String(project.project_link_id));
          const queryUrl = `${baseUrl}/layouts/${layout}/script/${scriptName}?script.param=${param}`;

          const queryResponse = await fetch(queryUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });

          // Logout token after query
          try {
            await fetch(`${baseUrl}/sessions/${token}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
          } catch (_) {}

          if (!queryResponse.ok) {
            const errText = await queryResponse.text();
            throw new Error(`Orders query failed (${queryResponse.status}): ${errText}`);
          }

          const rawQueryData = await queryResponse.json();

          // Parse scriptResult if present
          let queryData = rawQueryData;
          try {
            const scriptResult = rawQueryData?.response?.scriptResult;
            if (scriptResult) {
              queryData = JSON.parse(scriptResult);
              console.log('Parsed scriptResult successfully');
            }
          } catch (_) {
            console.warn('Failed to parse scriptResult, using raw response');
          }

          if (!queryData || !queryData.bestellingen) {
            allDetails.push({
              project_name: project.name,
              project_link_id: project.project_link_id,
              tenant_id: tenantId,
              status: 'no_orders',
              orders_found: 0
            });
            continue;
          }

          const externalOrders = queryData.bestellingen;
          console.log(`Found ${externalOrders.length} orders for project ${project.name}`);

          let ordersUpdated = 0;
          let ordersAdded = 0;

          for (const externalOrder of externalOrders) {
            const rawOrderNumber = externalOrder.ordernummer ?? externalOrder.bestelnummer ?? externalOrder.ordernr ?? externalOrder.orderNumber ?? externalOrder.bestellingsnummer ?? null;
            const orderNumber = typeof rawOrderNumber === 'string' ? rawOrderNumber.trim() : (rawOrderNumber != null ? String(rawOrderNumber) : null);

            if (!orderNumber) {
              console.warn(`Skipping order without order number for project ${project.name}`);
              continue;
            }

            const { data: existingOrder } = await supabase
              .from('orders')
              .select('*')
              .eq('external_order_number', orderNumber)
              .eq('project_id', project.id)
              .maybeSingle();

            const deliveryDate = convertWeekNumberToDate(externalOrder.leverweek);

            let orderStatus = 'pending';
            const isDelivered = externalOrder.isVolledigOntvangen;
            const isShipped = externalOrder.isVerzonden;

            if (isDelivered) {
              orderStatus = 'delivered';
            } else if (isShipped && (!existingOrder || existingOrder.status !== 'delivered')) {
              orderStatus = 'pending';
            } else if (existingOrder) {
              orderStatus = existingOrder.status === 'delivered' ? 'delivered' : 'pending';
            }

            const orderData = {
              project_id: project.id,
              external_order_number: orderNumber,
              supplier: externalOrder.leverancier || 'Unknown',
              order_date: new Date().toISOString(),
              expected_delivery: deliveryDate,
              status: orderStatus,
              order_type: 'standard',
              notes: externalOrder.referentie || null,
              source: 'external database'
            };

            if (existingOrder) {
              const hasChanges =
                existingOrder.expected_delivery !== deliveryDate ||
                existingOrder.status !== orderData.status ||
                existingOrder.supplier !== orderData.supplier ||
                existingOrder.notes !== orderData.notes;

              if (hasChanges) {
                const { error: updateError } = await supabase
                  .from('orders')
                  .update({
                    expected_delivery: deliveryDate,
                    status: orderData.status,
                    supplier: orderData.supplier,
                    notes: orderData.notes,
                    source: 'external database',
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', existingOrder.id);

                if (updateError) {
                  allErrors.push(`Failed to update order ${orderNumber}: ${updateError.message}`);
                } else {
                  ordersUpdated++;
                }
              }
            } else {
              const { data: newOrder, error: insertError } = await supabase
                .from('orders')
                .insert(orderData)
                .select()
                .single();

              if (insertError) {
                allErrors.push(`Failed to create order ${orderNumber}: ${insertError.message}`);
              } else {
                ordersAdded++;
                if (externalOrder.artikelen && Array.isArray(externalOrder.artikelen)) {
                  const itemsToInsert = externalOrder.artikelen.map((artikel: any) => ({
                    order_id: newOrder.id,
                    description: artikel.omschrijving || 'No description',
                    quantity: parseInt(artikel.aantal) || 1,
                    article_code: artikel.artikel || null,
                    ean: artikel.ean || null,
                    delivered_quantity: orderData.status === 'delivered' ? (parseInt(artikel.aantal) || 1) : 0,
                    notes: artikel.categorie ? `Category: ${artikel.categorie}` : null
                  }));

                  const { error: itemsError } = await supabase
                    .from('order_items')
                    .insert(itemsToInsert);

                  if (itemsError) {
                    allErrors.push(`Failed to add items for order ${orderNumber}: ${itemsError.message}`);
                  }
                }
              }
            }
          }

          allDetails.push({
            project_name: project.name,
            project_link_id: project.project_link_id,
            tenant_id: tenantId,
            status: 'synced',
            orders_found: externalOrders.length,
            orders_updated: ordersUpdated,
            orders_added: ordersAdded
          });

          if (ordersUpdated > 0 || ordersAdded > 0) {
            totalSyncedCount++;
          }

        } catch (error: any) {
          console.error(`Error syncing project ${project.name}:`, error);
          totalErrorCount++;
          allErrors.push(`Project ${project.name}: ${error.message}`);
          allDetails.push({
            project_name: project.name,
            project_link_id: project.project_link_id,
            tenant_id: tenantId,
            status: 'error',
            message: error.message
          });
        }
      }
    }

    const syncResult = {
      success: totalErrorCount === 0,
      message: `${automated ? 'Automated' : 'Manual'} orders sync completed: ${totalSyncedCount} projects with changes, ${totalErrorCount} errors`,
      syncedCount: totalSyncedCount,
      errorCount: totalErrorCount,
      totalProjects: totalProjectsProcessed,
      tenantsProcessed: configsToProcess.length,
      automated,
      details: allDetails,
      errors: allErrors,
      timestamp: new Date().toISOString()
    };

    // Log sync results
    try {
      await supabase.from('orders_sync_logs').insert({
        synced_count: totalSyncedCount,
        error_count: totalErrorCount,
        details: syncResult
      });
    } catch (logErr) {
      console.error('Failed to log sync results:', logErr);
    }

    console.log('Orders sync process completed:', syncResult);

    return new Response(JSON.stringify(syncResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in orders sync function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function convertWeekNumberToDate(weekString: string): string {
  if (!weekString) return new Date().toISOString();
  if (weekString.length === 6 && /^\d{6}$/.test(weekString)) {
    const year = parseInt(weekString.substring(0, 4));
    const week = parseInt(weekString.substring(4, 6));
    const jan1 = new Date(year, 0, 1);
    const daysToAdd = (week - 1) * 7;
    const resultDate = new Date(jan1.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    const dayOfWeek = resultDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    resultDate.setDate(resultDate.getDate() + mondayOffset);
    return resultDate.toISOString();
  }
  try { return new Date(weekString).toISOString(); } catch { return new Date().toISOString(); }
}
