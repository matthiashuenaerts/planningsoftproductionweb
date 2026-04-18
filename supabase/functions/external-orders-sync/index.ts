// Background sync: fetch external (FileMaker) orders for a tenant and upsert into
// public.external_orders_buffer. Designed to be invoked by a cron dispatcher
// every 2 hours per tenant. Service-role only.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FETCH_TIMEOUT_MS = 25_000;

function fetchWithTimeout(
  url: string,
  opts: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

function fmDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const t = String(raw).trim();
  const m1 = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) {
    return new Date(parseInt(m1[3]), parseInt(m1[2]) - 1, parseInt(m1[1]));
  }
  const m2 = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) {
    return new Date(parseInt(m2[1]), parseInt(m2[2]) - 1, parseInt(m2[3]));
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

async function syncTenant(supabase: any, tenantId: string) {
  let apiToken: string | undefined;
  let baseUrl = "";
  const startTime = Date.now();

  try {
    const { data: config, error: cfgErr } = await supabase
      .from("external_api_configs")
      .select("base_url, username, password")
      .eq("api_type", "projects")
      .eq("tenant_id", tenantId)
      .single();

    if (cfgErr || !config) {
      throw new Error("No external API config for tenant");
    }
    baseUrl = config.base_url.replace(/\/+$/, "");

    // Authenticate
    const authResp = await fetchWithTimeout(`${baseUrl}/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " +
          btoa(`${config.username}:${config.password}`),
      },
      body: JSON.stringify({}),
    }, 20000);
    if (!authResp.ok) {
      throw new Error(`Auth failed (${authResp.status}): ${await authResp.text()}`);
    }
    apiToken = (await authResp.json())?.response?.token;
    if (!apiToken) throw new Error("No token returned");

    // Date range: start of year .. one year ahead
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const oneYearAhead = new Date(now);
    oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);
    const dateRange = `${fmDate(startOfYear)}...${fmDate(oneYearAhead)}`;

    // Fetch all records (paged) — fall back to records endpoint if _find rejects field name
    const records: any[] = [];
    let offset = 1;
    const batchSize = 500;
    let usedFind = true;
    let hasMore = true;

    while (hasMore) {
      const resp = await fetchWithTimeout(
        `${baseUrl}/layouts/API_order/_find`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: [{ orderdatum: dateRange }],
            limit: String(batchSize),
            offset: String(offset),
          }),
        },
        25000,
      );
      const data = await resp.json();
      if (!resp.ok) {
        // Any non-OK response from _find (including FileMaker code 401 = "no records")
        // means we should fall back to the plain records endpoint, which works on
        // every FileMaker layout regardless of the orderdatum field's findability.
        console.warn(`_find failed (status ${resp.status}, fm code ${data?.messages?.[0]?.code}): ${JSON.stringify(data?.messages || data)}`);
        usedFind = false;
        hasMore = false;
        break;
      }
      const batch = data?.response?.data || [];
      records.push(...batch);
      if (batch.length < batchSize) hasMore = false;
      else { offset += batchSize; if (records.length >= 5000) hasMore = false; }
    }
    console.log(`Tenant ${tenantId}: _find returned ${records.length} records (usedFind=${usedFind})`);

    if (!usedFind) {
      offset = 1; hasMore = true;
      while (hasMore) {
        const resp = await fetchWithTimeout(
          `${baseUrl}/layouts/API_order/records?_offset=${offset}&_limit=${batchSize}`,
          {
            method: "GET",
            headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
          },
          25000,
        );
        const data = await resp.json();
        if (!resp.ok) {
          if (data?.messages?.[0]?.code === "401") break;
          throw new Error(`records failed (${resp.status})`);
        }
        const batch = data?.response?.data || [];
        records.push(...batch);
        if (batch.length < batchSize) hasMore = false;
        else { offset += batchSize; if (records.length >= 5000) hasMore = false; }
      }
    }

    // Map + dedupe + date filter
    const seen = new Set<string>();
    const rows: any[] = [];
    for (const rec of records) {
      const fd = rec.fieldData || {};
      const ordernummer = String(
        fd.ordernummer ?? fd.Ordernummer ?? fd.OrderNumber ?? "",
      ).trim();
      if (!ordernummer || seen.has(ordernummer)) continue;
      const orderdatumRaw = fd.orderdatum ?? fd.Orderdatum ?? "";
      const d = parseDate(orderdatumRaw);
      if (d && (d < startOfYear || d > oneYearAhead)) continue;
      seen.add(ordernummer);
      rows.push({
        tenant_id: tenantId,
        ordernummer,
        klant: fd.klant ?? fd.Klant ?? fd.klantnaam ?? fd.Klantnaam ?? null,
        klantnummer: fd.klantnummer ? String(fd.klantnummer) : null,
        orderdatum: orderdatumRaw || null,
        ordertype: fd.ordertype ?? fd.Ordertype ?? null,
        beschrijving: fd.beschrijving ?? fd.Beschrijving ?? fd.omschrijving ??
          fd.Omschrijving ?? null,
        referentie: fd.referentie ?? fd.Referentie ?? null,
        adres: fd.adres ?? fd.Adres ?? null,
        plaatsingsdatum: fd.plaatsingsdatum ?? fd.Plaatsingsdatum ?? null,
        orderverwerker: fd.orderverwerker ?? fd.Orderverwerker ?? null,
        raw: fd,
        fetched_at: new Date().toISOString(),
      });
    }

    // Replace this tenant's buffer atomically
    await supabase.from("external_orders_buffer").delete().eq("tenant_id", tenantId);
    if (rows.length > 0) {
      // Insert in chunks to stay safe with payload size
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const { error: insErr } = await supabase
          .from("external_orders_buffer")
          .insert(slice);
        if (insErr) throw insErr;
      }
    }

    await supabase.from("external_orders_sync_state").upsert({
      tenant_id: tenantId,
      last_sync_at: new Date().toISOString(),
      last_status: "ok",
      last_error: null,
      count: rows.length,
    });

    console.log(
      `Tenant ${tenantId}: synced ${rows.length} orders in ${Date.now() - startTime}ms`,
    );
    return { tenant_id: tenantId, count: rows.length };
  } catch (e: any) {
    console.error(`Tenant ${tenantId} sync failed:`, e?.message || e);
    await supabase.from("external_orders_sync_state").upsert({
      tenant_id: tenantId,
      last_sync_at: new Date().toISOString(),
      last_status: "error",
      last_error: String(e?.message || e),
    });
    return { tenant_id: tenantId, error: String(e?.message || e) };
  } finally {
    if (apiToken && baseUrl) {
      try {
        await fetchWithTimeout(`${baseUrl}/sessions/${apiToken}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        }, 5000);
      } catch (_) {}
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    let tenantIds: string[] = [];

    if (body?.tenant_id) {
      tenantIds = [body.tenant_id];
    } else {
      // Sync all tenants that have a projects API config
      const { data } = await supabase
        .from("external_api_configs")
        .select("tenant_id")
        .eq("api_type", "projects")
        .not("tenant_id", "is", null);
      tenantIds = Array.from(
        new Set((data || []).map((r: any) => r.tenant_id)),
      );
    }

    const results = [];
    for (const id of tenantIds) {
      results.push(await syncTenant(supabase, id));
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
