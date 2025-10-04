import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_password: string;
  from_email: string;
  from_name: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const config: EmailConfig = await req.json();

    console.log('Testing SMTP connection with:', {
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_secure,
      user: config.smtp_user
    });

    // Create SMTP client with proper STARTTLS handling for port 587
    const client = new SMTPClient({
      connection: {
        hostname: config.smtp_host,
        port: config.smtp_port,
        tls: config.smtp_secure, // false for port 587 (STARTTLS), true for port 465 (SSL/TLS)
        auth: {
          username: config.smtp_user,
          password: config.smtp_password,
        },
      },
    });

    // Send a test email to verify the connection
    await client.send({
      from: config.from_email,
      to: config.smtp_user, // Send test to the configured email
      subject: "Test Email - SMTP Configuration",
      content: "This is a test email to verify your SMTP configuration is working correctly.",
    });
    
    console.log('SMTP connection and test email sent successfully');
    await client.close();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error testing email connection:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
