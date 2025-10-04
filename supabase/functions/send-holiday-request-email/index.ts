import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface HolidayRequestEmailData {
  employeeName: string;
  employeeEmail: string;
  startDate: string;
  endDate: string;
  reason?: string;
  requestId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { employeeName, employeeEmail, startDate, endDate, reason, requestId }: HolidayRequestEmailData = await req.json();

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get email configuration
    const { data: emailConfig, error: configError } = await supabase
      .from('email_config')
      .select('*')
      .single();

    if (configError || !emailConfig) {
      console.error('Error fetching email config:', configError);
      return new Response(
        JSON.stringify({ error: 'Email configuration not set up. Please configure email settings in Settings > Mail.' }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get admin emails
    const { data: adminEmployees, error: adminError } = await supabase
      .from('employees')
      .select('email')
      .eq('role', 'admin');

    if (adminError) {
      console.error('Error fetching admin emails:', adminError);
    }

    // Collect all recipients
    const recipients = [employeeEmail];

    // Add admin emails
    if (adminEmployees && adminEmployees.length > 0) {
      adminEmployees.forEach(admin => {
        if (admin.email && admin.email !== employeeEmail && !recipients.includes(admin.email)) {
          recipients.push(admin.email);
        }
      });
    }

    // Always add productiesturing
    if (!recipients.includes("productiesturing@thonon.be")) {
      recipients.push("productiesturing@thonon.be");
    }

    console.log('Sending email to:', recipients);

    // Create SMTP client
    const client = new SMTPClient({
      connection: {
        hostname: emailConfig.smtp_host,
        port: emailConfig.smtp_port,
        tls: emailConfig.smtp_secure,
        auth: {
          username: emailConfig.smtp_user,
          password: emailConfig.smtp_password,
        },
      },
    });

    // Send email to all recipients
    await client.send({
      from: `${emailConfig.from_name} <${emailConfig.from_email}>`,
      to: recipients.join(', '),
      subject: `Holiday Request from ${employeeName}`,
      content: "auto",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Holiday Request Submitted</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Employee:</strong> ${employeeName}</p>
            <p><strong>Email:</strong> ${employeeEmail}</p>
            <p><strong>Start Date:</strong> ${new Date(startDate).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
            <p><strong>End Date:</strong> ${new Date(endDate).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
            <p><strong>Request ID:</strong> ${requestId}</p>
          </div>
          <p>This request has been submitted and is pending approval.</p>
          <p><em>This holiday request notification was sent to: ${recipients.join(', ')}</em></p>
        </div>
      `,
    });

    await client.close();

    console.log("Holiday request email sent successfully");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending holiday request email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
