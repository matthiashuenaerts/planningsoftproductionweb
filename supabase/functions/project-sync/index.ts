import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const WALL_CLOCK_LIMIT_MS = 110_000; // 110s to leave margin for cleanup + re-invoke
const FETCH_TIMEOUT_MS = 15_000; // 15s per external API call

function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function convertWeekNumberToDate(weekNumber: string): string {
  if (/^\d{6}$/.test(weekNumber)) {
    const year = parseInt(weekNumber.substring(0, 4));
    const week = parseInt(weekNumber.substring(4, 6));
    const jan1 = new Date(year, 0, 1);
    const jan1Day = jan1.getDay();
    const daysToFirstMonday = jan1Day === 0 ? 1 : (8 - jan1Day);
    const firstMonday = new Date(year, 0, 1 + daysToFirstMonday);
    const targetDate = new Date(firstMonday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
    return targetDate.toISOString().split('T')[0];
  }
  if (weekNumber) {
    try {
      const date = new Date(weekNumber);
      if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
    } catch (_) {}
  }
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
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function parseAddress(rawAddress: string | null): Record<string, string | null> {
  const fields: Record<string, string | null> = {};
  if (!rawAddress) return fields;
  const adres = rawAddress.trim();
  const commaIdx = adres.indexOf(',');
  if (commaIdx > 0) {
    const streetPart = adres.substring(0, commaIdx).trim();
    const cityPart = adres.substring(commaIdx + 1).trim();
    const streetMatch = streetPart.match(/^(.+?)\s+(\d+\S*)$/);
    if (streetMatch) { fields.address_street = streetMatch[1]; fields.address_number = streetMatch[2]; }
    else { fields.address_street = streetPart; }
    const cityMatch = cityPart.match(/^(\d+)\s+(.+)$/);
    if (cityMatch) { fields.address_postal_code = cityMatch[1]; fields.address_city = cityMatch[2]; }
    else { fields.address_city = cityPart; }
  } else {
    fields.address_street = adres;
  }
  return fields;
}

async function syncProject(
  supabase: any,
  project: any,
  baseUrl: string,
  apiToken: string,
  placementTeams: any[]
): Promise<{ detail: any; synced: boolean; error?: string }> {
  try {
    console.log(`Processing project ${project.name} (${project.project_link_id})`);

    let rawPlacementDate: string | null = null;
    let planningStartRaw: string | null = null;
    let planningEndRaw: string | null = null;
    let planningTeams: string[] = [];
    let rawAddress: string | null = null;

    const queryResponse = await fetchWithTimeout(
      `${baseUrl}/layouts/API_order/script/FindOrderNumber?script.param=${project.project_link_id}`,
      { method: 'GET', headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' } }
    );

    if (queryResponse.ok) {
      const queryData = await queryResponse.json();
      if (queryData.response?.scriptResult) {
        try {
          const orderData = JSON.parse(queryData.response.scriptResult);
          if (orderData.order) {
            if (orderData.order.plaatsingsdatum) rawPlacementDate = orderData.order.plaatsingsdatum;
            if (orderData.order.adres) rawAddress = orderData.order.adres;
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

    // Store the raw installation week (e.g. "202611")
    const installationWeek = rawPlacementDate && /^\d{6}$/.test(rawPlacementDate) ? rawPlacementDate : null;

    if (!planningStartRaw && !rawPlacementDate) {
      return { detail: { project_name: project.name, project_link_id: project.project_link_id, status: 'no_date_found' }, synced: false };
    }

    const startFromPlanning = planningStartRaw ? parseExternalDate(planningStartRaw) : null;
    const endFromPlanning = planningEndRaw ? parseExternalDate(planningEndRaw) : null;
    const placementConverted = rawPlacementDate ? convertWeekNumberToDate(rawPlacementDate) : null;
    const externalInstallationDate = startFromPlanning || placementConverted;

    const normalizedExternal = externalInstallationDate ? new Date(externalInstallationDate).toISOString().split('T')[0] : null;
    const normalizedCurrent = project.installation_date ? new Date(project.installation_date).toISOString().split('T')[0] : null;

    // Resolve external team
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

    // Fetch current team assignment
    const { data: currentPTA } = await supabase
      .from('project_team_assignments')
      .select('team_id, team, start_date, duration')
      .eq('project_id', project.id)
      .eq('is_service_ticket', false)
      .limit(1)
      .maybeSingle();

    const currentTeamId = currentPTA?.team_id || null;
    const currentStartDate = currentPTA?.start_date ? new Date(currentPTA.start_date).toISOString().split('T')[0] : null;
    const currentDuration = currentPTA?.duration || null;

    const newDuration = (startFromPlanning && endFromPlanning) ? daysBetweenInclusive(startFromPlanning, endFromPlanning) : null;
    const newTeamId = matchedTeam?.id || null;

    // --- Compare ALL fields before deciding to update ---
    const dateChanged = normalizedExternal && normalizedExternal !== normalizedCurrent;
    const teamChanged = newTeamId && newTeamId !== currentTeamId;
    const startDateChanged = startFromPlanning && startFromPlanning !== currentStartDate;
    const durationChanged = newDuration && newDuration !== currentDuration;

    // Compare address fields against current project data
    const addressFields = parseAddress(rawAddress);
    const addressChanged = Object.keys(addressFields).length > 0 && Object.entries(addressFields).some(
      ([key, val]) => (val || null) !== (project[key] || null)
    );

    const changes: string[] = [];
    if (dateChanged) changes.push('installation_date');
    if (teamChanged) changes.push('team');
    if (startDateChanged) changes.push('start_date');
    if (durationChanged) changes.push('duration');
    if (addressChanged) changes.push('address');

    // No changes at all → skip entirely
    if (changes.length === 0) {
      return { detail: { project_name: project.name, project_link_id: project.project_link_id, status: 'up_to_date' }, synced: false };
    }

    console.log(`Project ${project.name}: changes detected: ${changes.join(', ')}`);

    // --- Only update project table if project-level fields changed ---
    const projectUpdate: Record<string, any> = {};
    if (dateChanged) projectUpdate.installation_date = normalizedExternal;
    if (addressChanged) Object.assign(projectUpdate, addressFields);

    if (Object.keys(projectUpdate).length > 0) {
      projectUpdate.updated_at = new Date().toISOString();
      const { error: updateProjectError } = await supabase.from('projects').update(projectUpdate).eq('id', project.id);
      if (updateProjectError) throw new Error(`Failed to update project: ${updateProjectError.message}`);
    }

    // --- Only update/insert team assignment if team/start/duration actually changed ---
    if (startFromPlanning && endFromPlanning && (teamChanged || startDateChanged || durationChanged)) {
      const ptaPayload: Record<string, any> = {
        team_id: newTeamId,
        team: matchedTeam?.name || externalTeamName,
        start_date: startFromPlanning,
        duration: newDuration!,
        updated_at: new Date().toISOString()
      };

      if (currentPTA) {
        // Update existing assignment
        const { error: updateErr } = await supabase
          .from('project_team_assignments')
          .update(ptaPayload)
          .eq('project_id', project.id)
          .eq('is_service_ticket', false);
        if (updateErr) console.warn(`PTA update failed: ${updateErr.message}`);
      } else {
        // Insert new assignment
        const { error: insertErr } = await supabase
          .from('project_team_assignments')
          .insert({ ...ptaPayload, project_id: project.id, is_service_ticket: false });
        if (insertErr) console.warn(`PTA insert failed: ${insertErr.message}`);
      }

      // Sync installation_date from planning start if it differs
      if (startFromPlanning !== normalizedCurrent) {
        await supabase.from('projects')
          .update({ installation_date: startFromPlanning, updated_at: new Date().toISOString() })
          .eq('id', project.id);
      }
    }

    // Recalculate task due dates only if installation date actually changed
    if (dateChanged && normalizedExternal) {
      const { data: phases } = await supabase.from('phases').select('id').eq('project_id', project.id);
      if (phases && phases.length > 0) {
        for (const phase of phases) {
          const { data: tasks } = await supabase.from('tasks').select('id, standard_task_id').eq('phase_id', phase.id);
          for (const task of tasks || []) {
            if (task.standard_task_id) {
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
    }

    return {
      detail: {
        project_name: project.name, project_link_id: project.project_link_id, status: 'updated',
        changes, old_date: normalizedCurrent, new_date: normalizedExternal,
        old_team_id: currentTeamId, new_team_id: newTeamId,
        new_team_name: matchedTeam?.name || externalTeamName,
        old_duration: currentDuration, new_duration: newDuration,
      },
      synced: true
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error processing project ${project.name}:`, msg);
    return { detail: { project_name: project.name, project_link_id: project.project_link_id, status: 'error', error: msg }, synced: false, error: msg };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Authenticate the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const token = authHeader.replace('Bearer ', '');
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
    const body = await req.json().catch(() => ({}));
    const { automated = false, tenant_id: requestedTenantId = null, project_ids: requestedProjectIds = null } = body;

    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Load tenant config(s)
    let configQuery = supabase
      .from('external_api_configs')
      .select('*')
      .eq('api_type', 'projects');

    if (requestedTenantId) {
      configQuery = configQuery.eq('tenant_id', requestedTenantId);
    }

    const { data: allConfigs, error: configError } = await configQuery;

    if (configError || !allConfigs || allConfigs.length === 0) {
      const msg = requestedTenantId
        ? `No Projects API config found for tenant ${requestedTenantId}.`
        : 'No Projects API configurations found.';
      throw new Error(msg);
    }

    console.log(`Processing ${allConfigs.length} tenant config(s)${requestedTenantId ? ` (tenant: ${requestedTenantId})` : ''}`);

    // Fetch placement teams
    let teamsQuery = supabase.from('placement_teams').select('id, name, external_team_names');
    if (requestedTenantId) teamsQuery = teamsQuery.eq('tenant_id', requestedTenantId);
    const { data: placementTeams } = await teamsQuery;

    let totalSynced = 0;
    let totalErrors = 0;
    let totalProjects = 0;
    let totalSkipped = 0;
    const allDetails: any[] = [];
    const allErrorDetails: string[] = [];
    let timedOut = false;
    const skippedProjectIds: string[] = [];
    let skippedTenantId: string | null = null;

    for (const cfg of allConfigs) {
      if (timedOut) break;

      const tenantId = cfg.tenant_id;
      const baseUrl = cfg.base_url;
      console.log(`Processing tenant ${tenantId} with baseUrl: ${baseUrl}`);

      // Get projects for this tenant — filter by specific IDs if provided (continuation)
      let query = supabase
        .from('projects')
        .select('id, name, project_link_id, installation_date, address_street, address_number, address_postal_code, address_city')
        .not('project_link_id', 'is', null)
        .not('project_link_id', 'eq', '');

      if (tenantId) query = query.eq('tenant_id', tenantId);
      if (requestedProjectIds && Array.isArray(requestedProjectIds) && requestedProjectIds.length > 0) {
        query = query.in('id', requestedProjectIds);
      }

      const { data: projects, error: projectsError } = await query;

      if (projectsError) {
        allErrorDetails.push(`Tenant ${tenantId}: ${projectsError.message}`);
        totalErrors++;
        continue;
      }

      console.log(`Found ${projects?.length || 0} projects for tenant ${tenantId}`);
      totalProjects += projects?.length || 0;

      if (!projects || projects.length === 0) continue;

      // Authenticate ONCE per tenant
      let apiToken: string | null = null;
      try {
        const authResponse = await fetchWithTimeout(`${baseUrl}/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + btoa(`${cfg.username}:${cfg.password}`)
          }
        });

        if (!authResponse.ok) {
          const errText = await authResponse.text();
          throw new Error(`Auth failed (${authResponse.status}): ${errText}`);
        }

        const authData = await authResponse.json();
        apiToken = authData?.response?.token;
        if (!apiToken) throw new Error('No token received');
        console.log(`Authenticated with external API for tenant ${tenantId}`);
      } catch (authErr: any) {
        console.error(`External API auth failed for tenant ${tenantId}:`, authErr.message);
        allErrorDetails.push(`Tenant ${tenantId} auth: ${authErr.message}`);
        totalErrors++;
        continue;
      }

      try {
        for (let i = 0; i < projects.length; i++) {
          const project = projects[i];

          if (Date.now() - startTime > WALL_CLOCK_LIMIT_MS) {
            console.warn(`⏱️ Wall-clock limit reached after ${Math.round((Date.now() - startTime) / 1000)}s — stopping gracefully`);
            timedOut = true;
            // Collect remaining project IDs for continuation
            for (let j = i; j < projects.length; j++) {
              skippedProjectIds.push(projects[j].id);
            }
            skippedTenantId = tenantId;
            totalSkipped += projects.length - i;
            break;
          }

          const result = await syncProject(supabase, project, baseUrl, apiToken, placementTeams || []);
          allDetails.push({ ...result.detail, tenant_id: tenantId });
          if (result.synced) totalSynced++;
          if (result.error) {
            totalErrors++;
            allErrorDetails.push(`Project ${project.project_link_id}: ${result.error}`);
          }
        }
      } finally {
        try {
          await fetchWithTimeout(`${baseUrl}/sessions/${apiToken}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } }, 5000);
        } catch (_) {}
      }
    }

    // Log sync results per tenant
    const tenantIds = [...new Set(allConfigs.map((c: any) => c.tenant_id))];
    for (const tenantId of tenantIds) {
      const tenantDetails = allDetails.filter((d: any) => d.tenant_id === tenantId);
      const tenantSynced = tenantDetails.filter((d: any) => d.status === 'updated').length;
      const tenantErrorDetails = tenantDetails.filter((d: any) => d.status === 'error');

      try {
        await supabase.from('project_sync_logs').insert({
          synced_count: tenantSynced,
          error_count: tenantErrorDetails.length,
          details: { automated, total_projects: tenantDetails.length, sync_details: tenantDetails, timed_out: timedOut, skipped: totalSkipped, timestamp: new Date().toISOString() },
          tenant_id: tenantId || null,
        });
      } catch (logErr) {
        console.error('Failed to log sync results:', logErr);
      }

      try {
        await supabase.from('automation_logs').insert({
          action_type: 'project_sync',
          status: tenantErrorDetails.length > 0 ? 'partial' : (timedOut ? 'partial' : 'success'),
          summary: `${tenantSynced} synced, ${tenantErrorDetails.length} errors${timedOut ? `, ${totalSkipped} skipped (timeout → continuation scheduled)` : ''} (${automated ? 'automated' : 'manual'})`,
          error_message: tenantErrorDetails.length > 0 ? tenantErrorDetails.map((d: any) => `${d.project_name}: ${d.error}`).join('; ') : null,
          details: { totalProjects: tenantDetails.length, totalSynced: tenantSynced, totalErrors: tenantErrorDetails.length, timedOut, totalSkipped, automated },
          tenant_id: tenantId || null,
        });
      } catch (logErr) {
        console.error('Failed to log automation result:', logErr);
      }
    }

    // Send error alert if needed
    if (totalErrors > 0) {
      try {
        await supabase.functions.invoke('send-error-alert', {
          body: { action_type: 'project_sync', error_message: allErrorDetails.join('\n'), summary: `Project sync: ${totalErrors} errors`, details: { totalSynced, totalErrors, automated, timedOut, totalSkipped } }
        });
      } catch (_) {}
    }

    // --- Re-invoke for skipped projects on timeout ---
    if (timedOut && skippedProjectIds.length > 0 && skippedTenantId) {
      console.log(`🔄 Re-invoking project-sync for ${skippedProjectIds.length} remaining projects (tenant: ${skippedTenantId})`);
      try {
        await supabase.functions.invoke('project-sync', {
          body: {
            automated: true,
            tenant_id: skippedTenantId,
            project_ids: skippedProjectIds,
          }
        });
        console.log('✅ Continuation invocation sent successfully');
      } catch (reInvokeErr) {
        console.error('Failed to re-invoke project-sync for remaining projects:', reInvokeErr);
      }
    }

    const elapsedMs = Date.now() - startTime;
    const result = {
      success: true,
      message: `${automated ? 'Automated' : 'Manual'} sync completed in ${Math.round(elapsedMs / 1000)}s: ${totalSynced} updated, ${totalErrors} errors${timedOut ? `, ${totalSkipped} skipped (continuation scheduled)` : ''}`,
      syncedCount: totalSynced, errorCount: totalErrors, totalProjects, automated, timedOut, skipped: totalSkipped,
      details: allDetails, timestamp: new Date().toISOString(), elapsed_ms: elapsedMs
    };

    console.log('Sync completed:', result.message);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Sync process failed:', error);
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const errorSupabase = createClient(supabaseUrl, supabaseServiceKey);
      await errorSupabase.from('automation_logs').insert({ action_type: 'project_sync', status: 'error', summary: 'Project sync failed completely', error_message: error instanceof Error ? error.message : 'Unknown error' });
      await errorSupabase.functions.invoke('send-error-alert', { body: { action_type: 'project_sync', error_message: error instanceof Error ? error.message : 'Unknown error', summary: 'Project sync failed completely' } });
    } catch (_) {}

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
