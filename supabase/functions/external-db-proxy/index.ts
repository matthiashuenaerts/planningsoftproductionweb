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

/** Build a query URL, optionally overriding the port. */
function buildQueryUrl(baseUrl: string, path: string, overridePort?: string): string {
  const parsed = new URL(baseUrl.replace(/\/+$/, ''));
  if (overridePort) parsed.port = overridePort;
  return `${parsed.origin}${parsed.pathname}${path}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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
    const { action, token, orderNumber, tenant_id } = body;

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
      .eq('api_type', 'projects')
      .eq('tenant_id', effectiveTenantId)
      .single();

    if (configError || !configData) {
      return new Response(JSON.stringify({ error: 'External API configuration not found. Please save the configuration in Settings first.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const baseUrl = configData.base_url.replace(/\/+$/, '');
    const { username, password } = configData;

    // Check if port is explicitly set in the saved URL
    let parsedUrl: URL;
    try { parsedUrl = new URL(baseUrl); } catch {
      return new Response(JSON.stringify({ error: `Invalid base_url: ${baseUrl}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const hasExplicitPort = !!parsedUrl.port;

    console.log(`Action: ${action}, Tenant: ${effectiveTenantId}, BaseURL: ${baseUrl}, ExplicitPort: ${hasExplicitPort}`);

    if (action === 'authenticate') {
      const sessionUrl = buildSessionUrl(baseUrl);
      console.log(`Authenticating with FileMaker API at: ${sessionUrl}`);

      const result = await attemptAuth(sessionUrl, username, password, 20000);

      // If first attempt failed with timeout/network and no explicit port, try :5003
      if (!result.ok && result.error && !hasExplicitPort) {
        console.log('Primary attempt failed, trying fallback port 5003...');
        const fallbackUrl = buildSessionUrl(baseUrl, '5003');
        const fallbackResult = await attemptAuth(fallbackUrl, username, password, 20000);

        if (fallbackResult.ok) {
          console.log('Fallback to port 5003 succeeded');
          return new Response(
            JSON.stringify({ ...fallbackResult.data, diagnostics: { attempted_url: fallbackUrl, fallback: true, processing_ms: Date.now() - startTime } }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Both failed
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

      console.log('Authentication successful, token received');
      return new Response(
        JSON.stringify({ ...result.data, diagnostics: { attempted_url: result.url, fallback: false, processing_ms: Date.now() - startTime } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'query') {
      console.log('Querying FileMaker API for order:', orderNumber);

      const path = `/layouts/API_order/script/FindOrderNumber?script.param=${encodeURIComponent(String(orderNumber))}`;
      const queryUrl = buildQueryUrl(baseUrl, path);

      const queryController = new AbortController();
      const queryTimeout = setTimeout(() => queryController.abort(), 15000);

      const response = await fetch(queryUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        signal: queryController.signal
      });

      clearTimeout(queryTimeout);

      const data = await response.json();

      if (!response.ok) {
        console.error('Query failed:', data);
        return new Response(
          JSON.stringify({ error: `Query failed: ${response.status} ${response.statusText}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Query successful');
      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "authenticate" or "query".' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    const isAbort = error instanceof DOMException && error.name === 'AbortError';
    const isConnectionError = error instanceof TypeError && (error.message?.includes('tcp connect error') || error.message?.includes('ETIMEDOUT'));

    let errorMsg = 'An internal error occurred.';
    let status = 500;

    if (isAbort || isConnectionError) {
      errorMsg = 'Connection timed out. The external FileMaker server is not reachable.';
      status = 504;
    } else if (error instanceof Error) {
      errorMsg = error.message;
    }

    return new Response(
      JSON.stringify({ error: errorMsg, diagnostics: { processing_ms: Date.now() - startTime } }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
