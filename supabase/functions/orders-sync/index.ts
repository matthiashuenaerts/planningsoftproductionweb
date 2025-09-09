import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      automated = true,
      baseUrl = 'https://app.thonon.be/fmi/data/vLatest/databases/CrownBasePro-Thonon',
      username = 'Matthias HUENAERTS',
      password = '8pJ1A24z'
    } = await req.json().catch(() => ({ automated: true }));
    
    console.log(`Starting ${automated ? 'automated' : 'manual'} orders sync...`);
    
    // Get all projects with project_link_id from Supabase
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name, project_link_id')
      .not('project_link_id', 'is', null);

    if (projectsError) {
      throw new Error(`Failed to fetch projects: ${projectsError.message}`);
    }

    let syncedCount = 0;
    let errorCount = 0;
    const details: Array<{
      project_name: string;
      project_link_id: string;
      status: string;
      message?: string;
      orders_found?: number;
      orders_updated?: number;
      orders_added?: number;
    }> = [];
    const errors: string[] = [];

    console.log(`Found ${projects.length} projects to sync orders for`);

    // Process each project
    for (const project of projects) {
      try {
        console.log(`Syncing orders for project ${project.name} (${project.project_link_id})`);

        // Authenticate with Orders API
        const authResponse = await fetch('https://pqzfmphitzlgwnmexrbx.supabase.co/functions/v1/orders-api-proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            action: 'authenticate',
            baseUrl: baseUrl,
            username: username,
            password: password
          })
        });

        if (!authResponse.ok) {
          throw new Error('Orders API authentication failed');
        }

        const authData = await authResponse.json();
        const token = authData.response?.token;

        if (!token) {
          throw new Error('No token received from Orders API');
        }

        // Query orders for this project
        const queryResponse = await fetch('https://pqzfmphitzlgwnmexrbx.supabase.co/functions/v1/orders-api-proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            action: 'query',
            baseUrl: baseUrl,
            token: token,
            projectLinkId: project.project_link_id
          })
        });

        if (!queryResponse.ok) {
          throw new Error('Orders API query failed');
        }

        const queryData = await queryResponse.json();
        
        if (!queryData || !queryData.bestellingen) {
          details.push({
            project_name: project.name,
            project_link_id: project.project_link_id,
            status: 'no_orders',
            orders_found: 0
          });
          continue;
        }

        const externalOrders = queryData.bestellingen;
        console.log(`Found ${externalOrders.length} orders for project ${project.name}`);

        let ordersUpdated = 0;
        let ordersAdded = 0;

        // Process each order
        for (const externalOrder of externalOrders) {
          // Normalize order number from various possible fields
          const rawOrderNumber = externalOrder.ordernummer ?? externalOrder.bestelnummer ?? externalOrder.ordernr ?? externalOrder.orderNumber ?? externalOrder.bestellingsnummer ?? null;
          const orderNumber = typeof rawOrderNumber === 'string' ? rawOrderNumber.trim() : (rawOrderNumber != null ? String(rawOrderNumber) : null);

          if (!orderNumber) {
            console.warn(`Skipping order without order number for project ${project.name}`);
            continue;
          }
          
          // Check if order already exists in Supabase
          const { data: existingOrder } = await supabase
            .from('orders')
            .select('*')
            .eq('external_order_number', orderNumber)
            .eq('project_id', project.id)
            .maybeSingle();

          // Convert delivery week to date
          const deliveryDate = convertWeekNumberToDate(externalOrder.leverweek);
          
          // Determine order status with upgrade-only logic for isVolledigOntvangen
          let orderStatus = 'pending';
          const isDelivered = externalOrder.isVolledigOntvangen;
          const isShipped = externalOrder.isVerzonden;
          
          if (isDelivered) {
            orderStatus = 'delivered';
          } else if (isShipped && (!existingOrder || existingOrder.status !== 'delivered')) {
            orderStatus = 'pending';
          } else if (existingOrder) {
            // Keep existing status if order was already delivered and isVolledigOntvangen is now false
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
            notes: externalOrder.referentie || null
          };

          if (existingOrder) {
            // Update existing order if there are changes
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
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingOrder.id);

              if (updateError) {
                console.error(`Error updating order ${orderNumber}:`, updateError);
                errors.push(`Failed to update order ${orderNumber}: ${updateError.message}`);
              } else {
                ordersUpdated++;
                console.log(`Updated order ${orderNumber}`);
              }
            }
          } else {
            // Create new order
            const { data: newOrder, error: insertError } = await supabase
              .from('orders')
              .insert(orderData)
              .select()
              .single();

            if (insertError) {
              console.error(`Error creating order ${orderNumber}:`, insertError);
              errors.push(`Failed to create order ${orderNumber}: ${insertError.message}`);
            } else {
              ordersAdded++;
              console.log(`Added new order ${orderNumber}`);

              // Add order items if available
              if (externalOrder.artikelen && Array.isArray(externalOrder.artikelen)) {
                const itemsToInsert = externalOrder.artikelen.map((artikel: any) => ({
                  order_id: newOrder.id,
                  description: artikel.omschrijving || 'No description',
                  quantity: parseInt(artikel.aantal) || 1,
                  article_code: artikel.artikel || null,
                  ean: artikel.ean || null, // Add EAN field
                  delivered_quantity: orderData.status === 'delivered' ? (parseInt(artikel.aantal) || 1) : 0,
                  notes: artikel.categorie ? `Category: ${artikel.categorie}` : null
                }));

                const { error: itemsError } = await supabase
                  .from('order_items')
                  .insert(itemsToInsert);

                if (itemsError) {
                  console.error(`Error adding items for order ${orderNumber}:`, itemsError);
                  errors.push(`Failed to add items for order ${orderNumber}: ${itemsError.message}`);
                }
              }
            }
          }
        }

        details.push({
          project_name: project.name,
          project_link_id: project.project_link_id,
          status: 'synced',
          orders_found: externalOrders.length,
          orders_updated: ordersUpdated,
          orders_added: ordersAdded
        });

        if (ordersUpdated > 0 || ordersAdded > 0) {
          syncedCount++;
        }

      } catch (error) {
        console.error(`Error syncing project ${project.name}:`, error);
        errorCount++;
        errors.push(`Project ${project.name}: ${error.message}`);
        
        details.push({
          project_name: project.name,
          project_link_id: project.project_link_id,
          status: 'error',
          message: error.message
        });
      }
    }

    // Log sync results
    const syncResult = {
      success: errorCount === 0,
      message: `${automated ? 'Automated' : 'Manual'} orders sync completed: ${syncedCount} projects with changes, ${errorCount} errors`,
      syncedCount,
      errorCount,
      totalProjects: projects.length,
      automated,
      details,
      errors,
      timestamp: new Date().toISOString()
    };

    console.log('Logging sync results to orders_sync_logs table...');
    
    const { error: logError } = await supabase
      .from('orders_sync_logs')
      .insert({
        synced_count: syncedCount,
        error_count: errorCount,
        details: syncResult
      });

    if (logError) {
      console.error('Failed to log sync results:', logError);
    } else {
      console.log('Sync results logged successfully to orders_sync_logs');
    }

    console.log('Orders sync process completed:', syncResult);

    return new Response(JSON.stringify(syncResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
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

// Helper function to convert week number to date
function convertWeekNumberToDate(weekString: string): string {
  if (!weekString) {
    return new Date().toISOString();
  }

  // Handle both "YYYYWW" format and date strings
  if (weekString.length === 6 && /^\d{6}$/.test(weekString)) {
    const year = parseInt(weekString.substring(0, 4));
    const week = parseInt(weekString.substring(4, 6));
    
    // Calculate date from week number
    const jan1 = new Date(year, 0, 1);
    const daysToAdd = (week - 1) * 7;
    const resultDate = new Date(jan1.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    
    // Adjust to Monday of that week
    const dayOfWeek = resultDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    resultDate.setDate(resultDate.getDate() + mondayOffset);
    
    return resultDate.toISOString();
  }

  // Try to parse as regular date
  try {
    return new Date(weekString).toISOString();
  } catch {
    return new Date().toISOString();
  }
}