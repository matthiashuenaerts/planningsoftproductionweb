import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, baseUrl, username, password, token, orderNumber } = await req.json();
    
    console.log(`Orders API Proxy - Action: ${action}`);
    
    if (action === 'authenticate') {
      // Authentication request - create session and get token
      console.log(`Authenticating with baseUrl: ${baseUrl}, username: ${username}`);
      
      const authResponse = await fetch(`${baseUrl}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
        },
        body: JSON.stringify({})
      });

      console.log(`Auth response status: ${authResponse.status}`);
      
      if (!authResponse.ok) {
        const errorText = await authResponse.text();
        console.error(`Auth error: ${errorText}`);
        throw new Error(`Authentication failed: ${authResponse.status} ${authResponse.statusText}`);
      }

      const authData = await authResponse.json();
      const token = authData?.response?.token;
      if (!token) {
        console.error('No token in Orders auth response:', authData);
        throw new Error('No token received from Orders API');
      }
      console.log('Orders authentication successful, token received');
      
      return new Response(
        JSON.stringify({ response: { token } }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
      
    } else if (action === 'query') {
      // Query request - fetch orders data using the specific endpoint
      console.log(`Querying orders for order number: ${orderNumber} with token: ${token}`);

      const layout = encodeURIComponent('API_');
      const scriptName = encodeURIComponent('FindSupplierOrderByOrderNumber');
      const param = encodeURIComponent(String(orderNumber));

      const queryUrl = `${baseUrl}/layouts/${layout}/script/${scriptName}?script.param=${param}`;
      console.log(`Query URL (GET): ${queryUrl}`);

      // Perform GET request to run the layout script with script.param
      const queryResponse = await fetch(queryUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      });

      console.log(`Query response status (GET): ${queryResponse.status}`);
      
      if (!queryResponse.ok) {
        const errorText = await queryResponse.text();
        console.error(`Query error (GET): ${errorText}`);
        throw new Error(`Query failed: ${queryResponse.status} ${queryResponse.statusText}`);
      }

      const queryData = await queryResponse.json();
      console.log('Orders query successful');

      return new Response(
        JSON.stringify(queryData),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }
    
    throw new Error(`Unknown action: ${action}`);
    
  } catch (error) {
    console.error('Orders API Proxy error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
})