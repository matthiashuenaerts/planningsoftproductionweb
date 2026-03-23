import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action_type, error_message, summary, tenant_id, details } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get tenant name
    let tenantName = "Unknown";
    if (tenant_id) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", tenant_id)
        .single();
      if (tenant) tenantName = tenant.name;
    }

    // Get all developer emails (support members)
    const { data: developers } = await supabase
      .from("user_roles")
      .select("user_id, employees!inner(email, name)")
      .eq("role", "developer");

    const recipients = (developers ?? [])
      .map((d: any) => d.employees?.email)
      .filter(Boolean) as string[];

    if (recipients.length === 0) {
      // Fallback
      recipients.push("matthias@automattion-compass.com");
    }

    const actionLabels: Record<string, string> = {
      midnight_scheduler: "🕛 Midnight Scheduler",
      forecast_email: "📊 Forecast Email",
      project_sync: "🔄 Project Sync",
      order_sync: "📦 Order Sync",
    };

    const label = actionLabels[action_type] || action_type;
    const timestamp = new Date().toLocaleString("en-GB", { timeZone: "Europe/Brussels" });

    const { error: emailError } = await resend.emails.send({
      from: "System Alerts <noreply@automattion-compass.com>",
      to: recipients,
      subject: `⚠️ Error: ${label} failed${tenant_id ? ` (${tenantName})` : ""}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #dc2626; border-bottom: 3px solid #dc2626; padding-bottom: 10px;">⚠️ Automation Error</h1>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <tr><td style="padding: 8px; font-weight: bold; width: 140px;">Action:</td><td style="padding: 8px;">${label}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Tenant:</td><td style="padding: 8px;">${tenantName}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Time:</td><td style="padding: 8px;">${timestamp}</td></tr>
            ${summary ? `<tr><td style="padding: 8px; font-weight: bold;">Summary:</td><td style="padding: 8px;">${summary}</td></tr>` : ""}
          </table>
          <div style="background: #fef2f2; padding: 15px; border-radius: 8px; border-left: 4px solid #dc2626; margin-top: 10px;">
            <h3 style="margin-top: 0; color: #991b1b;">Error Details:</h3>
            <pre style="white-space: pre-wrap; color: #991b1b; font-size: 13px;">${error_message || "No error message provided"}</pre>
          </div>
          ${details ? `
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-top: 10px;">
            <h3 style="margin-top: 0;">Additional Details:</h3>
            <pre style="white-space: pre-wrap; font-size: 12px; color: #475569;">${JSON.stringify(details, null, 2)}</pre>
          </div>` : ""}
          <p style="color: #64748b; font-size: 12px; margin-top: 20px;">Check the Developer Portal for more details.</p>
        </div>
      `,
    });

    if (emailError) {
      console.error("Failed to send error alert email:", emailError);
    } else {
      console.log(`Error alert sent to ${recipients.length} recipients for ${action_type}`);
    }

    // Log to automation_logs
    try {
      await supabase.from('automation_logs').insert({
        action_type: 'error_alert',
        status: emailError ? 'error' : 'success',
        summary: `Error alert sent for ${action_type}: ${summary || 'No summary'}`,
        error_message: emailError ? String(emailError) : null,
      });
    } catch (_) {}

    return new Response(JSON.stringify({ success: true, recipients: recipients.length }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-error-alert:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
