import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting project forecast email process...");

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to get tenant_id from request body
    let tenantId: string | null = null;
    try {
      const body = await req.json();
      tenantId = body?.tenantId || null;
    } catch {
      // No body or invalid JSON, proceed without tenant filter
    }

    // Get email configuration - filter by tenant if available
    let emailQuery = supabase
      .from('email_configurations')
      .select('recipient_emails, tenant_id')
      .eq('function_name', 'send_project_forecast');
    
    if (tenantId) {
      emailQuery = emailQuery.eq('tenant_id', tenantId);
    }

    const { data: emailConfig, error: configError } = await emailQuery.single();

    if (configError || !emailConfig) {
      console.error('Error fetching email configuration:', configError);
      return new Response(
        JSON.stringify({ error: 'Email configuration not found' }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use the resolved tenant_id from the config if not provided
    const resolvedTenantId = tenantId || emailConfig.tenant_id;

    // Get schedule configuration
    let schedQuery = supabase
      .from('email_schedule_configs')
      .select('*')
      .eq('function_name', 'send_project_forecast')
      .eq('is_active', true);
    
    if (resolvedTenantId) {
      schedQuery = schedQuery.eq('tenant_id', resolvedTenantId);
    }

    const { data: scheduleConfig, error: scheduleError } = await schedQuery.single();

    if (scheduleError || !scheduleConfig) {
      console.error('Error fetching schedule configuration:', scheduleError);
      return new Response(
        JSON.stringify({ error: 'Schedule configuration not found' }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const forecastWeeks = scheduleConfig.forecast_weeks || 2;
    const recipients = emailConfig.recipient_emails || [];
    const language = scheduleConfig.language || 'nl';

    console.log(`Using language: ${language} for email generation`);

    if (recipients.length === 0) {
      console.log('No recipients configured, skipping email');
      return new Response(
        JSON.stringify({ message: 'No recipients configured' }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Calculate date range
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + (forecastWeeks * 7));

    console.log(`Fetching projects with installation dates between ${today.toISOString()} and ${futureDate.toISOString()}`);

    // Fetch projects within the forecast period, filtered by tenant
    let projectQuery = supabase
      .from('projects')
      .select('id, name, client, installation_date, status, description')
      .gte('installation_date', today.toISOString().split('T')[0])
      .lte('installation_date', futureDate.toISOString().split('T')[0])
      .order('installation_date', { ascending: true });
    
    if (resolvedTenantId) {
      projectQuery = projectQuery.eq('tenant_id', resolvedTenantId);
    }

    const { data: projects, error: projectsError } = await projectQuery;

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
      throw projectsError;
    }

    // Define translations
    const translations: Record<string, any> = {
      nl: {
        subject: (count: number, weeks: number) => count === 0 
          ? `Project Prognose - Geen Projecten in de Komende ${weeks} Weken`
          : `Project Prognose - ${count} Projecten in de Komende ${weeks} Weken`,
        title: (weeks: number) => `📊 Project Prognose - Komende ${weeks} Weken`,
        period: 'Periode:',
        totalProjects: 'Totaal Projecten:',
        totalOrders: 'Totaal Openstaande Bestellingen:',
        client: 'Klant:',
        installationDate: 'Plaatsingsdatum:',
        status: 'Status:',
        description: 'Beschrijving:',
        undeliveredOrders: (count: number) => `📦 Openstaande Bestellingen (${count})`,
        supplier: 'Leverancier:',
        orderType: 'Besteltype:',
        orderDate: 'Besteldatum:',
        expectedDelivery: 'Verwachte Levering:',
        orderNumber: 'Bestelnummer:',
        notes: 'Notities:',
        items: (count: number) => `Items (${count})`,
        articleCode: 'Artikelcode:',
        ean: 'EAN:',
        ordered: 'Besteld:',
        delivered: 'Geleverd:',
        remaining: 'Resterend:',
        location: 'Locatie:',
        noItems: 'Geen items vermeld',
        noOrders: '✅ Geen openstaande bestellingen',
        noProjects: (weeks: number) => `Er zijn geen projecten gepland voor plaatsing in de komende ${weeks} weken.`,
        noteFooter: 'Dit is een geautomatiseerde wekelijkse prognose. Controleer alle bestellingen en neem indien nodig contact op met leveranciers.'
      },
      en: {
        subject: (count: number, weeks: number) => count === 0 
          ? `Project Forecast - No Projects in Next ${weeks} Weeks`
          : `Project Forecast - ${count} Projects in Next ${weeks} Weeks`,
        title: (weeks: number) => `📊 Project Forecast - Next ${weeks} Weeks`,
        period: 'Period:',
        totalProjects: 'Total Projects:',
        totalOrders: 'Total Undelivered Orders:',
        client: 'Client:',
        installationDate: 'Installation Date:',
        status: 'Status:',
        description: 'Description:',
        undeliveredOrders: (count: number) => `📦 Undelivered Orders (${count})`,
        supplier: 'Supplier:',
        orderType: 'Order Type:',
        orderDate: 'Order Date:',
        expectedDelivery: 'Expected Delivery:',
        orderNumber: 'Order Number:',
        notes: 'Notes:',
        items: (count: number) => `Items (${count})`,
        articleCode: 'Article Code:',
        ean: 'EAN:',
        ordered: 'Ordered:',
        delivered: 'Delivered:',
        remaining: 'Remaining:',
        location: 'Location:',
        noItems: 'No items listed',
        noOrders: '✅ No undelivered orders',
        noProjects: (weeks: number) => `There are no projects scheduled for installation in the next ${weeks} weeks.`,
        noteFooter: 'This is an automated weekly forecast. Please review all orders and contact suppliers if needed.'
      },
      fr: {
        subject: (count: number, weeks: number) => count === 0 
          ? `Prévision Projet - Aucun Projet dans les ${weeks} Prochaines Semaines`
          : `Prévision Projet - ${count} Projets dans les ${weeks} Prochaines Semaines`,
        title: (weeks: number) => `📊 Prévision Projet - ${weeks} Prochaines Semaines`,
        period: 'Période:',
        totalProjects: 'Total Projets:',
        totalOrders: 'Total Commandes Non Livrées:',
        client: 'Client:',
        installationDate: 'Date d\'Installation:',
        status: 'Statut:',
        description: 'Description:',
        undeliveredOrders: (count: number) => `📦 Commandes Non Livrées (${count})`,
        supplier: 'Fournisseur:',
        orderType: 'Type de Commande:',
        orderDate: 'Date de Commande:',
        expectedDelivery: 'Livraison Prévue:',
        orderNumber: 'Numéro de Commande:',
        notes: 'Notes:',
        items: (count: number) => `Articles (${count})`,
        articleCode: 'Code Article:',
        ean: 'EAN:',
        ordered: 'Commandé:',
        delivered: 'Livré:',
        remaining: 'Restant:',
        location: 'Emplacement:',
        noItems: 'Aucun article répertorié',
        noOrders: '✅ Aucune commande non livrée',
        noProjects: (weeks: number) => `Il n'y a aucun projet prévu pour installation dans les ${weeks} prochaines semaines.`,
        noteFooter: 'Ceci est une prévision hebdomadaire automatisée. Veuillez vérifier toutes les commandes et contacter les fournisseurs si nécessaire.'
      }
    };

    const t = translations[language];

    console.log(`Found ${projects?.length || 0} projects in forecast period`);

    if (!projects || projects.length === 0) {
      // Send email indicating no projects in the forecast period
      await resend.emails.send({
        from: "Project Forecast <noreply@automattion-compass.com>",
        to: recipients,
        subject: t.subject(0, forecastWeeks),
        html: `
          <h1>${t.title(forecastWeeks)}</h1>
          <p>${t.noProjects(forecastWeeks)}</p>
          <p>${t.period} ${today.toLocaleDateString()} - ${futureDate.toLocaleDateString()}</p>
        `,
      });

      return new Response(
        JSON.stringify({ message: 'No projects in forecast period, notification sent' }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch undelivered orders for each project
    const projectsWithOrders = await Promise.all(
      projects.map(async (project) => {
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select(`
            id,
            supplier,
            order_date,
            expected_delivery,
            status,
            notes,
            order_type,
            external_order_number,
            order_items (
              id,
              description,
              quantity,
              delivered_quantity,
              article_code,
              notes,
              stock_location,
              ean
            )
          `)
          .eq('project_id', project.id)
          .neq('status', 'delivered')
          .neq('status', 'canceled');

        if (ordersError) {
          console.error(`Error fetching orders for project ${project.id}:`, ordersError);
          return { ...project, orders: [], hasUndeliveredItems: false };
        }

        // Filter orders to only include those with undelivered items
        const ordersWithUndeliveredItems = (orders || []).map(order => {
          const undeliveredItems = (order.order_items || []).filter(
            item => item.quantity > (item.delivered_quantity || 0)
          );
          return { ...order, order_items: undeliveredItems };
        }).filter(order => order.order_items.length > 0);

        // Check if project has any undelivered items
        const hasUndeliveredItems = ordersWithUndeliveredItems.length > 0;

        return { 
          ...project, 
          orders: ordersWithUndeliveredItems,
          hasUndeliveredItems 
        };
      })
    );

    // Generate HTML email content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #2563eb; border-bottom: 3px solid #2563eb; padding-bottom: 10px; }
          h2 { color: #1e40af; margin-top: 30px; }
          h3 { color: #475569; margin-top: 20px; }
          .project { background: #f8fafc; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #2563eb; }
          .project-delivered { border-left: 4px solid #16a34a !important; }
          .project-undelivered { border-left: 4px solid #dc2626 !important; }
          .order { background: #fff; padding: 15px; margin: 15px 0; border-radius: 6px; border: 1px solid #e2e8f0; }
          .order-item { background: #f1f5f9; padding: 10px; margin: 10px 0; border-radius: 4px; }
          .status { padding: 4px 8px; border-radius: 4px; font-weight: bold; display: inline-block; }
          .status-pending { background: #fef3c7; color: #92400e; }
          .status-delayed { background: #fee2e2; color: #991b1b; }
          .status-partially_delivered { background: #dbeafe; color: #1e40af; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #e2e8f0; }
          th { background: #f1f5f9; font-weight: bold; width: 200px; }
          td { width: auto; }
          .summary { background: #eff6ff; padding: 15px; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${t.title(forecastWeeks)}</h1>
          <div class="summary">
            <strong>${t.period}</strong> ${today.toLocaleDateString()} - ${futureDate.toLocaleDateString()}<br>
            <strong>${t.totalProjects}</strong> ${projectsWithOrders.length}<br>
            <strong>${t.totalOrders}</strong> ${projectsWithOrders.reduce((acc, p) => acc + p.orders.length, 0)}
          </div>

          ${projectsWithOrders.map(project => {
            const borderColor = project.hasUndeliveredItems ? '#dc2626' : '#16a34a';
            return `
              <div class="project" style="border-left: 4px solid ${borderColor};">
                <h2>🏗️ ${project.name}</h2>
                <table>
                  <tr><th>${t.client}</th><td>${project.client || 'N/A'}</td></tr>
                  <tr><th>${t.installationDate}</th><td>${new Date(project.installation_date).toLocaleDateString()}</td></tr>
                  <tr><th>${t.status}</th><td><span class="status status-${project.status}">${project.status}</span></td></tr>
                  ${project.description ? `<tr><th>${t.description}</th><td>${project.description}</td></tr>` : ''}
                </table>

                ${project.orders.length > 0 ? `
                  <h3>${t.undeliveredOrders(project.orders.length)}</h3>
                  ${project.orders.map(order => `
                    <div class="order">
                      <strong>${t.supplier}</strong> ${order.supplier}<br>
                      <strong>${t.orderType}</strong> ${order.order_type}<br>
                      <strong>${t.orderDate}</strong> ${new Date(order.order_date).toLocaleDateString()}<br>
                      <strong>${t.expectedDelivery}</strong> ${new Date(order.expected_delivery).toLocaleDateString()}<br>
                      <strong>${t.status}</strong> <span class="status status-${order.status}">${order.status}</span><br>
                      ${order.external_order_number ? `<strong>${t.orderNumber}</strong> ${order.external_order_number}<br>` : ''}
                      ${order.notes ? `<strong>${t.notes}</strong> ${order.notes}<br>` : ''}

                      ${order.order_items && order.order_items.length > 0 ? `
                        <h4>${t.items(order.order_items.length)}</h4>
                        ${order.order_items.map(item => `
                          <div class="order-item">
                            <strong>${item.description}</strong><br>
                            ${item.article_code ? `${t.articleCode} ${item.article_code}<br>` : ''}
                            ${item.ean ? `${t.ean} ${item.ean}<br>` : ''}
                            ${t.ordered} ${item.quantity} | ${t.delivered} ${item.delivered_quantity || 0} | 
                            <strong>${t.remaining} ${item.quantity - (item.delivered_quantity || 0)}</strong><br>
                            ${item.stock_location ? `${t.location} ${item.stock_location}<br>` : ''}
                            ${item.notes ? `${t.notes} ${item.notes}` : ''}
                          </div>
                        `).join('')}
                      ` : `<p>${t.noItems}</p>`}
                    </div>
                  `).join('')}
                ` : `<p>${t.noOrders}</p>`}
              </div>
            `;
          }).join('')}

          <div class="summary">
            <p><strong>${t.notes}</strong> ${t.noteFooter}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email
    console.log(`Sending forecast email to ${recipients.length} recipient(s)`);
    const emailResponse = await resend.emails.send({
      from: "Project Forecast <noreply@automattion-compass.com>",
      to: recipients,
      subject: t.subject(projectsWithOrders.length, forecastWeeks),
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        projectCount: projectsWithOrders.length,
        recipients: recipients.length 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-project-forecast function:", error);
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
