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
    const body = await req.json();
    console.log('update-employee called with keys:', Object.keys(body));
    const { id, name, email, password, role, logistics, workstation, preferred_language } = body;

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Employee ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get current employee
    const { data: currentEmployee, error: fetchError } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !currentEmployee) {
      console.error('Employee fetch error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Employee not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    console.log('Found employee:', currentEmployee.name, 'auth_user_id:', currentEmployee.auth_user_id);

    // Prepare update data
    const employeeUpdateData: Record<string, any> = {};
    if (name !== undefined) employeeUpdateData.name = name;
    if (email !== undefined) employeeUpdateData.email = email;
    if (role !== undefined) employeeUpdateData.role = role;
    if (logistics !== undefined) employeeUpdateData.logistics = logistics;
    if (workstation !== undefined) employeeUpdateData.workstation = workstation;
    if (preferred_language !== undefined) employeeUpdateData.preferred_language = preferred_language;

    // Hash password if provided
    if (password !== undefined && password !== '') {
      if (password.length < 6) {
        return new Response(
          JSON.stringify({ error: 'Password must be at least 6 characters' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      try {
        const { data: hashResult, error: hashError } = await supabaseAdmin.rpc('hash_password', { p_password: password });
        if (hashError) {
          console.error('Password hashing error:', hashError);
          return new Response(
            JSON.stringify({ error: `Failed to hash password: ${hashError.message}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }
        employeeUpdateData.password = hashResult;
      } catch (hashErr) {
        console.error('Password hash exception:', hashErr);
        return new Response(
          JSON.stringify({ error: 'Password hashing failed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    }

    // Update auth user if linked
    if (currentEmployee.auth_user_id) {
      const authUpdateData: Record<string, any> = {};
      
      if (email !== undefined && email !== currentEmployee.email) {
        authUpdateData.email = email;
      }
      
      if (password !== undefined && password !== '') {
        authUpdateData.password = password;
      }
      
      if (name !== undefined || role !== undefined) {
        authUpdateData.user_metadata = {
          name: name ?? currentEmployee.name,
          role: role ?? currentEmployee.role
        };
      }

      if (Object.keys(authUpdateData).length > 0) {
        console.log('Updating auth user', currentEmployee.auth_user_id, 'with keys:', Object.keys(authUpdateData));
        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
          currentEmployee.auth_user_id,
          authUpdateData
        );

        if (authUpdateError) {
          console.error('Auth user update error:', authUpdateError);
          // Don't block employee update if auth update fails for non-critical fields
          if (authUpdateData.email || authUpdateData.password) {
            return new Response(
              JSON.stringify({ error: `Failed to update auth user: ${authUpdateError.message}` }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
          }
        } else {
          console.log('Auth user updated successfully');
        }
      }
    }

    // Update employee record
    if (Object.keys(employeeUpdateData).length === 0) {
      console.log('No fields to update');
      return new Response(
        JSON.stringify({ message: 'No changes to apply', employee: currentEmployee }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log('Updating employee with keys:', Object.keys(employeeUpdateData));
    const { data: employee, error: updateError } = await supabaseAdmin
      .from('employees')
      .update(employeeUpdateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Employee update error:', updateError);
      return new Response(
        JSON.stringify({ error: `Failed to update employee: ${updateError.message}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Employee updated successfully:', employee.name);

    return new Response(
      JSON.stringify({ message: 'Employee updated successfully', employee }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Update employee error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
