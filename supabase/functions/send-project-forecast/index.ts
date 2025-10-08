import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
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

    // Get email configuration
    const { data: emailConfig, error: configError } = await supabase
      .from('email_configurations')
      .select('recipient_emails')
      .eq('function_name', 'send_project_forecast')
      .single();

    if (configError || !emailConfig) {
      console.error('Error fetching email configuration:', configError);
      return new Response(
        JSON.stringify({ error: 'Email configuration not found' }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get schedule configuration
    const { data: scheduleConfig, error: scheduleError } = await supabase
      .from('email_schedule_configs')
      .select('*')
      .eq('function_name', 'send_project_forecast')
      .eq('is_active', true)
      .single();

    if (scheduleError || !scheduleConfig) {
      console.error('Error fetching schedule configuration:', scheduleError);
      return new Response(
        JSON.stringify({ error: 'Schedule configuration not found' }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const forecastWeeks = scheduleConfig.forecast_weeks || 2;
    const recipients = emailConfig.recipient_emails || [];

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

    // Fetch projects within the forecast period
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name, client, installation_date, status, description')
      .gte('installation_date', today.toISOString().split('T')[0])
      .lte('installation_date', futureDate.toISOString().split('T')[0])
      .order('installation_date', { ascending: true });

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
      throw projectsError;
    }

    console.log(`Found ${projects?.length || 0} projects in forecast period`);

    if (!projects || projects.length === 0) {
      // Send email indicating no projects in the forecast period
      await resend.emails.send({
        from: "Project Forecast <onboarding@resend.dev>",
        to: recipients,
        subject: `Project Forecast - No Projects in Next ${forecastWeeks} Weeks`,
        html: `
          <h1>Project Forecast</h1>
          <p>There are no projects scheduled for installation in the next ${forecastWeeks} weeks.</p>
          <p>Period: ${today.toLocaleDateString()} - ${futureDate.toLocaleDateString()}</p>
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
          return { ...project, orders: [] };
        }

        return { ...project, orders: orders || [] };
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
          .order { background: #fff; padding: 15px; margin: 15px 0; border-radius: 6px; border: 1px solid #e2e8f0; }
          .order-item { background: #f1f5f9; padding: 10px; margin: 10px 0; border-radius: 4px; }
          .status { padding: 4px 8px; border-radius: 4px; font-weight: bold; display: inline-block; }
          .status-pending { background: #fef3c7; color: #92400e; }
          .status-delayed { background: #fee2e2; color: #991b1b; }
          .status-partially_delivered { background: #dbeafe; color: #1e40af; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #e2e8f0; }
          th { background: #f1f5f9; font-weight: bold; }
          .summary { background: #eff6ff; padding: 15px; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📊 Project Forecast - Next ${forecastWeeks} Weeks</h1>
          <div class="summary">
            <strong>Period:</strong> ${today.toLocaleDateString()} - ${futureDate.toLocaleDateString()}<br>
            <strong>Total Projects:</strong> ${projectsWithOrders.length}<br>
            <strong>Total Undelivered Orders:</strong> ${projectsWithOrders.reduce((acc, p) => acc + p.orders.length, 0)}
          </div>

          ${projectsWithOrders.map(project => `
            <div class="project">
              <h2>🏗️ ${project.name}</h2>
              <table>
                <tr><th>Client:</th><td>${project.client || 'N/A'}</td></tr>
                <tr><th>Installation Date:</th><td>${new Date(project.installation_date).toLocaleDateString()}</td></tr>
                <tr><th>Status:</th><td><span class="status status-${project.status}">${project.status}</span></td></tr>
                ${project.description ? `<tr><th>Description:</th><td>${project.description}</td></tr>` : ''}
              </table>

              ${project.orders.length > 0 ? `
                <h3>📦 Undelivered Orders (${project.orders.length})</h3>
                ${project.orders.map(order => `
                  <div class="order">
                    <strong>Supplier:</strong> ${order.supplier}<br>
                    <strong>Order Type:</strong> ${order.order_type}<br>
                    <strong>Order Date:</strong> ${new Date(order.order_date).toLocaleDateString()}<br>
                    <strong>Expected Delivery:</strong> ${new Date(order.expected_delivery).toLocaleDateString()}<br>
                    <strong>Status:</strong> <span class="status status-${order.status}">${order.status}</span><br>
                    ${order.external_order_number ? `<strong>Order Number:</strong> ${order.external_order_number}<br>` : ''}
                    ${order.notes ? `<strong>Notes:</strong> ${order.notes}<br>` : ''}

                    ${order.order_items && order.order_items.length > 0 ? `
                      <h4>Items (${order.order_items.length})</h4>
                      ${order.order_items.map(item => `
                        <div class="order-item">
                          <strong>${item.description}</strong><br>
                          ${item.article_code ? `Article Code: ${item.article_code}<br>` : ''}
                          ${item.ean ? `EAN: ${item.ean}<br>` : ''}
                          Ordered: ${item.quantity} | Delivered: ${item.delivered_quantity || 0} | 
                          <strong>Remaining: ${item.quantity - (item.delivered_quantity || 0)}</strong><br>
                          ${item.stock_location ? `Location: ${item.stock_location}<br>` : ''}
                          ${item.notes ? `Notes: ${item.notes}` : ''}
                        </div>
                      `).join('')}
                    ` : '<p>No items listed</p>'}
                  </div>
                `).join('')}
              ` : '<p>✅ No undelivered orders</p>'}
            </div>
          `).join('')}

          <div class="summary">
            <p><strong>Note:</strong> This is an automated weekly forecast. Please review all orders and contact suppliers if needed.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email
    console.log(`Sending forecast email to ${recipients.length} recipient(s)`);
    const emailResponse = await resend.emails.send({
      from: "Project Forecast <onboarding@resend.dev>",
      to: recipients,
      subject: `Project Forecast - ${projectsWithOrders.length} Projects in Next ${forecastWeeks} Weeks`,
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