import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { projectLinkId, baseUrl, username, password } = await req.json();
    
    console.log(`Orders Import - Project Link ID: ${projectLinkId}`);
    
    // Initialize Supabase client with service role key for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Step 1: Authenticate with Orders API
    console.log('Authenticating with Orders API...');
    const authResponse = await fetch(`${baseUrl}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
      },
      body: JSON.stringify({})
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error(`Auth error: ${errorText}`);
      throw new Error(`Authentication failed: ${authResponse.status} ${authResponse.statusText}`);
    }

    const authData = await authResponse.json();
    const token = authData?.response?.token;
    if (!token) {
      throw new Error('No token received from Orders API');
    }
    console.log('Orders API authentication successful');

    // Step 2: Query Orders API for project data
    console.log(`Querying orders for project: ${projectLinkId}`);
    const layout = encodeURIComponent('API_order');
    const scriptName = encodeURIComponent('FindSupplierOrderByOrderNumber');
    const param = encodeURIComponent(String(projectLinkId));

    const queryUrl = `${baseUrl}/layouts/${layout}/script/${scriptName}?script.param=${param}`;
    
    const queryResponse = await fetch(queryUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      }
    });

    if (!queryResponse.ok) {
      const errorText = await queryResponse.text();
      console.error(`Query error: ${errorText}`);
      throw new Error(`Query failed: ${queryResponse.status} ${queryResponse.statusText}`);
    }

    const queryData = await queryResponse.json();
    console.log('Orders query successful');

    // Step 3: Parse the response
    let ordersData: any;
    try {
      const scriptResult = queryData?.response?.scriptResult;
      if (scriptResult) {
        ordersData = JSON.parse(scriptResult);
      } else {
        ordersData = queryData;
      }
    } catch (e) {
      console.warn('Failed to parse scriptResult, using raw response');
      ordersData = queryData;
    }

    if (!ordersData.bestellingen || ordersData.bestellingen.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No orders found for this project',
          imported: 0,
          errors: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Process and import orders
    let importedCount = 0;
    const errors: string[] = [];
    
    console.log(`Processing ${ordersData.bestellingen.length} orders...`);
    
    for (const bestelling of ordersData.bestellingen) {
      try {
        const orderNumber = bestelling.bestelnummer;
        const supplier = bestelling.leverancier;
        const deliveryWeek = bestelling.leverweek;
        const isShipped = bestelling.isVerzonden;
        
        // Convert delivery week to date (leverweek format: 202511 = year 2025, week 11)
        let expectedDeliveryDate: string;
        if (deliveryWeek && /^\d{6}$/.test(deliveryWeek)) {
          const year = parseInt(deliveryWeek.substring(0, 4));
          const week = parseInt(deliveryWeek.substring(4, 6));
          const jan1 = new Date(year, 0, 1);
          const jan1Day = jan1.getDay();
          const daysToFirstMonday = jan1Day === 0 ? 1 : (8 - jan1Day);
          const firstMonday = new Date(year, 0, 1 + daysToFirstMonday);
          const targetDate = new Date(firstMonday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
          expectedDeliveryDate = targetDate.toISOString();
        } else {
          // Default to current date if we can't parse the week
          expectedDeliveryDate = new Date().toISOString();
        }

        // Find project by project_link_id
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .select('id')
          .eq('project_link_id', projectLinkId)
          .single();

        if (projectError || !project) {
          console.warn(`Project not found for project_link_id: ${projectLinkId}`);
          // Continue processing but don't link to project
        }

        // Upsert order (using external_order_number for idempotency)
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .upsert({
            external_order_number: orderNumber,
            project_id: project?.id || null,
            supplier: supplier,
            order_date: new Date().toISOString(),
            expected_delivery: expectedDeliveryDate,
            status: isShipped ? 'delivered' : 'pending',
            order_type: 'standard',
            notes: `Imported from Orders API. Delivery week: ${deliveryWeek}`,
          }, {
            onConflict: 'external_order_number',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (orderError) {
          console.error(`Error upserting order ${orderNumber}:`, orderError);
          errors.push(`Failed to import order ${orderNumber}: ${orderError.message}`);
          continue;
        }

        console.log(`Order ${orderNumber} imported successfully`);

        // Process order items (articles)
        if (bestelling.artikelen && bestelling.artikelen.length > 0) {
          for (const artikel of bestelling.artikelen) {
            const { error: itemError } = await supabase
              .from('order_items')
              .upsert({
                order_id: order.id,
                description: artikel.omschrijving || 'No description',
                quantity: parseInt(artikel.aantal) || 1,
                article_code: artikel.artikel || null,
                notes: artikel.categorie ? `Category: ${artikel.categorie}` : null,
              }, {
                onConflict: 'order_id,article_code',
                ignoreDuplicates: true
              });

            if (itemError) {
              console.error(`Error importing item for order ${orderNumber}:`, itemError);
              errors.push(`Failed to import item for order ${orderNumber}: ${itemError.message}`);
            }
          }
        }

        importedCount++;
      } catch (error) {
        console.error(`Error processing order ${bestelling.bestelnummer}:`, error);
        errors.push(`Error processing order ${bestelling.bestelnummer}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`Import completed. Imported: ${importedCount}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully imported ${importedCount} orders`,
        imported: importedCount,
        errors: errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Orders Import error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        imported: 0,
        errors: []
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
})