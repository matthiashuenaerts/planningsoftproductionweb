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
    const { id } = await req.json();

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

    // Delete related records first to avoid foreign key constraints
    console.log(`Deleting related records for employee: ${currentEmployee.name}`);

    // Delete notifications
    await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('user_id', id);

    // Delete employee_workstation_links
    await supabaseAdmin
      .from('employee_workstation_links')
      .delete()
      .eq('employee_id', id);

    // Delete employee_standard_task_links
    await supabaseAdmin
      .from('employee_standard_task_links')
      .delete()
      .eq('employee_id', id);

    // Delete daily_team_assignments
    await supabaseAdmin
      .from('daily_team_assignments')
      .delete()
      .eq('employee_id', id);

    // Delete holiday_requests
    await supabaseAdmin
      .from('holiday_requests')
      .delete()
      .eq('user_id', id);

    // Delete time_registrations
    await supabaseAdmin
      .from('time_registrations')
      .delete()
      .eq('employee_id', id);

    // Delete the employee record
    const { error: deleteError } = await supabaseAdmin
      .from('employees')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: `Failed to delete employee: ${deleteError.message}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // If employee has auth_user_id, delete the auth user as well
    if (currentEmployee.auth_user_id) {
      console.log(`Deleting auth user ${currentEmployee.auth_user_id}`);
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
        currentEmployee.auth_user_id
      );

      if (authDeleteError) {
        console.error('Auth user delete error:', authDeleteError);
        // Employee is already deleted, just log the error
      }
    }

    console.log(`Successfully deleted employee: ${currentEmployee.name}`);

    return new Response(
      JSON.stringify({
        message: 'Employee deleted successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Delete employee error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
