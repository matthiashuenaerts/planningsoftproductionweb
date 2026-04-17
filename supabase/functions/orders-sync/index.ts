import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const WALL_CLOCK_LIMIT_MS = 110_000; // 110s — leave margin for cleanup + re-invoke
const FETCH_TIMEOUT_MS = 20_000;     // 20s per FileMaker call

function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function convertWeekNumberToDate(weekString: string | null | undefined): string | null {
  if (!weekString) return null;
  const s = String(weekString).trim();
  if (s.length === 6 && /^\d{6}$/.test(s)) {
    const year = parseInt(s.substring(0, 4));
    const week = parseInt(s.substring(4, 6));
    const jan1 = new Date(year, 0, 1);
    const jan1Day = jan1.getDay();
    const daysToFirstMonday = jan1Day === 0 ? 1 : (8 - jan1Day);
    const firstMonday = new Date(year, 0, 1 + daysToFirstMonday);
    const targetDate = new Date(firstMonday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
    return targetDate.toISOString().split('T')[0];
  }
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch (_) {}
  return null;
}

function normDate(v: any): string | null {
  if (!v) return null;
  try {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch (_) {}
  return null;
}

function strEq(a: any, b: any): boolean {
  return (a ?? '') === (b ?? '');
}

// ─── Per-project worker ───────────────────────────────────────────────
async function syncProjectOrders(
  supabase: any,
  project: { id: string; name: string; project_link_id: string },
  baseUrl: string,
  apiToken: string,
  tenantId: string,
): Promise<{
  detail: any;
  changed: boolean;
  ordersAdded: number;
  ordersUpdated: number;
  ordersUnchanged: number;
  itemsChanged: number;
  error?: string;
}> {
  try {
    const layout = encodeURIComponent('API_order');
    const scriptName = encodeURIComponent('FindSupplierOrderByOrderNumber');
    const param = encodeURIComponent(String(project.project_link_id));
    const queryUrl = `${baseUrl}/layouts/${layout}/script/${scriptName}?script.param=${param}`;

    const queryResponse = await fetchWithTimeout(queryUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!queryResponse.ok) {
      const errText = await queryResponse.text();
      throw new Error(`Orders query failed (${queryResponse.status}): ${errText}`);
    }

    const rawQueryData = await queryResponse.json();
    let queryData: any = rawQueryData;
    try {
      const scriptResult = rawQueryData?.response?.scriptResult;
      if (scriptResult) queryData = JSON.parse(scriptResult);
    } catch (_) {
      console.warn(`Failed to parse scriptResult for project ${project.name}, using raw response`);
    }

    if (!queryData || !Array.isArray(queryData.bestellingen) || queryData.bestellingen.length === 0) {
      return {
        detail: { project_name: project.name, project_link_id: project.project_link_id, tenant_id: tenantId, status: 'no_orders', orders_found: 0 },
        changed: false, ordersAdded: 0, ordersUpdated: 0, ordersUnchanged: 0, itemsChanged: 0,
      };
    }

    const externalOrders = queryData.bestellingen;
    let ordersAdded = 0;
    let ordersUpdated = 0;
    let ordersUnchanged = 0;
    let itemsChanged = 0;

    for (const externalOrder of externalOrders) {
      const rawOrderNumber = externalOrder.ordernummer ?? externalOrder.bestelnummer ?? externalOrder.ordernr ?? externalOrder.orderNumber ?? externalOrder.bestellingsnummer ?? null;
      const orderNumber = typeof rawOrderNumber === 'string' ? rawOrderNumber.trim() : (rawOrderNumber != null ? String(rawOrderNumber) : null);
      if (!orderNumber) continue;

      const supplier = externalOrder.leverancier || 'Unknown';
      const expectedDelivery = convertWeekNumberToDate(externalOrder.leverweek);
      const isDelivered = !!externalOrder.isVolledigOntvangen;
      const isShipped = !!externalOrder.isVerzonden;
      const referentie = externalOrder.referentie ?? null;

      // Fetch existing order (with items) for diff
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id, expected_delivery, status, supplier, notes, source')
        .eq('external_order_number', orderNumber)
        .eq('project_id', project.id)
        .maybeSingle();

      // Compute desired status (upgrade-only for delivered)
      let desiredStatus = 'pending';
      if (isDelivered) desiredStatus = 'delivered';
      else if (existingOrder?.status === 'delivered') desiredStatus = 'delivered';
      else if (isShipped) desiredStatus = 'pending';

      if (existingOrder) {
        // Diff fields
        const expectedDeliveryNorm = normDate(expectedDelivery);
        const existingDeliveryNorm = normDate(existingOrder.expected_delivery);

        const updates: Record<string, any> = {};
        if (!strEq(expectedDeliveryNorm, existingDeliveryNorm)) updates.expected_delivery = expectedDelivery;
        if (!strEq(existingOrder.status, desiredStatus)) updates.status = desiredStatus;
        if (!strEq(existingOrder.supplier, supplier)) updates.supplier = supplier;
        if (!strEq(existingOrder.source, 'external database')) updates.source = 'external database';
        // Preserve manual notes; only set when empty or matching
        if (!existingOrder.notes || strEq(existingOrder.notes, referentie)) {
          if (!strEq(existingOrder.notes, referentie)) updates.notes = referentie;
        }

        if (Object.keys(updates).length > 0) {
          updates.updated_at = new Date().toISOString();
          const { error: updateError } = await supabase.from('orders').update(updates).eq('id', existingOrder.id);
          if (updateError) throw new Error(`Failed to update order ${orderNumber}: ${updateError.message}`);
          ordersUpdated++;
        } else {
          ordersUnchanged++;
        }

        // Sync items: only insert/update what's actually changed
        if (Array.isArray(externalOrder.artikelen) && externalOrder.artikelen.length > 0) {
          const { data: existingItems } = await supabase
            .from('order_items')
            .select('id, article_code, ean, description, quantity, delivered_quantity, notes')
            .eq('order_id', existingOrder.id);

          const existingByCode = new Map<string, any>();
          for (const it of existingItems || []) {
            const key = (it.article_code || it.ean || it.description || '').toString().trim();
            if (key) existingByCode.set(key, it);
          }

          for (const artikel of externalOrder.artikelen) {
            const articleCode = artikel.artikel || null;
            const ean = artikel.ean || null;
            const description = artikel.omschrijving || 'No description';
            const quantity = parseInt(artikel.aantal) || 1;
            const deliveredQty = desiredStatus === 'delivered' ? quantity : 0;
            const notes = artikel.categorie ? `Category: ${artikel.categorie}` : null;

            const key = (articleCode || ean || description).toString().trim();
            const existingItem = existingByCode.get(key);

            if (existingItem) {
              const itemUpdates: Record<string, any> = {};
              if (!strEq(existingItem.description, description)) itemUpdates.description = description;
              if ((existingItem.quantity ?? 0) !== quantity) itemUpdates.quantity = quantity;
              if (!strEq(existingItem.article_code, articleCode)) itemUpdates.article_code = articleCode;
              if (!strEq(existingItem.ean, ean)) itemUpdates.ean = ean;
              if (!strEq(existingItem.notes, notes)) itemUpdates.notes = notes;
              // Only upgrade delivered_quantity, never reduce manual progress
              if ((existingItem.delivered_quantity ?? 0) < deliveredQty) {
                itemUpdates.delivered_quantity = deliveredQty;
              }
              if (Object.keys(itemUpdates).length > 0) {
                const { error: itemUpdErr } = await supabase
                  .from('order_items')
                  .update(itemUpdates)
                  .eq('id', existingItem.id);
                if (itemUpdErr) console.warn(`Item update failed: ${itemUpdErr.message}`);
                else itemsChanged++;
              }
            } else {
              const { error: itemInsErr } = await supabase
                .from('order_items')
                .insert({
                  order_id: existingOrder.id,
                  description,
                  quantity,
                  article_code: articleCode,
                  ean,
                  delivered_quantity: deliveredQty,
                  notes,
                });
              if (itemInsErr) console.warn(`Item insert failed: ${itemInsErr.message}`);
              else itemsChanged++;
            }
          }
        }
      } else {
        // Insert new order
        const { data: newOrder, error: insertError } = await supabase
          .from('orders')
          .insert({
            project_id: project.id,
            external_order_number: orderNumber,
            supplier,
            order_date: new Date().toISOString(),
            expected_delivery: expectedDelivery,
            status: desiredStatus,
            order_type: 'standard',
            notes: referentie,
            source: 'external database',
          })
          .select('id')
          .single();

        if (insertError) throw new Error(`Failed to create order ${orderNumber}: ${insertError.message}`);
        ordersAdded++;

        if (Array.isArray(externalOrder.artikelen) && externalOrder.artikelen.length > 0) {
          const itemsToInsert = externalOrder.artikelen.map((artikel: any) => {
            const quantity = parseInt(artikel.aantal) || 1;
            return {
              order_id: newOrder.id,
              description: artikel.omschrijving || 'No description',
              quantity,
              article_code: artikel.artikel || null,
              ean: artikel.ean || null,
              delivered_quantity: desiredStatus === 'delivered' ? quantity : 0,
              notes: artikel.categorie ? `Category: ${artikel.categorie}` : null,
            };
          });
          const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
          if (itemsError) console.warn(`Items insert failed for order ${orderNumber}: ${itemsError.message}`);
          else itemsChanged += itemsToInsert.length;
        }
      }
    }

    const changed = ordersAdded > 0 || ordersUpdated > 0 || itemsChanged > 0;

    return {
      detail: {
        project_name: project.name,
        project_link_id: project.project_link_id,
        tenant_id: tenantId,
        status: changed ? 'synced' : 'up_to_date',
        orders_found: externalOrders.length,
        orders_added: ordersAdded,
        orders_updated: ordersUpdated,
        orders_unchanged: ordersUnchanged,
        items_changed: itemsChanged,
      },
      changed, ordersAdded, ordersUpdated, ordersUnchanged, itemsChanged,
    };
  } catch (error: any) {
    const msg = error?.message || 'Unknown error';
    console.error(`Error syncing orders for project ${project.name}:`, msg);
    return {
      detail: { project_name: project.name, project_link_id: project.project_link_id, tenant_id: tenantId, status: 'error', error: msg },
      changed: false, ordersAdded: 0, ordersUpdated: 0, ordersUnchanged: 0, itemsChanged: 0, error: msg,
    };
  }
}

// ─── Dispatcher: spawn one invocation per tenant ──────────────────────
async function dispatchPerTenant(supabase: any, automated: boolean): Promise<Response> {
  const { data: configs } = await supabase
    .from('external_api_configs')
    .select('tenant_id')
    .eq('api_type', 'orders')
    .not('tenant_id', 'is', null);

  const tenantIds = Array.from(new Set((configs || []).map((c: any) => c.tenant_id))) as string[];
  console.log(`orders-sync dispatcher: invoking ${tenantIds.length} tenant(s) sequentially`);

  const dispatched: string[] = [];
  for (const tenantId of tenantIds) {
    try {
      // Sequential dispatch: each tenant runs in its own invocation, but we wait
      // before spawning the next one so logs/results are easy to follow.
      const { error } = await supabase.functions.invoke('orders-sync', {
        body: { automated, tenant_id: tenantId },
      });
      if (error) console.error(`Failed to dispatch tenant ${tenantId}:`, error.message);
      else dispatched.push(tenantId);
    } catch (e: any) {
      console.error(`Dispatch error for tenant ${tenantId}:`, e?.message || e);
    }
  }

  return new Response(JSON.stringify({
    success: true,
    message: `Dispatched orders-sync for ${dispatched.length}/${tenantIds.length} tenant(s)`,
    dispatched,
    totalTenants: tenantIds.length,
    automated,
    timestamp: new Date().toISOString(),
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ─── Single-tenant worker invocation ──────────────────────────────────
async function syncSingleTenant(
  supabase: any,
  tenantId: string,
  automated: boolean,
  requestedProjectIds: string[] | null,
  startTime: number,
): Promise<Response> {
  const { data: cfg, error: cfgErr } = await supabase
    .from('external_api_configs')
    .select('*')
    .eq('api_type', 'orders')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (cfgErr || !cfg) {
    throw new Error(`No Orders API config found for tenant ${tenantId}`);
  }

  const baseUrl = (cfg.base_url || '').replace(/\/+$/, '');
  console.log(`Processing orders for tenant ${tenantId} with baseUrl: ${baseUrl}`);

  // Fetch projects
  let query = supabase
    .from('projects')
    .select('id, name, project_link_id')
    .eq('tenant_id', tenantId)
    .not('project_link_id', 'is', null)
    .not('project_link_id', 'eq', '');

  if (requestedProjectIds && requestedProjectIds.length > 0) {
    query = query.in('id', requestedProjectIds);
  }

  const { data: projects, error: projectsError } = await query;
  if (projectsError) throw new Error(`Failed to load projects: ${projectsError.message}`);

  const projectList = projects || [];
  console.log(`Found ${projectList.length} projects for tenant ${tenantId}`);

  // Authenticate ONCE per tenant
  let apiToken: string | null = null;
  try {
    const authResponse = await fetchWithTimeout(`${baseUrl}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(`${cfg.username}:${cfg.password}`),
      },
      body: JSON.stringify({}),
    });
    if (!authResponse.ok) {
      const errText = await authResponse.text();
      throw new Error(`API auth failed (${authResponse.status}): ${errText}`);
    }
    const authData = await authResponse.json();
    apiToken = authData?.response?.token;
    if (!apiToken) throw new Error('No token received from Orders API');
    console.log(`Authenticated with orders API for tenant ${tenantId}`);
  } catch (authErr: any) {
    throw new Error(`Tenant ${tenantId} auth failed: ${authErr?.message || authErr}`);
  }

  let synced = 0;
  let upToDate = 0;
  let errors = 0;
  let totalOrdersAdded = 0;
  let totalOrdersUpdated = 0;
  let totalItemsChanged = 0;
  const details: any[] = [];
  const errorMessages: string[] = [];
  const skippedProjectIds: string[] = [];
  let timedOut = false;

  try {
    for (let i = 0; i < projectList.length; i++) {
      const project = projectList[i];

      if (Date.now() - startTime > WALL_CLOCK_LIMIT_MS) {
        console.warn(`⏱️ Wall-clock limit reached after ${Math.round((Date.now() - startTime) / 1000)}s — pausing`);
        timedOut = true;
        for (let j = i; j < projectList.length; j++) skippedProjectIds.push(projectList[j].id);
        break;
      }

      console.log(`[${tenantId}] Syncing project ${project.name} (${project.project_link_id})`);
      const result = await syncProjectOrders(supabase, project, baseUrl, apiToken, tenantId);
      details.push(result.detail);

      if (result.error) {
        errors++;
        errorMessages.push(`Project ${project.project_link_id}: ${result.error}`);
      } else if (result.changed) {
        synced++;
      } else {
        upToDate++;
      }
      totalOrdersAdded += result.ordersAdded;
      totalOrdersUpdated += result.ordersUpdated;
      totalItemsChanged += result.itemsChanged;
    }
  } finally {
    try {
      await fetchWithTimeout(`${baseUrl}/sessions/${apiToken}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      }, 5000);
    } catch (_) {}
  }

  const elapsedMs = Date.now() - startTime;
  const summary = `${synced} synced, ${upToDate} up-to-date, ${errors} errors${timedOut ? `, ${skippedProjectIds.length} skipped (continuation scheduled)` : ''}`;
  console.log(`[${tenantId}] Completed in ${Math.round(elapsedMs / 1000)}s: ${summary}`);

  // Log per-tenant results
  try {
    await supabase.from('orders_sync_logs').insert({
      synced_count: synced,
      error_count: errors,
      details: {
        automated, tenant_id: tenantId,
        total_projects: projectList.length,
        orders_added: totalOrdersAdded,
        orders_updated: totalOrdersUpdated,
        items_changed: totalItemsChanged,
        up_to_date: upToDate,
        timed_out: timedOut,
        skipped: skippedProjectIds.length,
        details, timestamp: new Date().toISOString(),
        elapsed_ms: elapsedMs,
      },
      tenant_id: tenantId,
    });
  } catch (logErr) {
    console.error('Failed to log orders_sync_logs:', logErr);
  }

  try {
    await supabase.from('automation_logs').insert({
      action_type: 'order_sync',
      status: errors > 0 ? 'partial' : (timedOut ? 'partial' : 'success'),
      summary: `[${tenantId}] ${summary} (${automated ? 'automated' : 'manual'})`,
      error_message: errorMessages.length > 0 ? errorMessages.join('; ') : null,
      details: {
        tenant_id: tenantId, totalProjects: projectList.length,
        synced, upToDate, errors,
        ordersAdded: totalOrdersAdded, ordersUpdated: totalOrdersUpdated, itemsChanged: totalItemsChanged,
        timedOut, skipped: skippedProjectIds.length, automated,
      },
      tenant_id: tenantId,
    });
  } catch (logErr) {
    console.error('Failed to log automation_logs:', logErr);
  }

  if (errors > 0) {
    try {
      await supabase.functions.invoke('send-error-alert', {
        body: {
          action_type: 'order_sync',
          error_message: errorMessages.join('\n'),
          summary: `[${tenantId}] Order sync: ${errors} errors`,
          details: { tenantId, synced, errors, automated, timedOut },
        },
      });
    } catch (_) {}
  }

  // Continuation re-invocation
  if (timedOut && skippedProjectIds.length > 0) {
    console.log(`🔄 Re-invoking orders-sync for ${skippedProjectIds.length} remaining projects (tenant: ${tenantId})`);
    try {
      await supabase.functions.invoke('orders-sync', {
        body: { automated: true, tenant_id: tenantId, project_ids: skippedProjectIds },
      });
    } catch (reInvokeErr) {
      console.error('Failed to re-invoke orders-sync:', reInvokeErr);
    }
  }

  return new Response(JSON.stringify({
    success: errors === 0,
    message: `[${tenantId}] ${automated ? 'Automated' : 'Manual'} orders sync completed in ${Math.round(elapsedMs / 1000)}s: ${summary}`,
    tenant_id: tenantId,
    syncedCount: synced,
    upToDateCount: upToDate,
    errorCount: errors,
    ordersAdded: totalOrdersAdded,
    ordersUpdated: totalOrdersUpdated,
    itemsChanged: totalItemsChanged,
    totalProjects: projectList.length,
    automated, timedOut, skipped: skippedProjectIds.length,
    details, errors: errorMessages,
    timestamp: new Date().toISOString(), elapsed_ms: elapsedMs,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ─── Entrypoint ───────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Auth (anon key for cron, JWT for user calls)
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
      console.log('Authenticated via anon key (cron job / dispatch)');
    } else {
      const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: userError } = await authSupabase.auth.getClaims(token);
      const userId = claimsData?.claims?.sub;
      if (userError || !userId) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log('Authenticated via user JWT:', userId);
    }

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const automated = body?.automated ?? false;
    const requestedTenantId: string | null = body?.tenant_id ?? null;
    const requestedProjectIds: string[] | null = Array.isArray(body?.project_ids) ? body.project_ids : null;

    // Mode 1: dispatcher — no tenant_id provided → fan out per tenant sequentially
    if (!requestedTenantId) {
      return await dispatchPerTenant(supabase, !!automated);
    }

    // Mode 2: single tenant worker
    return await syncSingleTenant(supabase, requestedTenantId, !!automated, requestedProjectIds, startTime);

  } catch (error: any) {
    const msg = error?.message || 'Unknown error';
    console.error('Error in orders-sync function:', msg);
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const errorSupabase = createClient(supabaseUrl, supabaseServiceKey);
      await errorSupabase.from('automation_logs').insert({
        action_type: 'order_sync', status: 'error',
        summary: 'Order sync failed', error_message: msg,
      });
      await errorSupabase.functions.invoke('send-error-alert', {
        body: { action_type: 'order_sync', error_message: msg, summary: 'Order sync failed' },
      });
    } catch (_) {}

    return new Response(JSON.stringify({ success: false, error: msg, timestamp: new Date().toISOString() }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
