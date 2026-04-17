import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const WALL_CLOCK_LIMIT_MS = 120_000;

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Authenticate the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const token = authHeader.replace('Bearer ', '');
    if (token === supabaseAnonKey) {
      console.log('Authenticated via anon key (cron job)');
    } else {
      const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: userError } = await authSupabase.auth.getClaims(token);
      const userId = claimsData?.claims?.sub;
      if (userError || !userId) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log('Authenticated via user JWT:', userId);
    }

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { automated = true, tenant_id: requestedTenantId = null } = body;

    console.log(`Starting ${automated ? 'automated' : 'manual'} orders sync${requestedTenantId ? ` for tenant ${requestedTenantId}` : ''}...`);

    // Load tenant config(s) — single tenant if tenant_id provided, else all
    let configQuery = supabase
      .from('external_api_configs')
      .select('*')
      .eq('api_type', 'orders');

    if (requestedTenantId) {
      configQuery = configQuery.eq('tenant_id', requestedTenantId);
    }

    const { data: allConfigs, error: configError } = await configQuery;

    if (configError || !allConfigs || allConfigs.length === 0) {
      const msg = requestedTenantId
        ? `No Orders API config found for tenant ${requestedTenantId}.`
        : 'Orders API configuration not found.';
      throw new Error(msg);
    }

    console.log(`Processing ${allConfigs.length} tenant config(s)`);

    let totalSyncedCount = 0;
    let totalErrorCount = 0;
    let totalProjectsProcessed = 0;
    let totalSkipped = 0;
    const allDetails: any[] = [];
    const allErrors: string[] = [];
    let timedOut = false;

    for (const cfg of allConfigs) {
      if (timedOut) break;

      const tenantId = cfg.tenant_id;
      const baseUrl = cfg.base_url;
      console.log(`Processing orders for tenant ${tenantId} with baseUrl: ${baseUrl}`);

      let query = supabase
        .from('projects')
        .select('id, name, project_link_id')
        .not('project_link_id', 'is', null);

      if (tenantId) query = query.eq('tenant_id', tenantId);

      const { data: projects, error: projectsError } = await query;

      if (projectsError) {
        allErrors.push(`Tenant ${tenantId}: ${projectsError.message}`);
        totalErrorCount++;
        continue;
      }

      console.log(`Found ${projects?.length || 0} projects for tenant ${tenantId}`);
      totalProjectsProcessed += projects?.length || 0;

      if (!projects || projects.length === 0) continue;

      // Authenticate ONCE per tenant
      let apiToken: string | null = null;
      try {
        const authResponse = await fetch(`${baseUrl}/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${btoa(`${cfg.username}:${cfg.password}`)}`
          }
        });

        if (!authResponse.ok) {
          const errText = await authResponse.text();
          throw new Error(`API auth failed (${authResponse.status}): ${errText}`);
        }

        const authData = await authResponse.json();
        apiToken = authData?.response?.token;
        if (!apiToken) throw new Error('No token received from Orders API');
        console.log(`Authenticated with orders API for tenant ${tenantId}`);
      } catch (authErr: any) {
        console.error(`Orders API auth failed for tenant ${tenantId}:`, authErr.message);
        allErrors.push(`Tenant ${tenantId} auth: ${authErr.message}`);
        totalErrorCount++;
        continue;
      }

      try {
        for (const project of projects) {
          if (Date.now() - startTime > WALL_CLOCK_LIMIT_MS) {
            console.warn(`⏱️ Wall-clock limit reached after ${Math.round((Date.now() - startTime) / 1000)}s — stopping gracefully`);
            timedOut = true;
            totalSkipped += projects.length - projects.indexOf(project);
            break;
          }

          try {
            console.log(`Syncing orders for project ${project.name} (${project.project_link_id})`);

            const layout = encodeURIComponent('API_order');
            const scriptName = encodeURIComponent('FindSupplierOrderByOrderNumber');
            const param = encodeURIComponent(String(project.project_link_id));
            const queryUrl = `${baseUrl}/layouts/${layout}/script/${scriptName}?script.param=${param}`;

            const queryResponse = await fetch(queryUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              }
            });

            if (!queryResponse.ok) {
              const errText = await queryResponse.text();
              throw new Error(`Orders query failed (${queryResponse.status}): ${errText}`);
            }

            const rawQueryData = await queryResponse.json();

            let queryData = rawQueryData;
            try {
              const scriptResult = rawQueryData?.response?.scriptResult;
              if (scriptResult) {
                queryData = JSON.parse(scriptResult);
              }
            } catch (_) {
              console.warn('Failed to parse scriptResult, using raw response');
            }

            if (!queryData || !queryData.bestellingen) {
              allDetails.push({
                project_name: project.name, project_link_id: project.project_link_id,
                tenant_id: tenantId, status: 'no_orders', orders_found: 0
              });
              continue;
            }

            const externalOrders = queryData.bestellingen;
            let ordersUpdated = 0;
            let ordersAdded = 0;

            for (const externalOrder of externalOrders) {
              const rawOrderNumber = externalOrder.ordernummer ?? externalOrder.bestelnummer ?? externalOrder.ordernr ?? externalOrder.orderNumber ?? externalOrder.bestellingsnummer ?? null;
              const orderNumber = typeof rawOrderNumber === 'string' ? rawOrderNumber.trim() : (rawOrderNumber != null ? String(rawOrderNumber) : null);

              if (!orderNumber) continue;

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
                  existingOrder.supplier !== orderData.supplier;

                if (hasChanges) {
                  const updatePayload: Record<string, any> = {
                    expected_delivery: deliveryDate,
                    status: orderData.status,
                    supplier: orderData.supplier,
                    source: 'external database',
                    updated_at: new Date().toISOString()
                  };

                  if (!existingOrder.notes || existingOrder.notes === orderData.notes) {
                    updatePayload.notes = orderData.notes;
                  }

                  const { error: updateError } = await supabase.from('orders').update(updatePayload).eq('id', existingOrder.id);
                  if (updateError) {
                    allErrors.push(`Failed to update order ${orderNumber}: ${updateError.message}`);
                  } else {
                    ordersUpdated++;
                  }
                }
              } else {
                const { data: newOrder, error: insertError } = await supabase.from('orders').insert(orderData).select().single();

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

                    const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
                    if (itemsError) allErrors.push(`Failed to add items for order ${orderNumber}: ${itemsError.message}`);
                  }
                }
              }
            }

            allDetails.push({
              project_name: project.name, project_link_id: project.project_link_id,
              tenant_id: tenantId, status: 'synced',
              orders_found: externalOrders.length, orders_updated: ordersUpdated, orders_added: ordersAdded
            });

            if (ordersUpdated > 0 || ordersAdded > 0) totalSyncedCount++;

          } catch (error: any) {
            console.error(`Error syncing project ${project.name}:`, error);
            totalErrorCount++;
            allErrors.push(`Project ${project.name}: ${error.message}`);
            allDetails.push({
              project_name: project.name, project_link_id: project.project_link_id,
              tenant_id: tenantId, status: 'error', message: error.message
            });
          }
        }
      } finally {
        try {
          await fetch(`${baseUrl}/sessions/${apiToken}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
        } catch (_) {}
      }
    }

    const elapsedMs = Date.now() - startTime;
    const syncResult = {
      success: totalErrorCount === 0,
      message: `${automated ? 'Automated' : 'Manual'} orders sync completed in ${Math.round(elapsedMs / 1000)}s: ${totalSyncedCount} projects with changes, ${totalErrorCount} errors${timedOut ? `, ${totalSkipped} skipped (timeout)` : ''}`,
      syncedCount: totalSyncedCount, errorCount: totalErrorCount,
      totalProjects: totalProjectsProcessed, tenantsProcessed: allConfigs.length,
      automated, timedOut, skipped: totalSkipped,
      details: allDetails, errors: allErrors,
      timestamp: new Date().toISOString(), elapsed_ms: elapsedMs
    };

    // Log sync results per tenant
    for (const cfg of allConfigs) {
      const tenantDetails = allDetails.filter((d: any) => d.tenant_id === cfg.tenant_id);
      const tenantErrors = tenantDetails.filter((d: any) => d.status === 'error');
      const tenantSynced = tenantDetails.filter((d: any) => d.status === 'synced' && (d.orders_added > 0 || d.orders_updated > 0));

      try {
        await supabase.from('orders_sync_logs').insert({
          synced_count: tenantSynced.length,
          error_count: tenantErrors.length,
          details: { ...syncResult, details: tenantDetails, timedOut, skipped: totalSkipped },
          tenant_id: cfg.tenant_id || null,
        });
      } catch (logErr) {
        console.error('Failed to log sync results:', logErr);
      }

      try {
        await supabase.from('automation_logs').insert({
          action_type: 'order_sync',
          status: tenantErrors.length > 0 ? 'partial' : (timedOut ? 'partial' : 'success'),
          summary: `${tenantSynced.length} synced, ${tenantErrors.length} errors${timedOut ? `, skipped (timeout)` : ''} (${automated ? 'automated' : 'manual'})`,
          error_message: tenantErrors.length > 0 ? tenantErrors.map((d: any) => d.message).join('; ') : null,
          details: { totalSyncedCount: tenantSynced.length, totalErrorCount: tenantErrors.length, automated, timedOut, totalSkipped },
          tenant_id: cfg.tenant_id || null,
        });
      } catch (logErr) {
        console.error('Failed to log automation result:', logErr);
      }
    }

    if (totalErrorCount > 0) {
      try {
        await supabase.functions.invoke('send-error-alert', {
          body: { action_type: 'order_sync', error_message: allErrors.join('\n'), summary: `Order sync: ${totalErrorCount} errors`, details: { totalSyncedCount, totalErrorCount, automated, timedOut, totalSkipped } }
        });
      } catch (_) {}
    }

    console.log('Orders sync completed:', syncResult.message);
    return new Response(JSON.stringify(syncResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in orders sync function:', error);
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const errorSupabase = createClient(supabaseUrl, supabaseServiceKey);
      await errorSupabase.from('automation_logs').insert({ action_type: 'order_sync', status: 'error', summary: 'Order sync failed completely', error_message: error.message });
      await errorSupabase.functions.invoke('send-error-alert', { body: { action_type: 'order_sync', error_message: error.message, summary: 'Order sync failed completely' } });
    } catch (_) {}

    return new Response(JSON.stringify({ success: false, error: error.message, timestamp: new Date().toISOString() }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
