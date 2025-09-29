
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const resend = new Resend("re_R48e6VdF_G4kUfNeBa9C7Zi8e7ds6PnfW");

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

    // Get admin emails (handle multiple admin users)
    const { data: adminEmployees, error: adminError } = await supabase
      .from('employees')
      .select('email')
      .eq('role', 'admin');

    if (adminError) {
      console.error('Error fetching admin emails:', adminError);
    }

// Collect all recipients
const recipients = [employeeEmail];

// Add admin emails if they exist and are different from employee email
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

// Use full recipient list in productie
const finalRecipients = recipients;


    console.log('Sending email to:', finalRecipients);

    const emailResponse = await resend.emails.send({
      from: "Holiday System <onboarding@resend.dev>",
      to: finalRecipients,
      subject: `Holiday Request from ${employeeName}`,
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
          <p><em>This holiday request notification was sent to: ${finalRecipients.join(', ')}</em></p>
        </div>
      `,
    });

    console.log("Holiday request email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
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
