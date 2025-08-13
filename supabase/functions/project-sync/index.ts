import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to convert week number to date
function convertWeekNumberToDate(weekNumber: string): string {
  // Check if it's a week number format (like 202544)
  if (/^\d{6}$/.test(weekNumber)) {
    const year = parseInt(weekNumber.substring(0, 4));
    const week = parseInt(weekNumber.substring(4, 6));
    
    // Calculate the date from year and week number
    const jan1 = new Date(year, 0, 1);
    const daysToAdd = (week - 1) * 7;
    const targetDate = new Date(jan1.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    
    // Adjust to Monday of that week
    const dayOfWeek = targetDate.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    targetDate.setDate(targetDate.getDate() + daysToMonday);
    
    return targetDate.toISOString().split('T')[0];
  }
  
  // If it's already a date string, return as is
  return weekNumber;
}

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
      .not('project_link_id', 'is', null)
      .not('project_link_id', 'eq', '');

    if (projectsError) {
      throw new Error(`Failed to fetch projects: ${projectsError.message}`);
    }

    console.log(`Found ${projects?.length || 0} projects with project_link_id`);

    let syncedCount = 0;
    let errorCount = 0;
    const errorDetails: string[] = [];

    for (const project of projects || []) {
      let token: string | null = null;
      
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
          const authError = await authResponse.text();
          throw new Error(`Authentication failed (${authResponse.status}): ${authError}`);
        }

        const authData = await authResponse.json();
        
        if (!authData.response || !authData.response.token) {
          throw new Error('No token received from authentication');
        }
        
        token = authData.response.token;
        console.log(`Authentication successful for project ${project.id}`);

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
          const orderError = await orderResponse.text();
          throw new Error(`Order query failed (${orderResponse.status}): ${orderError}`);
        }

        const orderData = await orderResponse.json();
        console.log(`Order data received for project ${project.id}:`, JSON.stringify(orderData));
        
        if (orderData.response && orderData.response.scriptResult) {
          const orderDetails = JSON.parse(orderData.response.scriptResult);
          console.log(`Parsed order details for project ${project.id}:`, JSON.stringify(orderDetails));
          
          if (orderDetails.order && orderDetails.order.plaatsingsdatum) {
            const rawPlacementDate = orderDetails.order.plaatsingsdatum;
            console.log(`Raw placement date for project ${project.id}: ${rawPlacementDate}`);
            
            // Convert placement date (could be week number or date)
            const externalInstallationDate = convertWeekNumberToDate(rawPlacementDate);
            const currentInstallationDate = project.installation_date;

            console.log(`Project ${project.id}: Current date: ${currentInstallationDate}, External date: ${externalInstallationDate} (converted from ${rawPlacementDate})`);

            // Normalize dates for comparison
            const normalizedExternal = new Date(externalInstallationDate).toISOString().split('T')[0];
            const normalizedCurrent = currentInstallationDate ? new Date(currentInstallationDate).toISOString().split('T')[0] : null;

            // Check if dates are different
            if (normalizedExternal !== normalizedCurrent) {
              console.log(`Updating project ${project.id} installation date from ${normalizedCurrent} to ${normalizedExternal}`);

              // Calculate the date difference for task updates
              let daysDifference = 0;
              if (normalizedCurrent) {
                const currentDate = new Date(normalizedCurrent);
                const newDate = new Date(normalizedExternal);
                daysDifference = Math.round((newDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
              }

              // Update project installation date
              const { error: updateProjectError } = await supabase
                .from('projects')
                .update({ 
                  installation_date: normalizedExternal,
                  updated_at: new Date().toISOString()
                })
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
                console.warn(`Failed to fetch phases for project ${project.id}: ${phasesError.message}`);
              } else {
                // Update task due dates if we have a current date to calculate from
                if (normalizedCurrent && daysDifference !== 0) {
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
                          .update({ 
                            due_date: taskDueDate.toISOString().split('T')[0],
                            updated_at: new Date().toISOString()
                          })
                          .eq('id', task.id);

                        if (updateTaskError) {
                          console.error(`Failed to update task ${task.id}: ${updateTaskError.message}`);
                        }
                      }
                    }
                  }
                }
              }

              syncedCount++;
              console.log(`Successfully synced project ${project.id}`);
            } else {
              console.log(`Project ${project.id} installation date is already up to date`);
            }
          } else {
            console.log(`No placement date found for project ${project.id}`);
          }
        } else {
          console.log(`No script result found for project ${project.id}`);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing project ${project.id}:`, errorMessage);
        errorDetails.push(`Project ${project.project_link_id}: ${errorMessage}`);
        errorCount++;
      } finally {
        // Always try to logout from external DB if we have a token
        if (token) {
          try {
            await fetch(`${externalDbConfig.baseUrl}/sessions/${token}`, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json'
              }
            });
          } catch (logoutError) {
            console.warn(`Failed to logout token for project ${project.id}:`, logoutError);
          }
        }
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