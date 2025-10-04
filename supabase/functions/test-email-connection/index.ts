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

    // Determine security mode: TLS only for 465, STARTTLS for everything else (e.g. 587)
    const useTls = config.smtp_port === 465;

    // Normalize addresses (avoid validation errors due to stray spaces)
    const fromEmail = (config.from_email || '').trim();
    const toEmail = (config.smtp_user || '').trim();

    const client = new SMTPClient({
      connection: {
        hostname: config.smtp_host,
        port: config.smtp_port,
        // TLS true = implicit TLS (465). TLS false = STARTTLS (recommended for 587)
        tls: useTls,
        auth: {
          username: config.smtp_user,
          password: config.smtp_password,
        },
      },
      // Helpful diagnostics in Edge Function logs
      debug: {
        log: true,
        allowUnsecure: false,
        noStartTLS: false,
        encodeLB: false,
      },
      client: {
        warning: 'ignore',
      },
    });

    // Send a test email to verify the connection
    await client.send({
      from: fromEmail,
      to: toEmail,
      subject: "Test Email - SMTP Configuration (STARTTLS/TLS)",
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
