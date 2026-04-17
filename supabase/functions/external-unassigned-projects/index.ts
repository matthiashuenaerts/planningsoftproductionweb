import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FETCH_TIMEOUT_MS = 25_000;

function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
}

// Format a Date as dd/MM/yyyy (FileMaker default European format)
function fmDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// Parse a FileMaker date (dd/MM/yyyy or MM/dd/yyyy or yyyy-MM-dd) into a Date
function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  const m1 = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) {
    const [, d, mth, y] = m1;
    return new Date(parseInt(y), parseInt(mth) - 1, parseInt(d));
  }
  const m2 = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) {
    return new Date(parseInt(m2[1]), parseInt(m2[2]) - 1, parseInt(m2[3]));
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) return d;
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  let apiToken: string | undefined;
  let baseUrl = '';

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

    baseUrl = config.base_url.replace(/\/+$/, '');

    // 1) Authenticate
    const authResponse = await fetchWithTimeout(`${baseUrl}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(`${config.username}:${config.password}`),
      },
      body: JSON.stringify({}),
    }, 20000);

    if (!authResponse.ok) {
      const errText = await authResponse.text();
      return new Response(JSON.stringify({ error: `Authentication failed (${authResponse.status}): ${errText}` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authData = await authResponse.json();
    apiToken = authData?.response?.token;
    if (!apiToken) {
      return new Response(JSON.stringify({ error: 'No token received' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Pre-fetch existing project_link_ids so we filter as we go
    const { data: existingProjects } = await supabase
      .from('projects')
      .select('project_link_id')
      .eq('tenant_id', tenant_id)
      .not('project_link_id', 'is', null);

    const existingLinkIds = new Set(
      (existingProjects || []).map((p: any) => String(p.project_link_id).trim())
    );

    // 3) Build date range: start of current year .. one year ahead
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const oneYearAhead = new Date(now);
    oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);
    const dateRange = `${fmDate(startOfYear)}...${fmDate(oneYearAhead)}`;

    console.log(`Searching orders with orderdatum range: ${dateRange}`);

    // 4) Use _find to query server-side by date range -- much faster than fetching all records
    const findUrl = `${baseUrl}/layouts/API_order/_find`;
    const allRecords: any[] = [];
    let offset = 1;
    const batchSize = 500;
    let hasMore = true;
    let usedFind = true;

    while (hasMore) {
      const findResponse = await fetchWithTimeout(findUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: [{ orderdatum: dateRange }],
          limit: String(batchSize),
          offset: String(offset),
        }),
      }, 25000);

      const findData = await findResponse.json();

      if (!findResponse.ok) {
        const code = findData?.messages?.[0]?.code;
        if (code === '401') { hasMore = false; break; } // no records
        // If _find fails (e.g. field missing), abort find loop and fall back below
        console.warn(`_find failed (${findResponse.status}): ${JSON.stringify(findData)}`);
        usedFind = false;
        break;
      }

      const batch = findData?.response?.data || [];
      allRecords.push(...batch);
      if (batch.length < batchSize) {
        hasMore = false;
      } else {
        offset += batchSize;
        if (allRecords.length >= 5000) hasMore = false;
      }
    }

    // 5) Fallback: if _find didn't work, fetch records and filter client-side
    if (!usedFind) {
      console.log('Falling back to records endpoint with client-side date filter');
      offset = 1;
      hasMore = true;
      while (hasMore) {
        const recordsUrl = `${baseUrl}/layouts/API_order/records?_offset=${offset}&_limit=${batchSize}`;
        const recordsResponse = await fetchWithTimeout(recordsUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        }, 25000);

        const recordsData = await recordsResponse.json();
        if (!recordsResponse.ok) {
          if (recordsData?.messages?.[0]?.code === '401') break;
          throw new Error(`Records query failed: ${recordsResponse.status} - ${JSON.stringify(recordsData)}`);
        }
        const batch = recordsData?.response?.data || [];
        allRecords.push(...batch);
        if (batch.length < batchSize) hasMore = false;
        else { offset += batchSize; if (allRecords.length >= 5000) hasMore = false; }
      }
    }

    console.log(`Fetched ${allRecords.length} records (usedFind=${usedFind})`);

    // 6) Map + de-duplicate by ordernummer + filter unassigned + filter date range (defensive)
    const seen = new Set<string>();
    const unassigned: any[] = [];

    for (const record of allRecords) {
      const fd = record.fieldData || {};
      const ordernummer = String(fd.ordernummer ?? fd.Ordernummer ?? fd.OrderNumber ?? '').trim();
      if (!ordernummer) continue;
      if (seen.has(ordernummer)) continue;
      if (existingLinkIds.has(ordernummer)) { seen.add(ordernummer); continue; }

      const orderdatumRaw = fd.orderdatum ?? fd.Orderdatum ?? '';
      const date = parseDate(orderdatumRaw);
      // Defensive date filter (if we used the records fallback)
      if (date && (date < startOfYear || date > oneYearAhead)) continue;

      seen.add(ordernummer);
      unassigned.push({
        ordernummer,
        klant: fd.klant ?? fd.Klant ?? fd.klantnaam ?? fd.Klantnaam ?? '',
        klantnummer: fd.klantnummer ?? fd.Klantnummer ?? '',
        orderdatum: orderdatumRaw,
        ordertype: fd.ordertype ?? fd.Ordertype ?? '',
        beschrijving: fd.beschrijving ?? fd.Beschrijving ?? fd.omschrijving ?? fd.Omschrijving ?? fd.referentie ?? fd.Referentie ?? '',
        referentie: fd.referentie ?? fd.Referentie ?? '',
        adres: fd.adres ?? fd.Adres ?? '',
        plaatsingsdatum: fd.plaatsingsdatum ?? fd.Plaatsingsdatum ?? '',
        orderverwerker: fd.orderverwerker ?? fd.Orderverwerker ?? '',
      });
    }

    // Sort newest first by orderdatum
    unassigned.sort((a, b) => {
      const da = parseDate(a.orderdatum)?.getTime() ?? 0;
      const db = parseDate(b.orderdatum)?.getTime() ?? 0;
      return db - da;
    });

    console.log(`${unassigned.length} unassigned projects (took ${Date.now() - startTime}ms)`);

    return new Response(JSON.stringify({ projects: unassigned, count: unassigned.length, took_ms: Date.now() - startTime }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } finally {
    if (apiToken && baseUrl) {
      try {
        await fetchWithTimeout(`${baseUrl}/sessions/${apiToken}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        }, 5000);
      } catch (_) {}
    }
  }
});
