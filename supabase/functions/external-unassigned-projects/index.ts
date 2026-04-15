import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FETCH_TIMEOUT_MS = 15_000;

function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { tenant_id } = body;

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: 'tenant_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get external API config for projects
    const { data: config, error: configError } = await supabase
      .from('external_api_configs')
      .select('base_url, username, password')
      .eq('api_type', 'projects')
      .eq('tenant_id', tenant_id)
      .single();

    if (configError || !config) {
      return new Response(JSON.stringify({ error: 'No external API configuration found for this tenant' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baseUrl = config.base_url.replace(/\/+$/, '');

    // Authenticate with FileMaker
    let apiToken: string;
    try {
      const authResponse = await fetchWithTimeout(`${baseUrl}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa(`${config.username}:${config.password}`),
        },
        body: JSON.stringify({}),
      });

      if (!authResponse.ok) {
        const errText = await authResponse.text();
        throw new Error(`Auth failed (${authResponse.status}): ${errText}`);
      }

      const authData = await authResponse.json();
      apiToken = authData?.response?.token;
      if (!apiToken) throw new Error('No token received');
    } catch (authErr: any) {
      return new Response(JSON.stringify({ error: `Authentication failed: ${authErr.message}` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      // Calculate date range: start of current year to 1 year ahead
      const now = new Date();
      const startOfYear = `${now.getFullYear()}/01/01`;
      const oneYearAhead = new Date(now);
      oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);
      const endDate = `${oneYearAhead.getMonth() + 1}/${oneYearAhead.getDate()}/${oneYearAhead.getFullYear()}`;

      // Query FileMaker for orders within date range using a find request
      const findUrl = `${baseUrl}/layouts/API_order/_find`;
      const findBody = {
        query: [
          {
            orderdatum: `${startOfYear}...${oneYearAhead.getFullYear()}/${String(oneYearAhead.getMonth() + 1).padStart(2, '0')}/${String(oneYearAhead.getDate()).padStart(2, '0')}`
          }
        ],
        limit: "5000"
      };

      console.log('Searching external DB with find body:', JSON.stringify(findBody));

      const queryResponse = await fetchWithTimeout(findUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(findBody),
      }, 25000);

      const queryData = await queryResponse.json();

      if (!queryResponse.ok) {
        // FileMaker returns 401 for "no records found" sometimes
        if (queryData?.messages?.[0]?.code === '401') {
          return new Response(JSON.stringify({ projects: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw new Error(`Query failed: ${queryResponse.status} - ${JSON.stringify(queryData)}`);
      }

      // Extract order numbers from FileMaker response
      const records = queryData?.response?.data || [];
      console.log(`Found ${records.length} records in external DB`);

      const externalProjects = records.map((record: any) => {
        const fd = record.fieldData || {};
        return {
          ordernummer: fd.ordernummer || fd.Ordernummer || fd.OrderNumber || '',
          klant: fd.klant || fd.Klant || fd.klantnaam || fd.Klantnaam || '',
          orderdatum: fd.orderdatum || fd.Orderdatum || '',
          beschrijving: fd.beschrijving || fd.Beschrijving || fd.omschrijving || fd.Omschrijving || '',
        };
      }).filter((p: any) => p.ordernummer && String(p.ordernummer).trim() !== '');

      // Get existing project_link_ids from our database
      const { data: existingProjects } = await supabase
        .from('projects')
        .select('project_link_id')
        .eq('tenant_id', tenant_id)
        .not('project_link_id', 'is', null);

      const existingLinkIds = new Set(
        (existingProjects || []).map((p: any) => String(p.project_link_id).trim())
      );

      // Filter out already-assigned projects
      const unassigned = externalProjects.filter(
        (p: any) => !existingLinkIds.has(String(p.ordernummer).trim())
      );

      console.log(`${unassigned.length} unassigned projects out of ${externalProjects.length} total`);

      return new Response(JSON.stringify({ projects: unassigned }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } finally {
      // Clean up FileMaker session
      try {
        await fetchWithTimeout(`${baseUrl}/sessions/${apiToken}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        }, 5000);
      } catch (_) {}
    }

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
