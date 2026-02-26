import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticketId, type } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch ticket with creator info
    const { data: ticket, error: ticketError } = await supabase
      .from("support_tickets")
      .select("*, creator:employees!support_tickets_created_by_fkey(name, email)")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new Error(`Ticket not found: ${ticketError?.message}`);
    }

    // Get tenant info
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, slug")
      .eq("id", ticket.tenant_id)
      .single();

    if (type === "new_ticket") {
      // Send email to developer
      const { error: emailError } = await resend.emails.send({
        from: "Support <noreply@automattion-compass.com>",
        to: ["matthias@automattion-compass.com"],
        subject: `[Support] New ticket: ${ticket.subject} (${tenant?.name || "Unknown tenant"})`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 20px;">
            <h1 style="color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">🎫 New Support Ticket</h1>
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
              <tr><td style="padding: 8px; font-weight: bold; width: 120px;">Tenant:</td><td style="padding: 8px;">${tenant?.name || "Unknown"}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Reported by:</td><td style="padding: 8px;">${ticket.creator?.name || "Unknown"}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Priority:</td><td style="padding: 8px;"><span style="background: ${ticket.priority === 'critical' ? '#dc2626' : ticket.priority === 'high' ? '#f59e0b' : '#3b82f6'}; color: white; padding: 2px 8px; border-radius: 4px;">${ticket.priority}</span></td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Subject:</td><td style="padding: 8px;">${ticket.subject}</td></tr>
            </table>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-top: 10px;">
              <h3 style="margin-top: 0;">Description:</h3>
              <p style="white-space: pre-wrap;">${ticket.description}</p>
            </div>
            <p style="color: #64748b; font-size: 12px; margin-top: 20px;">Respond via the Developer Portal.</p>
          </div>
        `,
      });

      if (emailError) {
        console.error("Email error:", emailError);
      }
    } else if (type === "developer_response") {
      // Send email to user who created the ticket
      const userEmail = ticket.creator?.email;
      if (userEmail) {
        const { data: latestMessage } = await supabase
          .from("support_messages")
          .select("message, sender:employees!support_messages_sender_id_fkey(name)")
          .eq("ticket_id", ticketId)
          .eq("sender_type", "developer")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        await resend.emails.send({
          from: "Support <noreply@automattion-compass.com>",
          to: [userEmail],
          subject: `[Support] Update on: ${ticket.subject}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 20px;">
              <h1 style="color: #1e40af;">📬 Support Ticket Update</h1>
              <p>Your support ticket "<strong>${ticket.subject}</strong>" has a new response:</p>
              <div style="background: #f0f9ff; padding: 15px; border-left: 4px solid #3b82f6; border-radius: 4px; margin: 15px 0;">
                <p style="margin: 0; white-space: pre-wrap;">${latestMessage?.message || ""}</p>
                <p style="color: #64748b; font-size: 12px; margin-top: 8px;">— ${latestMessage?.sender?.name || "Support Team"}</p>
              </div>
            </div>
          `,
        });
      }

      // Create in-app notification
      await supabase.from("notifications").insert({
        user_id: ticket.created_by,
        message: `Support ticket "${ticket.subject}" has a new response`,
        link: null,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
