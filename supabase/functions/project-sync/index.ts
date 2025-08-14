import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to convert week number to date
function convertWeekNumberToDate(weekNumber: string): string {
  console.log(`Converting date/week: ${weekNumber}`);
  
  // Check if it's a week number format (like 202544)
  if (/^\d{6}$/.test(weekNumber)) {
    const year = parseInt(weekNumber.substring(0, 4));
    const week = parseInt(weekNumber.substring(4, 6));
    
    console.log(`Detected week number - Year: ${year}, Week: ${week}`);
    
    // Calculate the first day of the year
    const jan1 = new Date(year, 0, 1);
    
    // Find the first Monday of the year
    const jan1Day = jan1.getDay();
    const daysToFirstMonday = jan1Day === 0 ? 1 : (8 - jan1Day);
    const firstMonday = new Date(year, 0, 1 + daysToFirstMonday);
    
    // Calculate the target week's Monday
    const targetDate = new Date(firstMonday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
    
    const result = targetDate.toISOString().split('T')[0];
    console.log(`Week ${weekNumber} converted to: ${result}`);
    return result;
  }
  
  // If it's already a date string, try to parse and format it
  if (weekNumber) {
    try {
      const date = new Date(weekNumber);
      if (!isNaN(date.getTime())) {
        const result = date.toISOString().split('T')[0];
        console.log(`Date ${weekNumber} formatted to: ${result}`);
        return result;
      }
    } catch (e) {
      console.warn(`Failed to parse date: ${weekNumber}`);
    }
  }
  
  console.log(`Using original value: ${weekNumber}`);
  return weekNumber;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting project sync process...');

    // Parse request body to get configuration
    const body = await req.json();
    console.log('Request body:', JSON.stringify(body));

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // External DB credentials - use from request or fallback to defaults
    const externalDbConfig = body.config || {
      baseUrl: 'https://app.thonon.be/fmi/data/vLatest/databases/CrownBasePro-Thonon',
      username: 'Matthias HUENAERTS',
      password: '8pJ1A24z'
    };

    console.log('Using external DB config:', {
      baseUrl: externalDbConfig.baseUrl,
      username: externalDbConfig.username,
      passwordProvided: !!externalDbConfig.password
    });

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
          console.error(`Authentication failed for project ${project.id}:`, {
            status: authResponse.status,
            statusText: authResponse.statusText,
            error: authError,
            url: `${externalDbConfig.baseUrl}/sessions`
          });
          throw new Error(`Authentication failed (${authResponse.status}): ${authError}`);
        }

        const authData = await authResponse.json();
        
        if (!authData.response || !authData.response.token) {
          throw new Error('No token received from authentication');
        }
        
        token = authData.response.token;
        console.log(`Authentication successful for project ${project.id}`);

        // Try multiple approaches to get order details
        let orderDetails = null;
        let rawPlacementDate = null;

        // Approach 1: Try to find records using the ordernummer field
        console.log(`Attempting to find order records for order number: ${project.project_link_id}`);
        
        try {
          const findUrl = `${externalDbConfig.baseUrl}/layouts/Crown_REST_GetOrderDetails/_find`;
          const findResponse = await fetch(findUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              query: [
                {
                  ordernummer: project.project_link_id
                }
              ]
            })
          });

          if (findResponse.ok) {
            const findData = await findResponse.json();
            console.log(`Find response for project ${project.id}:`, JSON.stringify(findData));
            
            if (findData.response && findData.response.data && findData.response.data.length > 0) {
              const record = findData.response.data[0];
              console.log(`Found record for project ${project.id}:`, JSON.stringify(record));
              
              // Extract placement date from the record fields
              if (record.fieldData && record.fieldData.plaatsingsdatum) {
                rawPlacementDate = record.fieldData.plaatsingsdatum;
                console.log(`Found placement date in fieldData: ${rawPlacementDate}`);
              } else {
                // Check if placement date is in a different field structure
                console.log(`Record fieldData structure:`, JSON.stringify(record.fieldData));
                // Look for any field that might contain the placement date
                for (const [key, value] of Object.entries(record.fieldData || {})) {
                  if (key.toLowerCase().includes('plaats') || key.toLowerCase().includes('installation') || key.toLowerCase().includes('datum')) {
                    console.log(`Potential placement date field ${key}: ${value}`);
                    if (!rawPlacementDate && value) {
                      rawPlacementDate = value;
                    }
                  }
                }
              }
            } else {
              console.log(`No records found for order number ${project.project_link_id}`);
            }
          } else {
            const findError = await findResponse.text();
            console.error(`Find request failed for project ${project.id}:`, {
              status: findResponse.status,
              statusText: findResponse.statusText,
              error: findError,
              url: findUrl,
              orderNumber: project.project_link_id
            });
          }
        } catch (findErr) {
          console.error(`Find approach failed for project ${project.id}:`, findErr);
        }

        // Approach 2: If no placement date found, try script execution
        if (!rawPlacementDate) {
          console.log(`Trying script execution approach for project ${project.id}`);
          try {
            const scriptUrl = `${externalDbConfig.baseUrl}/layouts/Crown_REST_GetOrderDetails/_script/GetOrderDetails`;
            const orderResponse = await fetch(scriptUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                'script.param': project.project_link_id
              })
            });

            if (orderResponse.ok) {
              const orderData = await orderResponse.json();
              console.log(`Script response for project ${project.id}:`, JSON.stringify(orderData));
              
              if (orderData.response && orderData.response.scriptResult) {
                try {
                  orderDetails = JSON.parse(orderData.response.scriptResult);
                  console.log(`Parsed script result for project ${project.id}:`, JSON.stringify(orderDetails));
                  
                  if (orderDetails.order && orderDetails.order.plaatsingsdatum) {
                    rawPlacementDate = orderDetails.order.plaatsingsdatum;
                    console.log(`Found placement date in script result: ${rawPlacementDate}`);
                  }
                } catch (parseErr) {
                  console.error(`Failed to parse script result for project ${project.id}:`, parseErr);
                }
              }
            } else {
              const orderError = await orderResponse.text();
              console.error(`Script execution failed for project ${project.id}:`, {
                status: orderResponse.status,
                statusText: orderResponse.statusText,
                error: orderError,
                url: scriptUrl,
                orderNumber: project.project_link_id
              });
            }
          } catch (scriptErr) {
            console.error(`Script execution approach failed for project ${project.id}:`, scriptErr);
          }
        }

        // Process the placement date if found
        if (rawPlacementDate) {
          console.log(`Raw placement date for project ${project.id}: ${rawPlacementDate}`);
          console.log(`Placement date type: ${typeof rawPlacementDate}, value: "${rawPlacementDate}"`);
          
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
              console.error(`Failed to update project ${project.id}:`, updateProjectError);
              throw new Error(`Failed to update project: ${updateProjectError.message}`);
            }
            
            console.log(`Successfully updated project ${project.id} installation date to ${normalizedExternal}`);

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
          console.log(`No placement date found for project ${project.id} - tried both find and script approaches`);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing project ${project.id} (order: ${project.project_link_id}):`, errorMessage);
        console.error(`Full error details:`, error);
        
        // Log specific error context
        if (error instanceof Error) {
          console.error(`Error stack:`, error.stack);
          console.error(`Error name:`, error.name);
        }
        
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