import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeliveryConfirmationRequest {
  orderId: string;
  baseUrl?: string;
  username?: string;
  password?: string;
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
      orderId, 
      baseUrl = 'https://app.thonon.be/fmi/data/vLatest/databases/CrownBasePro-Thonon',
      username = 'Matthias HUENAERTS',
      password = '8pJ1A24z'
    }: DeliveryConfirmationRequest = await req.json();

    console.log(`Processing delivery confirmation for order ${orderId}`);

    // Get order details with items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          article_code,
          delivered_quantity,
          ean,
          description
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error(`Failed to fetch order: ${orderError?.message}`);
    }

    // Check if order is from external database
    if (order.source !== 'external database') {
      return new Response(JSON.stringify({
        success: false,
        message: 'Order is not from external database'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    if (!order.external_order_number) {
      throw new Error('Order missing external order number');
    }

    // First, authenticate with the external API using Basic Auth
    const credentials = btoa(`${username}:${password}`);
    const authResponse = await fetch(`${baseUrl}/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      }
    });

    if (!authResponse.ok) {
      throw new Error('External API authentication failed');
    }

    const authData = await authResponse.json();
    const token = authData.response?.token;

    if (!token) {
      throw new Error('No token received from external API');
    }

    // Prepare the receipt data - only include items that have been delivered
    const deliveredItems = order.order_items.filter((item: any) => item.delivered_quantity > 0);
    
    console.log(`Found ${deliveredItems.length} delivered items out of ${order.order_items.length} total items`);
    
    // If no items have been delivered, don't send confirmation
    if (deliveredItems.length === 0) {
      console.log('No items have been delivered yet, skipping external confirmation');
      return new Response(JSON.stringify({
        success: false,
        message: 'No items have been delivered yet'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    const artikelen = deliveredItems.map((item: any) => {
      console.log(`Including item: ${item.article_code || item.ean} with delivered quantity: ${item.delivered_quantity}`);
      return {
        SKU: item.article_code || item.ean || item.description,
        aantal: item.delivered_quantity
      };
    });

    const receiptData = {
      SupplierOrderNumber: order.external_order_number,
      ReceiptName: `Receipt_${order.external_order_number}_${new Date().toISOString().split('T')[0]}`,
      artikelen: artikelen
    };

    console.log('Sending receipt confirmation:', receiptData);

    // Call the CreateReceiptForSupplierOrderNumber script
    const confirmationResponse = await fetch(
      `${baseUrl}/layouts/API_bestelling/script/CreateReceiptForSupplierOrderNumber?script.param=${encodeURIComponent(JSON.stringify(receiptData))}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!confirmationResponse.ok) {
      const errorText = await confirmationResponse.text();
      throw new Error(`External API confirmation failed: ${confirmationResponse.status} - ${errorText}`);
    }

    const confirmationResult = await confirmationResponse.json();
    console.log('External API confirmation result:', confirmationResult);

    // Log the confirmation in our database
    await supabase
      .from('orders')
      .update({ 
        notes: `${order.notes || ''}\nDelivery confirmed to external database on ${new Date().toISOString()}`.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    return new Response(JSON.stringify({
      success: true,
      message: 'Delivery confirmation sent to external database',
      externalResponse: confirmationResult
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in external delivery confirmation:', error);
    
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