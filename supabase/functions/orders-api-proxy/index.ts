import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Try to authenticate against a FileMaker Data API session endpoint. */
async function attemptAuth(sessionUrl: string, username: string, password: string, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(sessionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
      },
      body: JSON.stringify({}),
      signal: controller.signal,
    });

    clearTimeout(timer);

    const text = await response.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return { ok: response.ok, status: response.status, data, url: sessionUrl, error: null };
  } catch (err) {
    clearTimeout(timer);
    const isAbort = err instanceof DOMException && err.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      data: null,
      url: sessionUrl,
      error: isAbort
        ? `Timeout after ${timeoutMs}ms reaching ${sessionUrl}`
        : `Network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Build the sessions URL, optionally overriding the port. */
function buildSessionUrl(baseUrl: string, overridePort?: string): string {
  const parsed = new URL(baseUrl.replace(/\/+$/, ''));
  if (overridePort) parsed.port = overridePort;
  return `${parsed.origin}${parsed.pathname}/sessions`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

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

    const baseUrl = configData.base_url.replace(/\/+$/, '');
    const { username, password } = configData;

    // Check if port is explicitly set
    let parsedUrl: URL;
    try { parsedUrl = new URL(baseUrl); } catch {
      return new Response(JSON.stringify({ error: `Invalid base_url: ${baseUrl}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const hasExplicitPort = !!parsedUrl.port;

    console.log(`Orders API Proxy - Action: ${action}, Tenant: ${effectiveTenantId}, BaseURL: ${baseUrl}, ExplicitPort: ${hasExplicitPort}`);
    
    if (action === 'authenticate') {
      const sessionUrl = buildSessionUrl(baseUrl);
      console.log(`Authenticating with baseUrl: ${sessionUrl}`);

      const result = await attemptAuth(sessionUrl, username, password, 20000);

      // If first attempt failed and no explicit port, try :5003 fallback
      if (!result.ok && result.error && !hasExplicitPort) {
        console.log('Primary attempt failed, trying fallback port 5003...');
        const fallbackUrl = buildSessionUrl(baseUrl, '5003');
        const fallbackResult = await attemptAuth(fallbackUrl, username, password, 20000);

        if (fallbackResult.ok) {
          const sessionToken = fallbackResult.data?.response?.token;
          if (!sessionToken) {
            return new Response(
              JSON.stringify({ error: 'No token in response from fallback', diagnostics: { attempted_url: fallbackUrl, fallback: true } }),
              { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          console.log('Fallback to port 5003 succeeded');
          return new Response(
            JSON.stringify({ response: { token: sessionToken }, diagnostics: { attempted_url: fallbackUrl, fallback: true, processing_ms: Date.now() - startTime } }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        return new Response(
          JSON.stringify({
            error: `Connection failed on default port and fallback :5003. Primary: ${result.error}. Fallback: ${fallbackResult.error || `HTTP ${fallbackResult.status}`}`,
            diagnostics: { primary_url: result.url, fallback_url: fallbackResult.url, processing_ms: Date.now() - startTime }
          }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!result.ok) {
        const errMsg = result.error || `HTTP ${result.status}: ${JSON.stringify(result.data)}`;
        return new Response(
          JSON.stringify({ error: `Authentication failed: ${errMsg}`, diagnostics: { attempted_url: result.url, processing_ms: Date.now() - startTime } }),
          { status: result.status || 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const sessionToken = result.data?.response?.token;
      if (!sessionToken) {
        console.error('No token in Orders auth response:', result.data);
        return new Response(
          JSON.stringify({ error: 'No token received from Orders API', diagnostics: { attempted_url: result.url } }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Orders authentication successful, token received');
      return new Response(
        JSON.stringify({ response: { token: sessionToken }, diagnostics: { attempted_url: result.url, fallback: false, processing_ms: Date.now() - startTime } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
      
    } else if (action === 'query') {
      console.log(`Querying orders for projectLinkId: ${projectLinkId ?? orderNumber}`);

      const layout = encodeURIComponent('API_order');
      const scriptName = encodeURIComponent('FindSupplierOrderByOrderNumber');
      const param = encodeURIComponent(String(projectLinkId ?? orderNumber));

      // Use parsed URL to build query URL respecting port
      const parsed = new URL(baseUrl);
      const queryUrl = `${parsed.origin}${parsed.pathname}/layouts/${layout}/script/${scriptName}?script.param=${param}`;

      const queryController = new AbortController();
      const queryTimeout = setTimeout(() => queryController.abort(), 15000);

      const queryResponse = await fetch(queryUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        signal: queryController.signal,
      });

      clearTimeout(queryTimeout);

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
      JSON.stringify({ error: 'An internal error occurred.', diagnostics: { processing_ms: Date.now() - startTime } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
})
