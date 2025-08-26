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

// Helper to parse external dates like dd/MM/yyyy into ISO date (yyyy-MM-dd)
function parseExternalDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  // Support d/M/yyyy and dd/MM/yyyy
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mth, y] = m;
    const date = new Date(Date.UTC(parseInt(y, 10), parseInt(mth, 10) - 1, parseInt(d, 10)));
    if (!isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  // Fallback to existing converter (handles week numbers or ISO strings)
  try {
    const converted = convertWeekNumberToDate(trimmed);
    return converted || null;
  } catch (_) {
    return null;
  }
}

// Inclusive day difference (e.g., start=end -> 1 day)
function daysBetweenInclusive(startISO: string, endISO: string): number {
  const s = new Date(startISO);
  const e = new Date(endISO);
  const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays + 1;
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
    const { automated = false } = body;
    console.log('Request body:', JSON.stringify(body, null, 2));

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
      passwordProvided: !!externalDbConfig.password,
      automated
    });

    // Get all projects with project_link_id
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name, project_link_id, installation_date')
      .not('project_link_id', 'is', null)
      .not('project_link_id', 'eq', '');

    if (projectsError) {
      throw new Error(`Failed to fetch projects: ${projectsError.message}`);
    }

    console.log(`Found ${projects?.length || 0} projects with project_link_id`);

    let syncedCount = 0;
    let errorCount = 0;
    const syncDetails: any[] = [];
    const errorDetails: string[] = [];

    for (const project of projects || []) {
      let token: string | null = null;
      
      try {
        console.log(`Processing project ${project.name} (${project.id}) with order number ${project.project_link_id}`);

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
          console.error(`Authentication failed for project ${project.name}:`, {
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
        console.log(`Authentication successful for project ${project.name}`);

        // Query external API using the working endpoint from external-db-proxy
let rawPlacementDate: string | null = null;
let planningStartRaw: string | null = null;
let planningEndRaw: string | null = null;
let planningTeams: string[] = [];

        
        console.log(`Querying for order number: ${project.project_link_id}`);
        
        const queryResponse = await fetch(
          `${externalDbConfig.baseUrl}/layouts/API_order/script/FindOrderNumber?script.param=${project.project_link_id}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (queryResponse.ok) {
          const queryData = await queryResponse.json();
          console.log(`Query response for project ${project.name}:`, JSON.stringify(queryData));
          
          // Extract placement date from response
          if (queryData.response && queryData.response.scriptResult) {
            try {
              const orderData = JSON.parse(queryData.response.scriptResult);
              console.log(`Parsed script result for project ${project.name}:`, JSON.stringify(orderData));
              
              if (orderData.order) {
                if (orderData.order.plaatsingsdatum) {
                  rawPlacementDate = orderData.order.plaatsingsdatum;
                  console.log(`Found placement date in script result: ${rawPlacementDate}`);
                }
                if (Array.isArray(orderData.order.planning) && orderData.order.planning.length > 0) {
                  const p = orderData.order.planning[0];
                  planningStartRaw = p.datum_start || p.start_date || null;
                  planningEndRaw = p.datum_einde || p.end_date || null;
                  planningTeams = Array.isArray(p.teams) ? p.teams : [];
                  console.log(`Found planning: start=${planningStartRaw}, end=${planningEndRaw}, teams=${JSON.stringify(planningTeams)}`);
                }
              }
            } catch (parseErr) {
              console.error(`Failed to parse script result for project ${project.name}:`, parseErr);
            }
          }
        } else {
          const queryError = await queryResponse.text();
          console.error(`Query failed for project ${project.name}:`, {
            status: queryResponse.status,
            statusText: queryResponse.statusText,
            error: queryError,
            orderNumber: project.project_link_id
          });
        }

        // Process the placement date if found
if (planningStartRaw || rawPlacementDate) {
          if (planningStartRaw) {
            console.log(`Raw planning start for project ${project.name}: ${planningStartRaw}`);
          }
          if (rawPlacementDate) {
            console.log(`Raw placement date for project ${project.name}: ${rawPlacementDate}`);
            console.log(`Placement date type: ${typeof rawPlacementDate}, value: "${rawPlacementDate}"`);
          }
          
          // Use planning start date as installation date; fallback to placement date/week number
          const startFromPlanning = planningStartRaw ? parseExternalDate(planningStartRaw) : null;
          const endFromPlanning = planningEndRaw ? parseExternalDate(planningEndRaw) : null;
          const placementConverted = rawPlacementDate ? convertWeekNumberToDate(rawPlacementDate) : null;
          // Installation date should be the START date from planning, not end date
          const externalInstallationDate = startFromPlanning || placementConverted;
          const currentInstallationDate = project.installation_date;

          console.log(`Project ${project.name}: Current date: ${currentInstallationDate}, External date (preferred start): ${externalInstallationDate}`);

          // Normalize dates for comparison
          const normalizedExternal = externalInstallationDate ? new Date(externalInstallationDate).toISOString().split('T')[0] : null;
          const normalizedCurrent = currentInstallationDate ? new Date(currentInstallationDate).toISOString().split('T')[0] : null;

          // Check if dates are different
          if (normalizedExternal !== normalizedCurrent) {
            console.log(`Updating project ${project.name} installation date from ${normalizedCurrent} to ${normalizedExternal}`);

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
              console.error(`Failed to update project ${project.name}:`, updateProjectError);
              throw new Error(`Failed to update project: ${updateProjectError.message}`);
            }
            
            console.log(`Successfully updated project ${project.name} installation date to ${normalizedExternal}`);

            // Upsert/update project_team_assignments based on planning
            try {
              if (startFromPlanning && endFromPlanning) {
                const durationDays = daysBetweenInclusive(startFromPlanning, endFromPlanning);
                const teamName = (planningTeams && planningTeams.length > 0) ? planningTeams[0] : 'INSTALLATION TEAM';
                const payload = {
                  project_id: project.id,
                  team: teamName,
                  start_date: startFromPlanning,
                  duration: durationDays,
                  updated_at: new Date().toISOString()
                };
                const { error: upsertPtaError } = await supabase
                  .from('project_team_assignments')
                  .upsert(payload, { onConflict: 'project_id' });
                if (upsertPtaError) {
                  console.warn(`Failed to upsert team assignment for project ${project.name}: ${upsertPtaError.message}`);
                } else {
                  console.log(`Upserted team assignment for project ${project.name} (team: ${teamName}, start: ${startFromPlanning}, duration: ${durationDays})`);
                }
              }
            } catch (ptaErr) {
              console.warn(`PTA upsert failed for project ${project.name}:`, ptaErr);
            }

            // Get all tasks for this project and update their due dates based on standard task day_counter
            const { data: phases, error: phasesError } = await supabase
              .from('phases')
              .select('id')
              .eq('project_id', project.id);

            if (phasesError) {
              console.warn(`Failed to fetch phases for project ${project.name}: ${phasesError.message}`);
            } else if (phases && phases.length > 0) {
              console.log(`Found ${phases.length} phases for project ${project.name}`);
              console.log(`Recalculating task due dates based on new installation date: ${normalizedExternal}`);
              
              let updatedTasksCount = 0;
              
              for (const phase of phases) {
                const { data: tasks, error: tasksError } = await supabase
                  .from('tasks')
                  .select('id, standard_task_id')
                  .eq('phase_id', phase.id);

                if (tasksError) {
                  console.error(`Failed to fetch tasks for phase ${phase.id}: ${tasksError.message}`);
                  continue;
                }

                console.log(`Found ${tasks?.length || 0} tasks in phase ${phase.id}`);

                // Update each task's due date based on standard task day_counter
                for (const task of tasks || []) {
                  if (task.standard_task_id) {
                    // Get the day_counter for this standard task
                    const { data: standardTask, error: standardTaskError } = await supabase
                      .from('standard_tasks')
                      .select('day_counter')
                      .eq('id', task.standard_task_id)
                      .single();

                    if (standardTaskError) {
                      console.error(`Failed to fetch standard task ${task.standard_task_id}: ${standardTaskError.message}`);
                      continue;
                    }

                    const dayCounter = standardTask?.day_counter || 0;
                    const installationDate = new Date(normalizedExternal);
                    const dueDate = new Date(installationDate);
                    dueDate.setDate(dueDate.getDate() - dayCounter);
                    const newDueDate = dueDate.toISOString().split('T')[0];
                    
                    console.log(`Updating task ${task.id} due date to ${newDueDate} (installation: ${normalizedExternal}, day_counter: ${dayCounter})`);
                    
                    const { error: updateTaskError } = await supabase
                      .from('tasks')
                      .update({ 
                        due_date: newDueDate,
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', task.id);

                    if (updateTaskError) {
                      console.error(`Failed to update task ${task.id}: ${updateTaskError.message}`);
                    } else {
                      updatedTasksCount++;
                      console.log(`Successfully updated task ${task.id} due date`);
                    }
                  }
                }
              }
              
              console.log(`Updated ${updatedTasksCount} task due dates for project ${project.name} based on day_counter`);
            } else {
              console.log(`No phases found for project ${project.name}`);
            }

            syncedCount++;
            syncDetails.push({
              project_name: project.name,
              project_link_id: project.project_link_id,
              status: 'updated',
              old_date: normalizedCurrent,
              new_date: normalizedExternal,
              raw_placement_date: rawPlacementDate
            });
            console.log(`Successfully synced project ${project.name}`);
          } else {
            console.log(`Project ${project.name} installation date is already up to date`);
            syncDetails.push({
              project_name: project.name,
              project_link_id: project.project_link_id,
              status: 'up_to_date',
              current_date: normalizedCurrent,
              external_date: normalizedExternal
            });
          }
        } else {
          console.log(`No placement or planning start date found for project ${project.name} - tried both find and script approaches`);
          syncDetails.push({
            project_name: project.name,
            project_link_id: project.project_link_id,
            status: 'no_date_found',
            message: 'No placement or planning start date found in external database'
          });
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing project ${project.name} (order: ${project.project_link_id}):`, errorMessage);
        console.error(`Full error details:`, error);
        
        // Log specific error context
        if (error instanceof Error) {
          console.error(`Error stack:`, error.stack);
          console.error(`Error name:`, error.name);
        }
        
        errorDetails.push(`Project ${project.project_link_id}: ${errorMessage}`);
        syncDetails.push({
          project_name: project.name,
          project_link_id: project.project_link_id,
          status: 'error',
          error: errorMessage
        });
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
            console.warn(`Failed to logout token for project ${project.name}:`, logoutError);
          }
        }
      }
    }

    // Log sync results to database
    console.log('Logging sync results to project_sync_logs table...');
    try {
      const syncLogEntry = {
        synced_count: syncedCount,
        error_count: errorCount,
        details: {
          automated,
          total_projects: projects?.length || 0,
          sync_details: syncDetails,
          error_details: errorDetails,
          timestamp: new Date().toISOString(),
          config_used: {
            baseUrl: externalDbConfig.baseUrl,
            username: externalDbConfig.username
          }
        }
      };

      const { error: logError } = await supabase
        .from('project_sync_logs')
        .insert(syncLogEntry);

      if (logError) {
        console.error('Error logging sync results:', logError);
      } else {
        console.log('Sync results logged successfully to project_sync_logs');
      }
    } catch (logError) {
      console.error('Failed to log sync results:', logError);
    }

    const message = automated 
      ? `Automated sync completed: ${syncedCount} projects updated, ${errorCount} errors`
      : `Manual sync completed: ${syncedCount} projects updated, ${errorCount} errors`;

    const result = {
      success: true,
      message,
      syncedCount,
      errorCount,
      totalProjects: projects?.length || 0,
      automated,
      details: syncDetails,
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