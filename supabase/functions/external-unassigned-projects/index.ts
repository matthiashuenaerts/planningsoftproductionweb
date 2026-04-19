// Returns external orders for a tenant that are NOT yet linked to a local project.
// Reads ONLY from the buffer table populated by `external-orders-sync` — instant.
// If the buffer is empty (first run), it triggers a sync inline.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { tenant_id } = body;
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Existing project link IDs for this tenant
    const { data: existing, error: existErr } = await supabase
      .from("projects")
      .select("project_link_id")
      .eq("tenant_id", tenant_id)
      .not("project_link_id", "is", null);
    if (existErr) console.error("[unassigned] existing err", existErr);
    const existingLinkIds = new Set(
      (existing || []).map((p: any) => String(p.project_link_id).trim()),
    );
    console.log(
      `[unassigned] tenant=${tenant_id} existing_links=${existingLinkIds.size}`,
    );

    // Read from buffer (excluding rows hidden by the team)
    const { data: buffer, error: bufErr } = await supabase
      .from("external_orders_buffer")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("hidden", false)
      .order("orderdatum", { ascending: false })
      .limit(5000);
    if (bufErr) {
      console.error("[unassigned] buffer err", bufErr);
      throw bufErr;
    }
    console.log(`[unassigned] buffer_rows=${buffer?.length ?? 0}`);

    const { data: state } = await supabase
      .from("external_orders_sync_state")
      .select("*")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    const projects = (buffer || [])
      .filter((r: any) => !existingLinkIds.has(String(r.ordernummer).trim()))
      .map((r: any) => ({
        ordernummer: r.ordernummer,
        klant: r.klant ?? "",
        klantnummer: r.klantnummer ?? "",
        orderdatum: r.orderdatum ?? "",
        ordertype: r.ordertype ?? "",
        beschrijving: r.beschrijving ?? r.referentie ?? "",
        referentie: r.referentie ?? "",
        adres: r.adres ?? "",
        plaatsingsdatum: r.plaatsingsdatum ?? "",
        orderverwerker: r.orderverwerker ?? "",
      }));

    return new Response(
      JSON.stringify({
        projects,
        count: projects.length,
        last_sync_at: state?.last_sync_at ?? null,
        last_status: state?.last_status ?? null,
        last_error: state?.last_error ?? null,
        buffered_total: buffer?.length ?? 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message || "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
