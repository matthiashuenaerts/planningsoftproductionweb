
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

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

    // Fetch email configuration with language from database
    const { data: emailConfig, error: configError } = await supabase
      .from('email_configurations')
      .select('recipient_emails, language')
      .eq('function_name', 'holiday_request')
      .single();

    if (configError) {
      console.error('Error fetching email configuration:', configError);
    }

    const language = emailConfig?.language || 'nl';
    console.log(`Using language: ${language} for email`);

    // Define translations
    const translations: Record<string, any> = {
      nl: {
        subject: (name: string) => `Vakantieaanvraag van ${name}`,
        title: 'Vakantieaanvraag Ingediend',
        employee: 'Werknemer:',
        email: 'E-mail:',
        startDate: 'Startdatum:',
        endDate: 'Einddatum:',
        reason: 'Reden:',
        requestId: 'Aanvraag ID:',
        footer: 'Deze aanvraag is ingediend en wacht op goedkeuring.',
        sentTo: 'Deze vakantieaanvraag is verzonden naar:'
      },
      en: {
        subject: (name: string) => `Holiday Request from ${name}`,
        title: 'Holiday Request Submitted',
        employee: 'Employee:',
        email: 'Email:',
        startDate: 'Start Date:',
        endDate: 'End Date:',
        reason: 'Reason:',
        requestId: 'Request ID:',
        footer: 'This request has been submitted and is pending approval.',
        sentTo: 'This holiday request notification was sent to:'
      },
      fr: {
        subject: (name: string) => `Demande de Vacances de ${name}`,
        title: 'Demande de Vacances Soumise',
        employee: 'Employé:',
        email: 'E-mail:',
        startDate: 'Date de Début:',
        endDate: 'Date de Fin:',
        reason: 'Raison:',
        requestId: 'ID de Demande:',
        footer: 'Cette demande a été soumise et est en attente d\'approbation.',
        sentTo: 'Cette notification de demande de vacances a été envoyée à:'
      }
    };

    const t = translations[language];

    // Get configured recipient emails or use default
    const configuredEmails = emailConfig?.recipient_emails || ['productiesturing@thonon.be'];

    // Collect all recipients and trim whitespace
    const recipients = [employeeEmail.trim()];

    // Add configured emails
    configuredEmails.forEach(email => {
      const trimmedEmail = email.trim();
      if (trimmedEmail && !recipients.includes(trimmedEmail)) {
        recipients.push(trimmedEmail);
      }
    });

    const finalRecipients = recipients;

    console.log('Sending email to:', finalRecipients);

    const emailResponse = await resend.emails.send({
      from: "Holiday System <noreply@automattion-compass.com>",
      to: finalRecipients,
      subject: t.subject(employeeName),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">${t.title}</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>${t.employee}</strong> ${employeeName}</p>
            <p><strong>${t.email}</strong> ${employeeEmail}</p>
            <p><strong>${t.startDate}</strong> ${new Date(startDate).toLocaleDateString()}</p>
            <p><strong>${t.endDate}</strong> ${new Date(endDate).toLocaleDateString()}</p>
            ${reason ? `<p><strong>${t.reason}</strong> ${reason}</p>` : ''}
            <p><strong>${t.requestId}</strong> ${requestId}</p>
          </div>
          <p>${t.footer}</p>
          <p><em>${t.sentTo} ${finalRecipients.join(', ')}</em></p>
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