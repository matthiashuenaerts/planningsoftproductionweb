const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, projectName, projectId, employeeName, recipients, tenantId, serviceDescription } = await req.json();

    console.log('Received request:', { type, projectName, projectId, employeeName, recipientCount: recipients?.length, tenantId });

    if (!recipients || recipients.length === 0) {
      console.log('No recipients configured, skipping email');
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

    const serviceBlock = serviceDescription
      ? `<p><strong>Beschrijving openstaande punten:</strong></p><p style="background:#fff3cd;padding:12px;border-radius:6px;border-left:4px solid #ffc107;">${serviceDescription.replace(/\n/g, '<br/>')}</p>`
      : '';

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
         ${serviceBlock}
         <p>De installatie is afgerond maar er zijn nog openstaande punten die een service ticket vereisen. Gelieve dit in te plannen.</p>`;

    console.log('Sending email to:', recipients, 'Subject:', subject);

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
    console.log('Resend API response:', JSON.stringify(result), 'Status:', res.status);

    if (!res.ok) {
      console.error('Resend API error:', result);
      return new Response(JSON.stringify({ error: 'Failed to send email', details: result }), {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
