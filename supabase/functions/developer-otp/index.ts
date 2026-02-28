import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    // Verify JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) throw new Error('Unauthorized');

    const body = await req.json();
    const { action } = body;

    // Get employee info
    const { data: employee } = await supabase
      .from('employees')
      .select('id, email, name')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (!employee) throw new Error('Employee not found');

    // Check if user is developer
    const { data: devRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', employee.id)
      .eq('role', 'developer')
      .maybeSingle();

    if (!devRole) throw new Error('Not a developer');

    if (action === 'send') {
      if (!employee.email) throw new Error('No email configured for this developer');

      // Generate 6-digit OTP
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Invalidate old codes
      await supabase
        .from('developer_otp_codes')
        .update({ used: true })
        .eq('employee_id', employee.id)
        .eq('used', false);

      // Store new code
      const { error: insertErr } = await supabase
        .from('developer_otp_codes')
        .insert({
          employee_id: employee.id,
          email: employee.email,
          code,
          expires_at: expiresAt.toISOString(),
        });
      if (insertErr) throw insertErr;

      // Send email via Resend
      const { error: emailError } = await resend.emails.send({
        from: 'AutoMattiOn Compass <noreply@automattion-compass.com>',
        to: [employee.email],
        subject: 'Developer Portal - Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #195F85; margin: 0;">AutoMattiOn Compass</h2>
              <p style="color: #42A5DB; font-weight: bold; margin-top: 4px;">Developer Portal Access</p>
            </div>
            <p style="color: #333;">Hi ${employee.name},</p>
            <p style="color: #333;">Your verification code to access the Developer Portal is:</p>
            <div style="background: #f0f7fc; padding: 24px; border-radius: 12px; text-align: center; margin: 24px 0; border: 2px solid #42A5DB;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #195F85;">${code}</span>
            </div>
            <p style="color: #666; font-size: 14px;">This code expires in <strong>5 minutes</strong>.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #999; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
          </div>
        `,
      });

      if (emailError) {
        console.error('Resend error:', emailError);
        throw new Error('Failed to send verification email');
      }

      // Mask email for response
      const maskedEmail = employee.email.replace(
        /^(.{2})(.*)(@.*)$/,
        (_, start, middle, domain) => start + '*'.repeat(Math.min(middle.length, 5)) + domain
      );

      return new Response(JSON.stringify({ success: true, email: maskedEmail }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'verify') {
      const { code } = body;
      if (!code) throw new Error('Code required');

      const { data: otpRecord } = await supabase
        .from('developer_otp_codes')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('code', code)
        .eq('used', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!otpRecord) {
        return new Response(JSON.stringify({ verified: false, error: 'Invalid or expired code' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Mark as used
      await supabase
        .from('developer_otp_codes')
        .update({ used: true })
        .eq('id', otpRecord.id);

      return new Response(JSON.stringify({ verified: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'resend') {
      // Resend is just send again
      // Redirect to send logic by modifying body
      const sendReq = new Request(req.url, {
        method: 'POST',
        headers: req.headers,
        body: JSON.stringify({ action: 'send' }),
      });
      // Just re-invoke send logic inline
      if (!employee.email) throw new Error('No email configured');

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await supabase
        .from('developer_otp_codes')
        .update({ used: true })
        .eq('employee_id', employee.id)
        .eq('used', false);

      await supabase
        .from('developer_otp_codes')
        .insert({
          employee_id: employee.id,
          email: employee.email,
          code,
          expires_at: expiresAt.toISOString(),
        });

      await resend.emails.send({
        from: 'AutoMattiOn Compass <noreply@automattion-compass.com>',
        to: [employee.email],
        subject: 'Developer Portal - New Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #195F85;">AutoMattiOn Compass</h2>
              <p style="color: #42A5DB; font-weight: bold; margin-top: 4px;">Developer Portal Access</p>
            </div>
            <p style="color: #333;">Hi ${employee.name},</p>
            <p style="color: #333;">Your new verification code is:</p>
            <div style="background: #f0f7fc; padding: 24px; border-radius: 12px; text-align: center; margin: 24px 0; border: 2px solid #42A5DB;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #195F85;">${code}</span>
            </div>
            <p style="color: #666; font-size: 14px;">This code expires in <strong>5 minutes</strong>.</p>
          </div>
        `,
      });

      const maskedEmail = employee.email.replace(
        /^(.{2})(.*)(@.*)$/,
        (_, start, middle, domain) => start + '*'.repeat(Math.min(middle.length, 5)) + domain
      );

      return new Response(JSON.stringify({ success: true, email: maskedEmail }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action. Use send, verify, or resend.');
  } catch (error: any) {
    console.error('Developer OTP error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
