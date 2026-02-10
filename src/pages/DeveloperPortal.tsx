import React, { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import {
  Building2, Users, Globe, Plus, Trash2, ExternalLink,
  ChevronDown, ChevronRight, LogOut, Shield,
} from "lucide-react";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  is_active: boolean;
  created_at: string;
};

type EmployeeRow = {
  id: string;
  name: string;
  role: string;
  email: string | null;
  auth_user_id: string | null;
  tenant_id: string;
};

type AliasRow = {
  id: string;
  tenant_id: string;
  domain: string;
  is_primary: boolean;
};

async function fetchTenants(): Promise<TenantRow[]> {
  const { data, error } = await supabase
    .from("tenants")
    .select("id,name,slug,custom_domain,is_active,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TenantRow[];
}

async function fetchAllEmployees(): Promise<EmployeeRow[]> {
  const { data, error } = await supabase
    .from("employees")
    .select("id,name,role,email,auth_user_id,tenant_id")
    .order("name");
  if (error) throw error;
  return (data ?? []) as EmployeeRow[];
}

async function fetchAllAliases(): Promise<AliasRow[]> {
  const { data, error } = await supabase
    .from("tenant_aliases")
    .select("id,tenant_id,domain,is_primary")
    .order("domain");
  if (error) throw error;
  return (data ?? []) as AliasRow[];
}

const DeveloperPortal: React.FC = () => {
  const { toast } = useToast();
  const { logout, currentEmployee } = useAuth();
  const qc = useQueryClient();

  const { data: tenants, isLoading: tenantsLoading } = useQuery({
    queryKey: ["dev", "tenants"],
    queryFn: fetchTenants,
  });

  const { data: employees } = useQuery({
    queryKey: ["dev", "employees"],
    queryFn: fetchAllEmployees,
  });

  const { data: aliases } = useQuery({
    queryKey: ["dev", "aliases"],
    queryFn: fetchAllAliases,
  });

  // Create tenant form
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [saving, setSaving] = useState(false);

  // Expanded tenant cards
  const [expandedTenants, setExpandedTenants] = useState<Set<string>>(new Set());

  // Alias form per tenant
  const [aliasInputs, setAliasInputs] = useState<Record<string, string>>({});

  const suggestedSlug = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const toggleTenant = (id: string) => {
    setExpandedTenants((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCreateTenant = async () => {
    const finalSlug = (slug || suggestedSlug).trim();
    if (!name.trim() || !finalSlug) {
      toast({ title: "Missing fields", description: "Name and slug are required", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase.from("tenants").insert({
        name: name.trim(),
        slug: finalSlug,
        custom_domain: customDomain.trim() || null,
        is_active: true,
      });
      if (error) throw error;

      setName("");
      setSlug("");
      setCustomDomain("");
      await qc.invalidateQueries({ queryKey: ["dev"] });
      toast({ title: "Tenant created", description: `Created ${finalSlug}` });
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message ?? "Error creating tenant", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addAlias = useMutation({
    mutationFn: async ({ tenantId, domain }: { tenantId: string; domain: string }) => {
      const { error } = await supabase.from("tenant_aliases").insert({
        tenant_id: tenantId,
        domain: domain.trim().toLowerCase(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dev", "aliases"] });
      toast({ title: "Alias added" });
    },
    onError: (e: any) => {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    },
  });

  const removeAlias = useMutation({
    mutationFn: async (aliasId: string) => {
      const { error } = await supabase.from("tenant_aliases").delete().eq("id", aliasId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dev", "aliases"] });
      toast({ title: "Alias removed" });
    },
  });

  const toggleTenantActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("tenants").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dev", "tenants"] });
    },
  });

  const getEmployeesForTenant = (tenantId: string) =>
    (employees ?? []).filter((e) => e.tenant_id === tenantId);

  const getAliasesForTenant = (tenantId: string) =>
    (aliases ?? []).filter((a) => a.tenant_id === tenantId);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-blue-400" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">Developer Portal</h1>
              <p className="text-xs text-slate-400">
                Logged in as {currentEmployee?.name ?? "Developer"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="flex items-center gap-4 p-5">
              <Building2 className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-2xl font-bold">{tenants?.length ?? 0}</p>
                <p className="text-sm text-slate-400">Tenants</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="flex items-center gap-4 p-5">
              <Users className="h-8 w-8 text-emerald-400" />
              <div>
                <p className="text-2xl font-bold">{employees?.length ?? 0}</p>
                <p className="text-sm text-slate-400">Total Users</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10 text-white">
            <CardContent className="flex items-center gap-4 p-5">
              <Globe className="h-8 w-8 text-purple-400" />
              <div>
                <p className="text-2xl font-bold">{aliases?.length ?? 0}</p>
                <p className="text-sm text-slate-400">Alias Domains</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Create Tenant */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Plus className="h-5 w-5" /> Create New Tenant
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-slate-300">Company Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Thonon" className="bg-white/10 border-white/20 text-white placeholder:text-slate-500" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Slug</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={suggestedSlug || "thonon"} className="bg-white/10 border-white/20 text-white placeholder:text-slate-500" />
              <p className="text-xs text-slate-500">automattion-compass.com/{slug || suggestedSlug || "slug"}/</p>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Primary Domain (optional)</Label>
              <Input value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="planning.thonon.be" className="bg-white/10 border-white/20 text-white placeholder:text-slate-500" />
            </div>
            <div className="flex items-end">
              <Button onClick={handleCreateTenant} disabled={saving} className="bg-blue-600 hover:bg-blue-700 w-full">
                {saving ? "Creating..." : "Create Tenant"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tenant List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
            <Building2 className="h-5 w-5" /> All Tenants
          </h2>

          {tenantsLoading ? (
            <p className="text-slate-400">Loading...</p>
          ) : !tenants?.length ? (
            <p className="text-slate-400">No tenants yet.</p>
          ) : (
            <div className="space-y-3">
              {tenants.map((t) => {
                const isExpanded = expandedTenants.has(t.id);
                const tenantEmployees = getEmployeesForTenant(t.id);
                const tenantAliases = getAliasesForTenant(t.id);

                return (
                  <Card key={t.id} className="bg-white/5 border-white/10 overflow-hidden">
                    {/* Tenant Header */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition"
                      onClick={() => toggleTenant(t.id)}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                        <div>
                          <div className="font-medium text-white flex items-center gap-2">
                            {t.name}
                            <Badge variant={t.is_active ? "default" : "secondary"} className={t.is_active ? "bg-emerald-600/80" : "bg-red-600/80"}>
                              {t.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-3 mt-0.5">
                            <span>Slug: <code className="text-blue-300">{t.slug}</code></span>
                            {t.custom_domain && <span>Domain: <code className="text-purple-300">{t.custom_domain}</code></span>}
                            <span>{tenantEmployees.length} users</span>
                            <span>{tenantAliases.length} aliases</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-400 hover:text-white"
                          onClick={() => toggleTenantActive.mutate({ id: t.id, is_active: !t.is_active })}
                        >
                          {t.is_active ? "Deactivate" : "Activate"}
                        </Button>
                        <a
                          href={`/${t.slug}/login`}
                          className="text-slate-400 hover:text-blue-400"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t border-white/10 p-4 space-y-6">
                        {/* Employees */}
                        <div>
                          <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                            <Users className="h-4 w-4" /> Employees ({tenantEmployees.length})
                          </h3>
                          {tenantEmployees.length === 0 ? (
                            <p className="text-xs text-slate-500">No employees found.</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {tenantEmployees.map((emp) => (
                                <div key={emp.id} className="flex items-center justify-between bg-white/5 rounded-md px-3 py-2">
                                  <div>
                                    <p className="text-sm font-medium text-white">{emp.name}</p>
                                    <p className="text-xs text-slate-400">
                                      {emp.role} {emp.email ? `· ${emp.email}` : ""}
                                    </p>
                                  </div>
                                  <Badge variant="outline" className={emp.auth_user_id ? "border-emerald-500 text-emerald-400" : "border-amber-500 text-amber-400"}>
                                    {emp.auth_user_id ? "Linked" : "Not migrated"}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Alias URLs */}
                        <div>
                          <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                            <Globe className="h-4 w-4" /> Alias URLs
                          </h3>

                          {tenantAliases.length > 0 && (
                            <div className="space-y-1 mb-3">
                              {tenantAliases.map((alias) => (
                                <div key={alias.id} className="flex items-center justify-between bg-white/5 rounded-md px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <code className="text-sm text-blue-300">{alias.domain}</code>
                                    {alias.is_primary && <Badge className="bg-blue-600/80 text-xs">Primary</Badge>}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-400 hover:text-red-300 h-7 w-7 p-0"
                                    onClick={() => removeAlias.mutate(alias.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Input
                              value={aliasInputs[t.id] || ""}
                              onChange={(e) => setAliasInputs((p) => ({ ...p, [t.id]: e.target.value }))}
                              placeholder="e.g. planning.company.be"
                              className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 flex-1"
                            />
                            <Button
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700"
                              disabled={!aliasInputs[t.id]?.trim()}
                              onClick={() => {
                                addAlias.mutate({ tenantId: t.id, domain: aliasInputs[t.id] });
                                setAliasInputs((p) => ({ ...p, [t.id]: "" }));
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" /> Add Alias
                            </Button>
                          </div>
                        </div>

                        {/* URLs overview */}
                        <div>
                          <h3 className="text-sm font-semibold text-slate-300 mb-2">Access URLs</h3>
                          <div className="text-xs text-slate-400 space-y-1">
                            <p>Path: <code className="text-blue-300">automattion-compass.com/{t.slug}/</code></p>
                            <p>Login: <a href={`/${t.slug}/login`} className="text-blue-300 hover:underline">/{t.slug}/login</a></p>
                            {t.custom_domain && <p>Custom domain: <code className="text-purple-300">https://{t.custom_domain}</code></p>}
                            {tenantAliases.map((a) => (
                              <p key={a.id}>Alias: <code className="text-purple-300">https://{a.domain}</code></p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default DeveloperPortal;
