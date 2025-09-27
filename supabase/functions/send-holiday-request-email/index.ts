import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

    // Always add required recipients
    if (!recipients.includes("productiesturing@thonon.be")) {
      recipients.push("productiesturing@thonon.be");
    }
    if (!recipients.includes("matthias@thonon.be")) {
      recipients.push("matthias@thonon.be");
    }

    // Use full recipient list
    const finalRecipients = recipients;

    console.log('Sending email to:', finalRecipients);

    // Calculate duration
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const durationDays = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Format dates for display
    const formatDate = (date: Date) => date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const emailResponse = await resend.emails.send({
      from: "Thonon Holiday System <no-reply@thonon.be>",
      to: finalRecipients,
      subject: `🏖️ Holiday Request: ${employeeName} (${durationDays} day${durationDays !== 1 ? 's' : ''})`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 300;">🏖️ Holiday Request</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">New request submitted for approval</p>
          </div>

          <!-- Content -->
          <div style="padding: 30px; background-color: #f8fafc;">
            
            <!-- Employee Info -->
            <div style="background-color: #ffffff; border-left: 4px solid #3b82f6; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="margin: 0 0 15px 0; color: #1e40af; font-size: 18px;">👤 Employee Information</h3>
              <p style="margin: 5px 0; color: #374151;"><strong>Name:</strong> ${employeeName}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Email:</strong> ${employeeEmail}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Request ID:</strong> <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${requestId}</code></p>
            </div>

            <!-- Date Details -->
            <div style="background-color: #ffffff; border-left: 4px solid #10b981; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="margin: 0 0 15px 0; color: #047857; font-size: 18px;">📅 Holiday Details</h3>
              <div style="margin-bottom: 15px;">
                <p style="margin: 0; color: #047857; font-weight: 600;">Start Date</p>
                <p style="margin: 5px 0 0 0; color: #374151; font-size: 16px;">${formatDate(startDateObj)}</p>
              </div>
              <div style="margin-bottom: 15px;">
                <p style="margin: 0; color: #047857; font-weight: 600;">End Date</p>
                <p style="margin: 5px 0 0 0; color: #374151; font-size: 16px;">${formatDate(endDateObj)}</p>
              </div>
              <div style="text-align: center; background-color: #dcfce7; padding: 12px; border-radius: 6px;">
                <p style="margin: 0; color: #047857; font-weight: bold; font-size: 18px;">
                  Total Duration: ${durationDays} day${durationDays !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            ${reason ? `
            <div style="background-color: #ffffff; border-left: 4px solid #f59e0b; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h3 style="margin: 0 0 15px 0; color: #92400e; font-size: 18px;">💭 Reason for Leave</h3>
              <p style="margin: 0; color: #374151; font-style: italic; background-color: #fef3c7; padding: 15px; border-radius: 6px;">"${reason}"</p>
            </div>
            ` : ''}

            <!-- Status -->
            <div style="text-align: center; padding: 20px; background-color: #fef2f2; border: 2px dashed #fca5a5; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 0; color: #dc2626; font-weight: 600; font-size: 16px;">⏳ Status: PENDING APPROVAL</p>
              <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 14px;">This request requires management approval</p>
            </div>

            <!-- Action Required -->
            <div style="background-color: #eff6ff; border: 1px solid #dbeafe; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h3 style="margin: 0 0 10px 0; color: #1e40af;">🔔 Action Required</h3>
              <p style="margin: 0; color: #374151;">Please review this holiday request and take appropriate action in the management system.</p>
            </div>

          </div>

          <!-- Footer -->
          <div style="background-color: #f1f5f9; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">
              📧 This notification was sent to: <br>
              <span style="font-family: monospace; background: #e5e7eb; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${finalRecipients.join(', ')}</span>
            </p>
            <p style="margin: 15px 0 0 0; color: #9ca3af; font-size: 12px;">
              Generated by Thonon Holiday Management System • ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
      `,
    });

    console.log("Enhanced holiday request email sent successfully:", emailResponse);

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