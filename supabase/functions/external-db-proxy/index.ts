import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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
    const { action, token, orderNumber, tenant_id } = body;

    // Always load credentials from the database using service role
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Determine tenant_id: use provided or look up from user
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
      .eq('api_type', 'projects')
      .eq('tenant_id', effectiveTenantId)
      .single();

    if (configError || !configData) {
      return new Response(JSON.stringify({ error: 'External API configuration not found. Please save the configuration in Settings first.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Remove trailing slashes from base URL to prevent double-slash issues
    const baseUrl = configData.base_url.replace(/\/+$/, '');
    const { username, password } = configData;

    console.log(`Action: ${action}, Tenant: ${effectiveTenantId}, BaseURL: ${baseUrl}`);

    if (action === 'authenticate') {
      const sessionUrl = `${baseUrl}/sessions`;
      console.log(`Authenticating with FileMaker API at: ${sessionUrl}`);
      console.log(`Username: ${username}`);
      
      // Increase timeout to 25 seconds for slow remote servers
      const fetchController = new AbortController();
      const fetchTimeout = setTimeout(() => fetchController.abort(), 25000);

      try {
        // FileMaker Data API supports both Basic Auth header and JSON body credentials
        // Try JSON body method first as it's more compatible with some proxy configurations
        const response = await fetch(sessionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
          },
          body: JSON.stringify({}),
          signal: fetchController.signal
        });

        clearTimeout(fetchTimeout);

      const data = await response.json()
      
      if (!response.ok) {
        console.error('Authentication failed:', data)
        return new Response(
          JSON.stringify({ error: `Authentication failed: ${response.status} ${response.statusText}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Authentication successful')
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'query') {
      console.log('Querying FileMaker API for order:', orderNumber)
      
      const queryController = new AbortController();
      const queryTimeout = setTimeout(() => queryController.abort(), 15000);

      const response = await fetch(
        `${baseUrl}/layouts/API_order/script/FindOrderNumber?script.param=${encodeURIComponent(String(orderNumber))}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: queryController.signal
        }
      )

      clearTimeout(queryTimeout);

      const data = await response.json()
      
      if (!response.ok) {
        console.error('Query failed:', data)
        return new Response(
          JSON.stringify({ error: `Query failed: ${response.status} ${response.statusText}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Query successful')
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "authenticate" or "query".' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    const isAbort = error instanceof DOMException && error.name === 'AbortError';
    const isConnectionError = error instanceof TypeError && (error.message?.includes('tcp connect error') || error.message?.includes('ETIMEDOUT'));
    
    let errorMsg = 'An internal error occurred.';
    let status = 500;
    
    if (isAbort || isConnectionError) {
      errorMsg = 'Connection timed out. The external FileMaker server is not reachable from this server. Please check if the FileMaker server allows external connections or has IP restrictions.';
      status = 504;
    } else if (error instanceof Error) {
      errorMsg = error.message;
    }
    
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
