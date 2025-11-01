import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get all employees
    const { data: employees, error: fetchError } = await supabaseAdmin
      .from('employees')
      .select('*')
      .is('auth_user_id', null);

    if (fetchError) {
      throw new Error(`Failed to fetch employees: ${fetchError.message}`);
    }

    console.log(`Found ${employees?.length || 0} employees to migrate`);

    const results = {
      success: [] as string[],
      failed: [] as { name: string; error: string }[],
      skipped: [] as string[]
    };

    for (const employee of employees || []) {
      try {
        // Skip if already has auth_user_id
        if (employee.auth_user_id) {
          results.skipped.push(employee.name);
          continue;
        }

        // Generate email if not exists (using employee name)
        const email = employee.email || `${employee.name.toLowerCase().replace(/\s+/g, '.')}@company.local`;
        
        // Use existing password or generate a temporary one
        const password = employee.password || `Temp${employee.name}${Math.random().toString(36).slice(2, 10)}`;

        console.log(`Creating auth user for: ${employee.name} (${email})`);

        // Create Supabase auth user
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            name: employee.name,
            role: employee.role,
            employee_id: employee.id
          }
        });

        if (authError) {
          throw authError;
        }

        console.log(`Created auth user with ID: ${authUser.user.id}`);

        // Update employee record with auth_user_id
        const { error: updateError } = await supabaseAdmin
          .from('employees')
          .update({ 
            auth_user_id: authUser.user.id,
            email: email // Also update email if it was generated
          })
          .eq('id', employee.id);

        if (updateError) {
          throw updateError;
        }

        results.success.push(employee.name);
        console.log(`Successfully migrated: ${employee.name}`);

      } catch (error: any) {
        console.error(`Failed to migrate ${employee.name}:`, error);
        results.failed.push({
          name: employee.name,
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Migration completed',
        results: results,
        total: employees?.length || 0,
        migrated: results.success.length,
        failed: results.failed.length,
        skipped: results.skipped.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Migration error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});