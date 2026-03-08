import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity, AlertTriangle, Users, Building2, FolderOpen, 
  Clock, Server, Wifi, WifiOff, BarChart3, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, ArrowRightLeft,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const DevDashboard: React.FC = () => {
  // Stats: tenant count, total employees, total projects
  const { data: stats } = useQuery({
    queryKey: ["dev", "dashboard", "stats"],
    queryFn: async () => {
      const [tenants, employees, projects, activeUsers] = await Promise.all([
        supabase.from("tenants").select("id", { count: "exact", head: true }),
        supabase.from("employees").select("id", { count: "exact", head: true }),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("employees").select("id", { count: "exact", head: true }).not("auth_user_id", "is", null),
      ]);
      return {
        tenantCount: tenants.count ?? 0,
        employeeCount: employees.count ?? 0,
        projectCount: projects.count ?? 0,
        activeUserCount: activeUsers.count ?? 0,
      };
    },
    refetchInterval: 60000,
  });

  // Recent activity: latest projects, tasks, orders across all tenants
  const { data: recentProjects } = useQuery({
    queryKey: ["dev", "dashboard", "recent-projects"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, created_at, tenant_id, status")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  // Tenant names lookup
  const { data: tenantMap } = useQuery({
    queryKey: ["dev", "dashboard", "tenants"],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("id, name, slug");
      const map: Record<string, { name: string; slug: string }> = {};
      (data ?? []).forEach((t: any) => { map[t.id] = { name: t.name, slug: t.slug }; });
      return map;
    },
  });

  // External API configs & errors
  const { data: apiConfigs } = useQuery({
    queryKey: ["dev", "dashboard", "api-configs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("external_api_configs")
        .select("id, api_type, base_url, tenant_id, updated_at")
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  // Support tickets
  const { data: recentTickets } = useQuery({
    queryKey: ["dev", "dashboard", "support"],
    queryFn: async () => {
      const { data } = await supabase
        .from("support_tickets")
        .select("id, title, status, priority, created_at, tenant_id")
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  // Rush orders across tenants
  const { data: rushOrderStats } = useQuery({
    queryKey: ["dev", "dashboard", "rush-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rush_orders")
        .select("id, status")
        .in("status", ["pending", "in_progress"]);
      return {
        pending: (data ?? []).filter((r: any) => r.status === "pending").length,
        inProgress: (data ?? []).filter((r: any) => r.status === "in_progress").length,
      };
    },
  });

  const getTenantName = (id: string) => tenantMap?.[id]?.name ?? "Unknown";

  const statusColor = (status: string) => {
    const colors: Record<string, string> = {
      open: "bg-blue-500/20 text-blue-300",
      in_progress: "bg-yellow-500/20 text-yellow-300",
      resolved: "bg-green-500/20 text-green-300",
      closed: "bg-slate-500/20 text-slate-300",
      pending: "bg-amber-500/20 text-amber-300",
    };
    return colors[status] ?? "bg-slate-500/20 text-slate-300";
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="flex items-center gap-3 p-4">
            <Building2 className="h-8 w-8 text-blue-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats?.tenantCount ?? 0}</p>
              <p className="text-xs text-slate-400">Tenants</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-8 w-8 text-emerald-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats?.activeUserCount ?? 0}</p>
              <p className="text-xs text-slate-400">Active Users</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="flex items-center gap-3 p-4">
            <FolderOpen className="h-8 w-8 text-purple-400" />
            <div>
              <p className="text-2xl font-bold text-white">{stats?.projectCount ?? 0}</p>
              <p className="text-xs text-slate-400">Projects</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
            <div>
              <p className="text-2xl font-bold text-white">{rushOrderStats?.pending ?? 0}</p>
              <p className="text-xs text-slate-400">Pending Rush Orders</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4" /> Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(recentProjects ?? []).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between bg-white/5 rounded-md px-3 py-2">
                <div>
                  <p className="text-sm text-white">{p.name}</p>
                  <p className="text-xs text-slate-400">
                    {getTenantName(p.tenant_id)} · {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                  </p>
                </div>
                <Badge className="text-[10px] bg-blue-600/40">{p.status || "active"}</Badge>
              </div>
            ))}
            {!(recentProjects ?? []).length && <p className="text-slate-400 text-sm">No recent projects</p>}
          </CardContent>
        </Card>

        {/* System Health / External API Configs */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-sm">
              <Server className="h-4 w-4" /> External API Integrations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(apiConfigs ?? []).map((cfg: any) => (
              <div key={cfg.id} className="flex items-center justify-between bg-white/5 rounded-md px-3 py-2">
                <div className="flex items-center gap-2">
                  <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                  <div>
                    <p className="text-sm text-white">{cfg.api_type}</p>
                    <p className="text-xs text-slate-400">{getTenantName(cfg.tenant_id)} · {cfg.base_url}</p>
                  </div>
                </div>
                <span className="text-[10px] text-slate-500">
                  {formatDistanceToNow(new Date(cfg.updated_at), { addSuffix: true })}
                </span>
              </div>
            ))}
            {!(apiConfigs ?? []).length && <p className="text-slate-400 text-sm">No API integrations configured</p>}
          </CardContent>
        </Card>

        {/* Support Tickets */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" /> Recent Support Tickets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(recentTickets ?? []).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between bg-white/5 rounded-md px-3 py-2">
                <div>
                  <p className="text-sm text-white">{t.title}</p>
                  <p className="text-xs text-slate-400">
                    {getTenantName(t.tenant_id)} · {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {t.priority === "high" && <Badge className="text-[10px] bg-red-600/60">high</Badge>}
                  <Badge className={`text-[10px] ${statusColor(t.status)}`}>{t.status}</Badge>
                </div>
              </div>
            ))}
            {!(recentTickets ?? []).length && <p className="text-slate-400 text-sm">No support tickets</p>}
          </CardContent>
        </Card>

        {/* Per-Tenant Stats */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4" /> Tenant Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TenantStatsTable />
          </CardContent>
        </Card>
        {/* Sync Logs */}
        <Card className="bg-white/5 border-white/10 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-sm">
              <ArrowRightLeft className="h-4 w-4" /> Project Sync Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SyncLogsPanel tenantMap={tenantMap} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const SyncLogsPanel: React.FC<{ tenantMap?: Record<string, { name: string; slug: string }> }> = ({ tenantMap }) => {
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const { data: syncLogs, refetch, isLoading } = useQuery({
    queryKey: ["dev", "dashboard", "sync-logs"],
    queryFn: async () => {
      const [projectLogs, orderLogs] = await Promise.all([
        supabase
          .from("project_sync_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(15),
        supabase
          .from("orders_sync_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(15),
      ]);
      const tagged = [
        ...(projectLogs.data ?? []).map((l: any) => ({ ...l, _sync_type: "project" })),
        ...(orderLogs.data ?? []).map((l: any) => ({ ...l, _sync_type: "order" })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
       .slice(0, 25);
      return tagged;
    },
    refetchInterval: 30000,
  });

  const getTenantName = (id: string) => tenantMap?.[id]?.name ?? id?.slice(0, 8) ?? "Unknown";

  return (
    <div className="space-y-2">
      <div className="flex justify-end mb-2">
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading} className="text-slate-400 hover:text-white text-xs">
          <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>
      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {(syncLogs ?? []).map((log: any) => {
            const details = log.details as any;
            const isExpanded = expandedLog === log.id;
            const syncType = log._sync_type as string;
            const syncDetails: any[] = syncType === 'order' 
              ? (details?.details ?? []) 
              : (details?.sync_details ?? []);
            const errorDetails: string[] = syncType === 'order'
              ? (details?.errors ?? [])
              : (details?.error_details ?? []);
            const hasErrors = (log.error_count ?? 0) > 0;
            const updatedProjects = syncType === 'order'
              ? syncDetails.filter((d: any) => d.status === 'synced' && (d.orders_added > 0 || d.orders_updated > 0))
              : syncDetails.filter((d: any) => d.status === 'updated');
            const errorProjects = syncDetails.filter((d: any) => d.status === 'error');

            return (
              <div key={log.id} className="bg-white/5 rounded-md border border-white/10">
                <button
                  className="w-full flex items-start justify-between px-3 py-2 text-left hover:bg-white/5 rounded-md"
                  onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                >
                  <div className="flex items-start gap-2">
                    {hasErrors ? (
                      <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-0.5">
                      <p className="text-sm text-white">
                        {log.synced_count ?? 0} synced · {log.error_count ?? 0} errors
                        {details?.total_projects != null && <span className="text-slate-400"> / {details.total_projects} total</span>}
                      </p>
                      {updatedProjects.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {updatedProjects.map((d: any, i: number) => (
                            <Badge key={i} className="text-[10px] bg-blue-600/30 text-blue-300 font-normal">
                              {d.project_name || d.project_link_id}
                              {d.changes && ` (${(d.changes as string[]).join(', ')})`}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {errorProjects.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {errorProjects.map((d: any, i: number) => (
                            <Badge key={i} className="text-[10px] bg-red-600/30 text-red-300 font-normal">
                              ✗ {d.project_name || d.project_link_id}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-slate-400">
                        {getTenantName(log.tenant_id)} · {log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true }) : ""}
                        {details?.automated ? " · automated" : " · manual"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {hasErrors && <Badge className="text-[10px] bg-red-600/40">{log.error_count} errors</Badge>}
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 border-t border-white/5 pt-2">
                    {errorDetails.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-red-400">Errors:</p>
                        {errorDetails.map((err, i) => (
                          <p key={i} className="text-xs text-red-300 bg-red-500/10 rounded px-2 py-1">{err}</p>
                        ))}
                      </div>
                    )}
                    {syncDetails.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-slate-400">Project details:</p>
                        {syncDetails.map((d: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-xs bg-white/5 rounded px-2 py-1">
                            <span className="text-white truncate max-w-[200px]">{d.project_name || d.project_link_id}</span>
                            <div className="flex items-center gap-2">
                              {d.changes && <span className="text-blue-300 text-[10px]">{(d.changes as string[]).join(', ')}</span>}
                              <Badge className={`text-[10px] ${
                                d.status === 'updated' ? 'bg-blue-600/40 text-blue-300' :
                                d.status === 'up_to_date' ? 'bg-slate-600/40 text-slate-300' :
                                d.status === 'error' ? 'bg-red-600/40 text-red-300' :
                                'bg-amber-600/40 text-amber-300'
                              }`}>
                                {d.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {!(syncLogs ?? []).length && <p className="text-slate-400 text-sm text-center py-4">No sync logs yet</p>}
        </div>
      </ScrollArea>
    </div>
  );
};

const TenantStatsTable: React.FC = () => {
  const { data } = useQuery({
    queryKey: ["dev", "dashboard", "tenant-stats"],
    queryFn: async () => {
      const { data: tenants } = await supabase.from("tenants").select("id, name, slug, is_active").order("name");
      if (!tenants?.length) return [];

      const results = await Promise.all(
        tenants.map(async (t: any) => {
          const [empCount, projCount] = await Promise.all([
            supabase.from("employees").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
            supabase.from("projects").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
          ]);
          return { ...t, employees: empCount.count ?? 0, projects: projCount.count ?? 0 };
        })
      );
      return results;
    },
  });

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-4 text-[10px] text-slate-500 font-medium px-3 py-1">
        <span>Tenant</span>
        <span className="text-center">Status</span>
        <span className="text-center">Users</span>
        <span className="text-center">Projects</span>
      </div>
      {(data ?? []).map((t: any) => (
        <div key={t.id} className="grid grid-cols-4 items-center bg-white/5 rounded-md px-3 py-2 text-sm">
          <span className="text-white truncate">{t.name}</span>
          <span className="text-center">
            <Badge className={`text-[10px] ${t.is_active ? "bg-emerald-600/60" : "bg-red-600/60"}`}>
              {t.is_active ? "Active" : "Off"}
            </Badge>
          </span>
          <span className="text-center text-slate-300">{t.employees}</span>
          <span className="text-center text-slate-300">{t.projects}</span>
        </div>
      ))}
    </div>
  );
};

export default DevDashboard;
