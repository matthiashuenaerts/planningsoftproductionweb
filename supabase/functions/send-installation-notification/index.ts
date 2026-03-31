import { corsHeaders } from '../_shared/cors.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, projectName, projectId, employeeName, recipients, tenantId } = await req.json();

    if (!recipients || recipients.length === 0) {
      return new Response(JSON.stringify({ message: 'No recipients configured' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isCompleted = type === 'installation_completed';
    const subject = isCompleted
      ? `✅ Installatie voltooid: ${projectName}`
      : `🔧 Service ticket nodig: ${projectName}`;

    const body = isCompleted
      ? `<h2>Installatie Voltooid</h2>
         <p><strong>Project:</strong> ${projectName}</p>
         <p><strong>Afgerond door:</strong> ${employeeName}</p>
         <p><strong>Datum:</strong> ${new Date().toLocaleDateString('nl-BE')}</p>
         <p>De installatie is volledig afgerond. Er zijn geen openstaande punten.</p>`
      : `<h2>Service Ticket Nodig</h2>
         <p><strong>Project:</strong> ${projectName}</p>
         <p><strong>Gemeld door:</strong> ${employeeName}</p>
         <p><strong>Datum:</strong> ${new Date().toLocaleDateString('nl-BE')}</p>
         <p>De installatie is afgerond maar er zijn nog openstaande punten die een service ticket vereisen. Gelieve dit in te plannen.</p>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'PlanningSoft <noreply@planningsoftproduction.be>',
        to: recipients,
        subject,
        html: body,
      }),
    });

    const result = await res.json();
    console.log('Email sent:', result);

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error sending installation notification:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
