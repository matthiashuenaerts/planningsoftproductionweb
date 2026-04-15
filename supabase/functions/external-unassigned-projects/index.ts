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
      // Use the records endpoint instead of _find to avoid "Field is missing" errors.
      // Fetch records in batches using offset pagination.
      const allRecords: any[] = [];
      let offset = 1; // FileMaker uses 1-based offset
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const recordsUrl = `${baseUrl}/layouts/API_order/records?_offset=${offset}&_limit=${batchSize}`;
        console.log(`Fetching records offset=${offset} limit=${batchSize}`);

        const recordsResponse = await fetchWithTimeout(recordsUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        }, 25000);

        const recordsData = await recordsResponse.json();

        if (!recordsResponse.ok) {
          // FileMaker code 401 = no records found
          if (recordsData?.messages?.[0]?.code === '401') {
            break;
          }
          throw new Error(`Query failed: ${recordsResponse.status} - ${JSON.stringify(recordsData)}`);
        }

        const batch = recordsData?.response?.data || [];
        allRecords.push(...batch);

        // If we got fewer than batchSize, we've reached the end
        if (batch.length < batchSize) {
          hasMore = false;
        } else {
          offset += batchSize;
          // Safety limit: max 5000 records
          if (allRecords.length >= 5000) {
            hasMore = false;
          }
        }
      }

      console.log(`Fetched ${allRecords.length} total records from external DB`);

      // Calculate date range filter: start of current year to 1 year ahead
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const oneYearAhead = new Date(now);
      oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);

      // Parse a FileMaker date (dd/MM/yyyy or MM/dd/yyyy or yyyy-MM-dd) into a Date
      const parseDate = (raw: string): Date | null => {
        if (!raw) return null;
        const trimmed = String(raw).trim();
        // Try dd/MM/yyyy
        const m1 = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m1) {
          const [, d, mth, y] = m1;
          return new Date(parseInt(y), parseInt(mth) - 1, parseInt(d));
        }
        // Try yyyy-MM-dd
        const m2 = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m2) {
          return new Date(parseInt(m2[1]), parseInt(m2[2]) - 1, parseInt(m2[3]));
        }
        try {
          const d = new Date(trimmed);
          if (!isNaN(d.getTime())) return d;
        } catch (_) {}
        return null;
      };

      const externalProjects = allRecords
        .map((record: any) => {
          const fd = record.fieldData || {};
          return {
            ordernummer: fd.ordernummer || fd.Ordernummer || fd.OrderNumber || '',
            klant: fd.klant || fd.Klant || fd.klantnaam || fd.Klantnaam || '',
            orderdatum: fd.orderdatum || fd.Orderdatum || '',
            beschrijving: fd.beschrijving || fd.Beschrijving || fd.omschrijving || fd.Omschrijving || '',
          };
        })
        .filter((p: any) => {
          if (!p.ordernummer || String(p.ordernummer).trim() === '') return false;
          // Filter by date range
          const date = parseDate(p.orderdatum);
          if (!date) return true; // Include records without a parseable date
          return date >= startOfYear && date <= oneYearAhead;
        });

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

      console.log(`${unassigned.length} unassigned projects out of ${externalProjects.length} total (date-filtered)`);

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
