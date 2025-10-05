
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface HolidayStatusEmailData {
  employeeName: string;
  employeeEmail: string;
  startDate: string;
  endDate: string;
  reason?: string;
  status: 'approved' | 'rejected';
  adminNotes?: string;
  requestId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      employeeName, 
      employeeEmail, 
      startDate, 
      endDate, 
      reason, 
      status,
      adminNotes,
      requestId 
    }: HolidayStatusEmailData = await req.json();

    // Recipients: productiesturing@thonon.be and the employee
    const productiesturingEmail = "productiesturing@thonon.be";
    const recipients = [employeeEmail.trim(), productiesturingEmail].filter((email, index, arr) => 
      email && arr.indexOf(email) === index
    );

    console.log('Sending status email to:', recipients);

    const statusText = status === 'approved' ? 'Approved' : 'Rejected';
    const statusColor = status === 'approved' ? '#10b981' : '#ef4444';

    const emailResponse = await resend.emails.send({
      from: "Holiday System <noreply@automattion-compass.com>",
      to: recipients,
      subject: `Holiday Request ${statusText}: ${employeeName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${statusColor};">Holiday Request ${statusText}</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${statusColor};">
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
            <p><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusText.toUpperCase()}</span></p>
            ${adminNotes ? `
              <div style="margin-top: 15px; padding: 15px; background-color: #fff; border-radius: 4px;">
                <p style="margin: 0;"><strong>Admin Notes:</strong></p>
                <p style="margin: 5px 0 0 0;">${adminNotes}</p>
              </div>
            ` : ''}
            <p><strong>Request ID:</strong> ${requestId}</p>
          </div>
          <p>This notification was sent to: ${recipients.join(', ')}</p>
        </div>
      `,
    });

    console.log("Holiday status email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending holiday status email:", error);
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
