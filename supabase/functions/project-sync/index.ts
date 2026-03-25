import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Function to convert week number to date
function convertWeekNumberToDate(weekNumber: string): string {
  console.log(`Converting date/week: ${weekNumber}`);
  if (/^\d{6}$/.test(weekNumber)) {
    const year = parseInt(weekNumber.substring(0, 4));
    const week = parseInt(weekNumber.substring(4, 6));
    console.log(`Detected week number - Year: ${year}, Week: ${week}`);
    const jan1 = new Date(year, 0, 1);
    const jan1Day = jan1.getDay();
    const daysToFirstMonday = jan1Day === 0 ? 1 : (8 - jan1Day);
    const firstMonday = new Date(year, 0, 1 + daysToFirstMonday);
    const targetDate = new Date(firstMonday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
    const result = targetDate.toISOString().split('T')[0];
    console.log(`Week ${weekNumber} converted to: ${result}`);
    return result;
  }
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

function parseExternalDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mth, y] = m;
    const date = new Date(Date.UTC(parseInt(y, 10), parseInt(mth, 10) - 1, parseInt(d, 10)));
    if (!isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  try {
    const converted = convertWeekNumberToDate(trimmed);
    return converted || null;
  } catch (_) {
    return null;
  }
}

function daysBetweenInclusive(startISO: string, endISO: string): number {
  const s = new Date(startISO);
  const e = new Date(endISO);
  const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

/**
 * Process a single project against the external API.
 * Returns sync detail object.
 */
async function syncProject(
  supabase: any,
  project: any,
  externalDbConfig: { baseUrl: string; username: string; password: string },
  placementTeams: any[]
): Promise<{ detail: any; synced: boolean; error?: string }> {
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
      console.error(`Authentication failed for project ${project.name}:`, authResponse.status, authError);
      throw new Error(`Authentication failed (${authResponse.status}): ${authError}`);
    }

    const authData = await authResponse.json();
    if (!authData.response || !authData.response.token) {
      throw new Error('No token received from authentication');
    }
    token = authData.response.token;
    console.log(`Authentication successful for project ${project.name}`);

    // Query external API
    let rawPlacementDate: string | null = null;
    let planningStartRaw: string | null = null;
    let planningEndRaw: string | null = null;
    let planningTeams: string[] = [];
    let rawAddress: string | null = null;

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
      if (queryData.response && queryData.response.scriptResult) {
        try {
          const orderData = JSON.parse(queryData.response.scriptResult);
          if (orderData.order) {
            if (orderData.order.plaatsingsdatum) {
              rawPlacementDate = orderData.order.plaatsingsdatum;
            }
            if (orderData.order.adres) {
              rawAddress = orderData.order.adres;
            }
            if (Array.isArray(orderData.order.planning) && orderData.order.planning.length > 0) {
              const p = orderData.order.planning[0];
              planningStartRaw = p.datum_start || p.start_date || null;
              planningEndRaw = p.datum_einde || p.end_date || null;
              if (p.teams) {
                if (Array.isArray(p.teams)) planningTeams = p.teams;
                else if (typeof p.teams === 'string') planningTeams = [p.teams];
                else if (typeof p.teams === 'object') planningTeams = Object.values(p.teams).filter(v => typeof v === 'string') as string[];
              }
            }
          }
        } catch (parseErr) {
          console.error(`Failed to parse script result for project ${project.name}:`, parseErr);
        }
      }
    } else {
      const queryError = await queryResponse.text();
      console.error(`Query failed for project ${project.name}:`, queryResponse.status, queryError);
    }

    // Process dates
    if (!planningStartRaw && !rawPlacementDate) {
      return {
        detail: { project_name: project.name, project_link_id: project.project_link_id, status: 'no_date_found' },
        synced: false
      };
    }

    const startFromPlanning = planningStartRaw ? parseExternalDate(planningStartRaw) : null;
    const endFromPlanning = planningEndRaw ? parseExternalDate(planningEndRaw) : null;
    const placementConverted = rawPlacementDate ? convertWeekNumberToDate(rawPlacementDate) : null;
    const externalInstallationDate = startFromPlanning || placementConverted;

    const normalizedExternal = externalInstallationDate ? new Date(externalInstallationDate).toISOString().split('T')[0] : null;
    const normalizedCurrent = project.installation_date ? new Date(project.installation_date).toISOString().split('T')[0] : null;
    const normalizedEndFromPlanning = endFromPlanning ? new Date(endFromPlanning).toISOString().split('T')[0] : null;

    // Resolve the external team
    let matchedTeam: any = null;
    let externalTeamName = 'unnamed';
    for (const teamText of planningTeams) {
      if (!teamText || typeof teamText !== 'string') continue;
      const normalizedTeamText = teamText.trim().toLowerCase();
      matchedTeam = placementTeams?.find(team => {
        if (!team.external_team_names || !Array.isArray(team.external_team_names)) return false;
        return team.external_team_names.some((extName: string) => {
          const n = extName.trim().toLowerCase();
          return n === normalizedTeamText || normalizedTeamText.includes(n) || n.includes(normalizedTeamText);
        });
      });
      if (matchedTeam) { externalTeamName = teamText; break; }
    }

    // Fetch current team assignment to compare
    const { data: currentPTA } = await supabase
      .from('project_team_assignments')
      .select('team_id, team, start_date, duration')
      .eq('project_id', project.id)
      .limit(1)
      .maybeSingle();

    const currentTeamId = currentPTA?.team_id || null;
    const currentStartDate = currentPTA?.start_date ? new Date(currentPTA.start_date).toISOString().split('T')[0] : null;
    const currentDuration = currentPTA?.duration || null;

    const newDuration = (startFromPlanning && endFromPlanning) ? daysBetweenInclusive(startFromPlanning, endFromPlanning) : null;
    const newTeamId = matchedTeam?.id || null;

    // Determine what changed
    const dateChanged = normalizedExternal !== normalizedCurrent;
    const teamChanged = newTeamId && newTeamId !== currentTeamId;
    const startDateChanged = startFromPlanning && startFromPlanning !== currentStartDate;
    const durationChanged = newDuration && newDuration !== currentDuration;

    const changes: string[] = [];
    if (dateChanged) changes.push('installation_date');
    if (teamChanged) changes.push('team');
    if (startDateChanged) changes.push('start_date');
    if (durationChanged) changes.push('duration');

    if (changes.length === 0) {
      return {
        detail: { project_name: project.name, project_link_id: project.project_link_id, status: 'up_to_date', current_date: normalizedCurrent, current_team: currentPTA?.team || null },
        synced: false
      };
    }

    console.log(`Project ${project.name}: changes detected: ${changes.join(', ')}`);

    // Parse address if available
    const addressFields: Record<string, string | null> = {};
    if (rawAddress) {
      const adres = rawAddress.trim();
      const commaIdx = adres.indexOf(',');
      if (commaIdx > 0) {
        const streetPart = adres.substring(0, commaIdx).trim();
        const cityPart = adres.substring(commaIdx + 1).trim();
        const streetMatch = streetPart.match(/^(.+?)\s+(\d+\S*)$/);
        if (streetMatch) {
          addressFields.address_street = streetMatch[1];
          addressFields.address_number = streetMatch[2];
        } else {
          addressFields.address_street = streetPart;
        }
        const cityMatch = cityPart.match(/^(\d+)\s+(.+)$/);
        if (cityMatch) {
          addressFields.address_postal_code = cityMatch[1];
          addressFields.address_city = cityMatch[2];
        } else {
          addressFields.address_city = cityPart;
        }
      } else {
        addressFields.address_street = adres;
      }
    }

    // Update project installation date and address if changed
    const projectUpdate: Record<string, any> = { updated_at: new Date().toISOString() };
    if (dateChanged && normalizedExternal) {
      projectUpdate.installation_date = normalizedExternal;
    }
    if (Object.keys(addressFields).length > 0) {
      Object.assign(projectUpdate, addressFields);
      if (!changes.includes('address')) changes.push('address');
    }
    if (Object.keys(projectUpdate).length > 1) {
      const { error: updateProjectError } = await supabase
        .from('projects')
        .update(projectUpdate)
        .eq('id', project.id);
      if (updateProjectError) throw new Error(`Failed to update project: ${updateProjectError.message}`);
    }

    // Upsert team assignment if any team/date/duration changed
    if (startFromPlanning && endFromPlanning) {
      const { error: upsertErr } = await supabase
        .from('project_team_assignments')
        .upsert({
          project_id: project.id,
          team_id: newTeamId,
          team: matchedTeam?.name || externalTeamName,
          start_date: startFromPlanning,
          duration: newDuration!,
          updated_at: new Date().toISOString()
        }, { onConflict: 'project_id' });

      if (upsertErr) console.warn(`PTA upsert failed: ${upsertErr.message}`);

      // Enforce installation_date = start date
      await supabase.from('projects')
        .update({ installation_date: startFromPlanning, updated_at: new Date().toISOString() })
        .eq('id', project.id);
    }

    // Recalculate task due dates
    const { data: phases } = await supabase.from('phases').select('id').eq('project_id', project.id);
    if (phases && phases.length > 0) {
      for (const phase of phases) {
        const { data: tasks } = await supabase.from('tasks').select('id, standard_task_id').eq('phase_id', phase.id);
        for (const task of tasks || []) {
          if (task.standard_task_id && normalizedExternal) {
            const { data: st } = await supabase.from('standard_tasks').select('day_counter').eq('id', task.standard_task_id).single();
            if (st) {
              const installDate = new Date(normalizedExternal);
              installDate.setDate(installDate.getDate() - (st.day_counter || 0));
              await supabase.from('tasks').update({ due_date: installDate.toISOString().split('T')[0], updated_at: new Date().toISOString() }).eq('id', task.id);
            }
          }
        }
      }
    }

    return {
      detail: {
        project_name: project.name,
        project_link_id: project.project_link_id,
        status: 'updated',
        changes,
        old_date: normalizedCurrent,
        new_date: normalizedExternal,
        old_team_id: currentTeamId,
        new_team_id: newTeamId,
        new_team_name: matchedTeam?.name || externalTeamName,
        old_duration: currentDuration,
        new_duration: newDuration,
      },
      synced: true
    };

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error processing project ${project.name}:`, msg);
    return {
      detail: { project_name: project.name, project_link_id: project.project_link_id, status: 'error', error: msg },
      synced: false,
      error: msg
    };
  } finally {
    if (token) {
      try {
        await fetch(`${externalDbConfig.baseUrl}/sessions/${token}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
      } catch (_) {}
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the caller (user JWT or cron anon key)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const token = authHeader.replace('Bearer ', '');
    // Allow anon key (cron) or valid user JWT
    if (token === supabaseAnonKey) {
      console.log('Authenticated via anon key (cron job)');
    } else {
      const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await authSupabase.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log('Authenticated via user JWT:', user.id);
    }

    console.log('Starting project sync process...');
    const body = await req.json().catch(() => ({ automated: true }));
    const { automated = false } = body;

    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Determine configs to use
    let configsToProcess: Array<{ tenantId: string; config: { baseUrl: string; username: string; password: string } }> = [];

    if (body.config) {
      // Manual call with explicit config — use it for all projects (legacy behavior)
      configsToProcess.push({ tenantId: '', config: body.config });
    } else {
      // Load ALL tenant configs for 'projects' API type
      console.log('Loading ALL tenant project API configs from database...');
      const { data: allConfigs, error: configError } = await supabase
        .from('external_api_configs')
        .select('*')
        .eq('api_type', 'projects');

      if (configError || !allConfigs || allConfigs.length === 0) {
        console.error('No project API configs found:', configError);
        throw new Error('No Projects API configurations found. Please save the configuration in Settings first.');
      }

      console.log(`Found ${allConfigs.length} tenant project API configs`);
      for (const cfg of allConfigs) {
        configsToProcess.push({
          tenantId: cfg.tenant_id,
          config: { baseUrl: cfg.base_url, username: cfg.username, password: cfg.password }
        });
      }
    }

    // Fetch placement teams once
    const { data: placementTeams } = await supabase.from('placement_teams').select('id, name, external_team_names');

    let totalSynced = 0;
    let totalErrors = 0;
    let totalProjects = 0;
    const allDetails: any[] = [];
    const allErrorDetails: string[] = [];

    for (const { tenantId, config: externalDbConfig } of configsToProcess) {
      console.log(`Processing tenant ${tenantId || 'all'} with baseUrl: ${externalDbConfig.baseUrl}`);

      // Get projects for this tenant
      let query = supabase
        .from('projects')
        .select('id, name, project_link_id, installation_date')
        .not('project_link_id', 'is', null)
        .not('project_link_id', 'eq', '');

      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data: projects, error: projectsError } = await query;

      if (projectsError) {
        console.error(`Failed to fetch projects for tenant ${tenantId}:`, projectsError.message);
        allErrorDetails.push(`Tenant ${tenantId}: ${projectsError.message}`);
        totalErrors++;
        continue;
      }

      console.log(`Found ${projects?.length || 0} projects for tenant ${tenantId || 'all'}`);
      totalProjects += projects?.length || 0;

      for (const project of projects || []) {
        const result = await syncProject(supabase, project, externalDbConfig, placementTeams || []);
        allDetails.push(result.detail);
        if (result.synced) totalSynced++;
        if (result.error) {
          totalErrors++;
          allErrorDetails.push(`Project ${project.project_link_id}: ${result.error}`);
        }
      }
    }

    // Log sync results per tenant
    for (const { tenantId } of configsToProcess) {
      const tenantDetails = allDetails.filter((d: any) => {
        // Match by tenant from the detail's project lookup
        return true; // For now log all details per config entry
      });
      const tenantSynced = tenantDetails.filter((d: any) => d.status === 'updated').length;
      const tenantErrorDetails = tenantDetails.filter((d: any) => d.status === 'error');
      const tenantErrorMsgs = tenantErrorDetails.map((d: any) => `${d.project_name}: ${d.error}`);

      try {
        await supabase.from('project_sync_logs').insert({
          synced_count: tenantSynced,
          error_count: tenantErrorDetails.length,
          details: {
            automated,
            total_projects: tenantDetails.length,
            tenants_processed: 1,
            sync_details: tenantDetails,
            error_details: tenantErrorMsgs,
            timestamp: new Date().toISOString()
          },
          tenant_id: tenantId || null,
        });
      } catch (logErr) {
        console.error('Failed to log sync results for tenant:', logErr);
      }

      try {
        await supabase.from('automation_logs').insert({
          action_type: 'project_sync',
          status: tenantErrorDetails.length > 0 ? 'partial' : 'success',
          summary: `${tenantSynced} synced, ${tenantErrorDetails.length} errors (${automated ? 'automated' : 'manual'})`,
          error_message: tenantErrorMsgs.length > 0 ? tenantErrorMsgs.join('; ') : null,
          details: { totalProjects: tenantDetails.length, totalSynced: tenantSynced, totalErrors: tenantErrorDetails.length, automated },
          tenant_id: tenantId || null,
        });
      } catch (logErr) {
        console.error('Failed to log automation result:', logErr);
      }
    }

    // Send error alert if there were errors
    if (totalErrors > 0) {
      try {
        await supabase.functions.invoke('send-error-alert', {
          body: {
            action_type: 'project_sync',
            error_message: allErrorDetails.join('\n'),
            summary: `Project sync: ${totalErrors} errors out of ${totalProjects} projects`,
            details: { totalSynced, totalErrors, automated },
          }
        });
      } catch (alertErr) {
        console.error('Failed to send error alert:', alertErr);
      }
    }

    const result = {
      success: true,
      message: `${automated ? 'Automated' : 'Manual'} sync completed: ${totalSynced} projects updated, ${totalErrors} errors`,
      syncedCount: totalSynced,
      errorCount: totalErrors,
      totalProjects,
      automated,
      details: allDetails,
      timestamp: new Date().toISOString()
    };

    console.log('Sync process completed:', result);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Sync process failed:', error);

    // Log critical error and send alert
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const errorSupabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await errorSupabase.from('automation_logs').insert({
        action_type: 'project_sync',
        status: 'error',
        summary: 'Project sync failed completely',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });

      await errorSupabase.functions.invoke('send-error-alert', {
        body: {
          action_type: 'project_sync',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          summary: 'Project sync failed completely',
        }
      });
    } catch (alertErr) {
      console.error('Failed to send error alert:', alertErr);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
