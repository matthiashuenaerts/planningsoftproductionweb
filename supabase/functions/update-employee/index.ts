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
    const { id, name, email, password, role, logistics, workstation } = await req.json();

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Employee ID is required' }),
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

    // Get current employee to find auth_user_id
    const { data: currentEmployee, error: fetchError } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentEmployee) {
      return new Response(
        JSON.stringify({ error: 'Employee not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Prepare update data for employee
    const employeeUpdateData: Record<string, any> = {};
    if (name !== undefined) employeeUpdateData.name = name;
    if (email !== undefined) employeeUpdateData.email = email;
    if (password !== undefined && password !== '') employeeUpdateData.password = password;
    if (role !== undefined) employeeUpdateData.role = role;
    if (logistics !== undefined) employeeUpdateData.logistics = logistics;
    if (workstation !== undefined) employeeUpdateData.workstation = workstation;

    // If employee has auth_user_id, update the auth user as well
    if (currentEmployee.auth_user_id) {
      const authUpdateData: Record<string, any> = {};
      
      if (email !== undefined && email !== currentEmployee.email) {
        authUpdateData.email = email;
      }
      
      if (password !== undefined && password !== '') {
        if (password.length < 6) {
          return new Response(
            JSON.stringify({ error: 'Password must be at least 6 characters' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
        authUpdateData.password = password;
      }
      
      if (name !== undefined || role !== undefined) {
        authUpdateData.user_metadata = {
          name: name || currentEmployee.name,
          role: role || currentEmployee.role
        };
      }

      if (Object.keys(authUpdateData).length > 0) {
        console.log(`Updating auth user ${currentEmployee.auth_user_id} with:`, Object.keys(authUpdateData));
        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
          currentEmployee.auth_user_id,
          authUpdateData
        );

        if (authUpdateError) {
          console.error('Auth user update error:', authUpdateError);
          return new Response(
            JSON.stringify({ error: `Failed to update auth user: ${authUpdateError.message}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
        console.log('Auth user updated successfully');
      }
    }

    // Update employee record
    const { data: employee, error: updateError } = await supabaseAdmin
      .from('employees')
      .update(employeeUpdateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return new Response(
        JSON.stringify({ error: `Failed to update employee: ${updateError.message}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Successfully updated employee: ${employee.name}`);

    return new Response(
      JSON.stringify({
        message: 'Employee updated successfully',
        employee: employee
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Update employee error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
