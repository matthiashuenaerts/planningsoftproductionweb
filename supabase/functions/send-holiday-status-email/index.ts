
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

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

// Define translations
const translations: Record<string, any> = {
  nl: {
    subject: (status: string, name: string) => `Verlofaanvraag ${status === 'approved' ? 'Goedgekeurd' : 'Afgewezen'}: ${name}`,
    titleApproved: 'Verlofaanvraag Goedgekeurd',
    titleRejected: 'Verlofaanvraag Afgewezen',
    employee: 'Medewerker:',
    email: 'E-mail:',
    startDate: 'Startdatum:',
    endDate: 'Einddatum:',
    reason: 'Reden:',
    status: 'Status:',
    statusApproved: 'GOEDGEKEURD',
    statusRejected: 'AFGEWEZEN',
    adminNotes: 'Opmerkingen Beheerder:',
    requestId: 'Aanvraag ID:',
    notificationSent: 'Deze melding is verzonden naar:',
  },
  en: {
    subject: (status: string, name: string) => `Holiday Request ${status === 'approved' ? 'Approved' : 'Rejected'}: ${name}`,
    titleApproved: 'Holiday Request Approved',
    titleRejected: 'Holiday Request Rejected',
    employee: 'Employee:',
    email: 'Email:',
    startDate: 'Start Date:',
    endDate: 'End Date:',
    reason: 'Reason:',
    status: 'Status:',
    statusApproved: 'APPROVED',
    statusRejected: 'REJECTED',
    adminNotes: 'Admin Notes:',
    requestId: 'Request ID:',
    notificationSent: 'This notification was sent to:',
  },
  fr: {
    subject: (status: string, name: string) => `Demande de Congé ${status === 'approved' ? 'Approuvée' : 'Refusée'}: ${name}`,
    titleApproved: 'Demande de Congé Approuvée',
    titleRejected: 'Demande de Congé Refusée',
    employee: 'Employé:',
    email: 'E-mail:',
    startDate: 'Date de Début:',
    endDate: 'Date de Fin:',
    reason: 'Raison:',
    status: 'Statut:',
    statusApproved: 'APPROUVÉE',
    statusRejected: 'REFUSÉE',
    adminNotes: 'Notes de l\'Administrateur:',
    requestId: 'ID de Demande:',
    notificationSent: 'Cette notification a été envoyée à:',
  }
};

const getDateLocale = (language: string): string => {
  switch (language) {
    case 'nl': return 'nl-BE';
    case 'fr': return 'fr-BE';
    default: return 'en-US';
  }
};

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

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch email configuration from database
    const { data: emailConfig, error: configError } = await supabase
      .from('email_configurations')
      .select('recipient_emails, language')
      .eq('function_name', 'holiday_status')
      .single();

    if (configError) {
      console.error('Error fetching email configuration:', configError);
    }

    // Get configured recipient emails or use default
    const configuredEmails = emailConfig?.recipient_emails || ['productiesturing@thonon.be'];
    const language = emailConfig?.language || 'nl';
    const t = translations[language] || translations.nl;
    const dateLocale = getDateLocale(language);

    console.log(`Using language: ${language} for email generation`);

    // Collect all recipients and trim whitespace
    const recipients = [employeeEmail.trim()];

    // Add configured emails
    configuredEmails.forEach((email: string) => {
      const trimmedEmail = email.trim();
      if (trimmedEmail && !recipients.includes(trimmedEmail)) {
        recipients.push(trimmedEmail);
      }
    });

    console.log('Sending status email to:', recipients);

    const statusColor = status === 'approved' ? '#10b981' : '#ef4444';
    const statusText = status === 'approved' ? t.statusApproved : t.statusRejected;
    const title = status === 'approved' ? t.titleApproved : t.titleRejected;

    const emailResponse = await resend.emails.send({
      from: "Holiday System <noreply@automattion-compass.com>",
      to: recipients,
      subject: t.subject(status, employeeName),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${statusColor};">${title}</h2>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${statusColor};">
            <p><strong>${t.employee}</strong> ${employeeName}</p>
            <p><strong>${t.email}</strong> ${employeeEmail}</p>
            <p><strong>${t.startDate}</strong> ${new Date(startDate).toLocaleDateString(dateLocale, { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
            <p><strong>${t.endDate}</strong> ${new Date(endDate).toLocaleDateString(dateLocale, { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
            ${reason ? `<p><strong>${t.reason}</strong> ${reason}</p>` : ''}
            <p><strong>${t.status}</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span></p>
            ${adminNotes ? `
              <div style="margin-top: 15px; padding: 15px; background-color: #fff; border-radius: 4px;">
                <p style="margin: 0;"><strong>${t.adminNotes}</strong></p>
                <p style="margin: 5px 0 0 0;">${adminNotes}</p>
              </div>
            ` : ''}
            <p><strong>${t.requestId}</strong> ${requestId}</p>
          </div>
          <p>${t.notificationSent} ${recipients.join(', ')}</p>
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
