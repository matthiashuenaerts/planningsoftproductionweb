
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface HolidayRequestEmailData {
  employeeName: string;
  startDate: string;
  endDate: string;
  reason?: string;
  requestId: string;
  senderEmail: string;
  recipientEmail: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      employeeName, 
      startDate, 
      endDate, 
      reason, 
      requestId, 
      senderEmail, 
      recipientEmail 
    }: HolidayRequestEmailData = await req.json();

    console.log('Sending email from:', senderEmail, 'to:', recipientEmail);

    const emailResponse = await resend.emails.send({
      from: `Holiday Requests <${senderEmail}>`,
      to: [recipientEmail],
      subject: `Nieuwe vakantieaanvraag van ${employeeName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Nieuwe Vakantieaanvraag</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Medewerker:</strong> ${employeeName}</p>
            <p><strong>Startdatum:</strong> ${new Date(startDate).toLocaleDateString('nl-NL', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
            <p><strong>Einddatum:</strong> ${new Date(endDate).toLocaleDateString('nl-NL', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
            ${reason ? `<p><strong>Reden:</strong> ${reason}</p>` : ''}
          </div>
          <p>Gelieve deze aanvraag te beoordelen en goed te keuren/af te wijzen in het systeem.</p>
          <p style="color: #666; font-size: 12px;">Aanvraag ID: ${requestId}</p>
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
