import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const authClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { action, token, orderNumber, projectLinkId, tenant_id } = body;

    // Always load credentials from the database using service role
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Determine tenant_id
    let effectiveTenantId = tenant_id;
    if (!effectiveTenantId) {
      const { data: empData } = await serviceClient
        .from('employees')
        .select('tenant_id')
        .eq('auth_user_id', user.id)
        .single();
      effectiveTenantId = empData?.tenant_id;
    }

    if (!effectiveTenantId) {
      return new Response(JSON.stringify({ error: 'Could not determine tenant' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Load config from database
    const { data: configData, error: configError } = await serviceClient
      .from('external_api_configs')
      .select('base_url, username, password')
      .eq('api_type', 'orders')
      .eq('tenant_id', effectiveTenantId)
      .single();

    if (configError || !configData) {
      return new Response(JSON.stringify({ error: 'Orders API configuration not found. Please save the configuration in Settings first.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { base_url: baseUrl, username, password } = configData;
    
    console.log(`Orders API Proxy - Action: ${action}`);
    
    if (action === 'authenticate') {
      console.log(`Authenticating with baseUrl: ${baseUrl}`);
      
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
      const sessionToken = authData?.response?.token;
      if (!sessionToken) {
        console.error('No token in Orders auth response:', authData);
        throw new Error('No token received from Orders API');
      }
      console.log('Orders authentication successful, token received');
      
      return new Response(
        JSON.stringify({ response: { token: sessionToken } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
      
    } else if (action === 'query') {
      console.log(`Querying orders for projectLinkId: ${projectLinkId ?? orderNumber}`);

      const layout = encodeURIComponent('API_order');
      const scriptName = encodeURIComponent('FindSupplierOrderByOrderNumber');
      const param = encodeURIComponent(String(projectLinkId ?? orderNumber));

      const queryUrl = `${baseUrl}/layouts/${layout}/script/${scriptName}?script.param=${param}`;

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

      let resultBody: any = queryData;
      try {
        const scriptResult = queryData?.response?.scriptResult;
        if (scriptResult) {
          resultBody = JSON.parse(scriptResult);
          console.log('Parsed scriptResult successfully');
        }
      } catch (e) {
        console.warn('Failed to parse scriptResult, returning raw response');
      }

      return new Response(
        JSON.stringify(resultBody),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }
    
    throw new Error(`Unknown action: ${action}`);
    
  } catch (error) {
    console.error('Orders API Proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'An internal error occurred.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
})
