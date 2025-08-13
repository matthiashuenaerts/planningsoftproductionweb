import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting project sync process...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // External DB credentials
    const externalDbConfig = {
      baseUrl: 'https://app.thonon.be/fmi/data/vLatest/databases/CrownBasePro-Thonon',
      username: 'Matthias HUENAERTS',
      password: '8pJ1A24z'
    };

    // Get all projects with project_link_id
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, project_link_id, installation_date')
      .not('project_link_id', 'is', null);

    if (projectsError) {
      throw new Error(`Failed to fetch projects: ${projectsError.message}`);
    }

    console.log(`Found ${projects?.length || 0} projects with project_link_id`);

    let syncedCount = 0;
    let errorCount = 0;

    for (const project of projects || []) {
      try {
        console.log(`Processing project ${project.id} with order number ${project.project_link_id}`);

        // Authenticate with external DB
        const authResponse = await fetch(`${externalDbConfig.baseUrl}/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + btoa(`${externalDbConfig.username}:${externalDbConfig.password}`)
          }
        });

        if (!authResponse.ok) {
          throw new Error(`Authentication failed: ${authResponse.statusText}`);
        }

        const authData = await authResponse.json();
        const token = authData.response.token;

        // Query order data
        const orderResponse = await fetch(
          `${externalDbConfig.baseUrl}/layouts/Crown_REST_GetOrderDetails/scripts/GetOrderDetails?script.param=${project.project_link_id}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!orderResponse.ok) {
          throw new Error(`Order query failed: ${orderResponse.statusText}`);
        }

        const orderData = await orderResponse.json();
        
        if (orderData.response && orderData.response.scriptResult) {
          const orderDetails = JSON.parse(orderData.response.scriptResult);
          
          if (orderDetails.order && orderDetails.order.plaatsingsdatum) {
            const externalInstallationDate = orderDetails.order.plaatsingsdatum;
            const currentInstallationDate = project.installation_date;

            console.log(`Project ${project.id}: Current date: ${currentInstallationDate}, External date: ${externalInstallationDate}`);

            // Check if dates are different
            if (externalInstallationDate !== currentInstallationDate) {
              console.log(`Updating project ${project.id} installation date from ${currentInstallationDate} to ${externalInstallationDate}`);

              // Calculate the date difference
              const currentDate = new Date(currentInstallationDate || '');
              const newDate = new Date(externalInstallationDate);
              const daysDifference = Math.round((newDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

              // Update project installation date
              const { error: updateProjectError } = await supabase
                .from('projects')
                .update({ installation_date: externalInstallationDate })
                .eq('id', project.id);

              if (updateProjectError) {
                throw new Error(`Failed to update project: ${updateProjectError.message}`);
              }

              // Get all tasks for this project and update their due dates
              const { data: phases, error: phasesError } = await supabase
                .from('phases')
                .select('id')
                .eq('project_id', project.id);

              if (phasesError) {
                throw new Error(`Failed to fetch phases: ${phasesError.message}`);
              }

              for (const phase of phases || []) {
                const { data: tasks, error: tasksError } = await supabase
                  .from('tasks')
                  .select('id, due_date')
                  .eq('phase_id', phase.id);

                if (tasksError) {
                  console.error(`Failed to fetch tasks for phase ${phase.id}: ${tasksError.message}`);
                  continue;
                }

                // Update each task's due date
                for (const task of tasks || []) {
                  if (task.due_date) {
                    const taskDueDate = new Date(task.due_date);
                    taskDueDate.setDate(taskDueDate.getDate() + daysDifference);
                    
                    const { error: updateTaskError } = await supabase
                      .from('tasks')
                      .update({ due_date: taskDueDate.toISOString().split('T')[0] })
                      .eq('id', task.id);

                    if (updateTaskError) {
                      console.error(`Failed to update task ${task.id}: ${updateTaskError.message}`);
                    }
                  }
                }
              }

              syncedCount++;
              console.log(`Successfully synced project ${project.id}`);
            } else {
              console.log(`Project ${project.id} installation date is already up to date`);
            }
          }
        }

        // Logout from external DB
        await fetch(`${externalDbConfig.baseUrl}/sessions/${token}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        });

      } catch (error) {
        console.error(`Error processing project ${project.id}:`, error);
        errorCount++;
      }
    }

    const result = {
      success: true,
      message: `Sync completed. ${syncedCount} projects updated, ${errorCount} errors`,
      syncedCount,
      errorCount,
      timestamp: new Date().toISOString()
    };

    console.log('Sync process completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Sync process failed:', error);
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});