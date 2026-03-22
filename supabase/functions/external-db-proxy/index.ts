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

    const { base_url: baseUrl, username, password } = configData;

    if (action === 'authenticate') {
      console.log('Authenticating with FileMaker API...')
      
      const response = await fetch(`${baseUrl}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${username}:${password}`)}`
        }
      })

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
      
      const response = await fetch(
        `${baseUrl}/layouts/API_order/script/FindOrderNumber?script.param=${encodeURIComponent(String(orderNumber))}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

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
    return new Response(
      JSON.stringify({ error: 'An internal error occurred.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
