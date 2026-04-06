import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const token = authHeader.replace("Bearer ", "");

    // Check if anon key or validate user
    if (token !== anonKey) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Must be a developer
      const adminClient = createClient(supabaseUrl, serviceKey);
      const { data: emp } = await adminClient
        .from("employees")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (!emp) {
        return new Response(JSON.stringify({ error: "Not authorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: devRole } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", emp.id)
        .eq("role", "developer")
        .single();

      if (!devRole) {
        return new Response(JSON.stringify({ error: "Developer access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Get all tenants
    const { data: tenants } = await adminClient
      .from("tenants")
      .select("id, name, slug")
      .order("name");

    if (!tenants || tenants.length === 0) {
      return new Response(JSON.stringify({ tenants: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get storage objects grouped by tenant (bucket_id based paths)
    // Storage objects have metadata that includes size
    const buckets = [
      "project_files",
      "attachments",
      "personal-attachments",
      "invoices",
      "broken_parts",
      "help-media",
      "order-attachments",
      "product-images",
      "measurement-files",
    ];

    // For each tenant, compute storage usage from storage.objects
    const tenantStats = await Promise.all(
      tenants.map(async (t: any) => {
        let totalStorageBytes = 0;

        // Query storage objects that contain the tenant_id in the path
        // or belong to projects of this tenant
        for (const bucket of buckets) {
          try {
            const { data: objects } = await adminClient.storage
              .from(bucket)
              .list("", { limit: 1000 });

            // Storage list doesn't give us tenant filtering directly
            // We need to use a different approach
          } catch {
            // bucket might not exist
          }
        }

        // Better approach: count records in key tables for data usage estimation
        const [
          projectCount,
          taskCount,
          orderCount,
          employeeCount,
          scheduleCount,
          partsCount,
        ] = await Promise.all([
          adminClient.from("projects").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
          adminClient.from("tasks").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
          adminClient.from("orders").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
          adminClient.from("employees").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
          adminClient.from("gantt_schedules").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
          adminClient.from("parts_lists").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
        ]);

        return {
          tenant_id: t.id,
          tenant_name: t.name,
          tenant_slug: t.slug,
          projects: projectCount.count ?? 0,
          tasks: taskCount.count ?? 0,
          orders: orderCount.count ?? 0,
          employees: employeeCount.count ?? 0,
          schedules: scheduleCount.count ?? 0,
          parts_lists: partsCount.count ?? 0,
          total_records: (projectCount.count ?? 0) + (taskCount.count ?? 0) + (orderCount.count ?? 0) +
            (employeeCount.count ?? 0) + (scheduleCount.count ?? 0) + (partsCount.count ?? 0),
        };
      })
    );

    // Get overall database size using pg_database_size via RPC
    // Since we can't run raw SQL, we'll estimate based on record counts

    return new Response(JSON.stringify({ tenants: tenantStats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
