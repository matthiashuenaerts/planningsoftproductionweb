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
    const { name, email, password, role, logistics, workstation, preferred_language } = await req.json();

    if (!name || !password) {
      return new Response(
        JSON.stringify({ error: 'Name and password are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

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

    // Generate email if not provided (using employee name)
    const userEmail = email || `${name.toLowerCase().replace(/\s+/g, '.')}@company.local`;

    console.log(`Creating auth user for: ${name} (${userEmail})`);

    let authUserId: string;

    // Try to create Supabase auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        name: name,
        role: role || 'worker'
      }
    });

    if (authError) {
      // If user already exists, look them up and reuse their auth ID
      if (authError.message?.includes('already been registered')) {
        console.log(`Auth user already exists for ${userEmail}, looking up existing user...`);
        const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) {
          console.error('Error listing users:', listError);
          return new Response(
            JSON.stringify({ error: `Failed to find existing auth user: ${listError.message}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
        const existingUser = listData.users.find((u: any) => u.email === userEmail);
        if (!existingUser) {
          return new Response(
            JSON.stringify({ error: `Auth user exists but could not be found for email: ${userEmail}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
        authUserId = existingUser.id;
        console.log(`Found existing auth user with ID: ${authUserId}`);
      } else {
        console.error('Auth user creation error:', authError);
        return new Response(
          JSON.stringify({ error: `Failed to create auth user: ${authError.message}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    } else {
      authUserId = authUser.user.id;
      console.log(`Created auth user with ID: ${authUserId}`);
    }

    // Create employee record with auth_user_id
    const { data: employee, error: employeeError } = await supabaseAdmin
      .from('employees')
      .insert([{
        name,
        email: userEmail,
        password,
        role: role || 'worker',
        logistics: logistics || false,
        workstation: workstation || null,
        auth_user_id: authUserId,
        preferred_language: preferred_language || 'nl'
      }])
      .select()
      .single();

    if (employeeError) {
      console.error('Employee creation error:', employeeError);
      
      // Only rollback auth user if we just created it (not reused)
      if (!authError) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      }
      
      return new Response(
        JSON.stringify({ error: `Failed to create employee: ${employeeError.message}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Successfully created employee: ${name} with ID: ${employee.id}`);

    return new Response(
      JSON.stringify({
        message: 'Employee created successfully',
        employee: employee
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Create employee error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
