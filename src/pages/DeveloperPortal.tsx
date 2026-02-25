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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2, Users, Globe, Plus, Trash2, ExternalLink,
  ChevronDown, ChevronRight, LogOut, Shield, Rocket, UserPlus,
} from "lucide-react";
import TenantOnboardingWizard from "@/components/developer/TenantOnboardingWizard";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  logo_url: string | null;
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

type UserRoleRow = {
  id: string;
  user_id: string;
  role: string;
};

async function fetchTenants(): Promise<TenantRow[]> {
  const { data, error } = await supabase
    .from("tenants")
    .select("id,name,slug,custom_domain,logo_url,is_active,created_at")
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

async function fetchAllRoles(): Promise<UserRoleRow[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("id,user_id,role");
  if (error) throw error;
  return (data ?? []) as UserRoleRow[];
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

  const { data: userRoles } = useQuery({
    queryKey: ["dev", "userRoles"],
    queryFn: fetchAllRoles,
  });

  // Create tenant form
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);

  // Expanded tenant cards
  const [expandedTenants, setExpandedTenants] = useState<Set<string>>(new Set());

  // Alias form per tenant
  const [aliasInputs, setAliasInputs] = useState<Record<string, string>>({});
  // Tenant name editing
  const [editingNames, setEditingNames] = useState<Record<string, string>>({});
  // Add user form per tenant
  const [addUserForms, setAddUserForms] = useState<Record<string, { email: string; name: string; password: string; role: string }>>({});
  const [addingUser, setAddingUser] = useState<string | null>(null);
  // Onboarding wizard state
  const [onboardingTenant, setOnboardingTenant] = useState<{ id: string; name: string; slug: string } | null>(null);
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
      const tenantName = name.trim();
      const { data: inserted, error } = await supabase.from("tenants").insert({
        name: tenantName,
        slug: finalSlug,
        custom_domain: customDomain.trim() || null,
        logo_url: logoUrl.trim() || null,
        is_active: true,
      }).select("id").single();
      if (error) throw error;

      setName("");
      setSlug("");
      setCustomDomain("");
      setLogoUrl("");
      await qc.invalidateQueries({ queryKey: ["dev"] });
      toast({ title: "Tenant created", description: `Created ${finalSlug}` });
      
      // Open onboarding wizard for the new tenant
      setOnboardingTenant({ id: inserted.id, name: tenantName, slug: finalSlug });
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

  const updateTenantName = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("tenants").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dev", "tenants"] });
      toast({ title: "Tenant name updated" });
    },
    onError: (e: any) => {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    },
  });

  const getEmployeesForTenant = (tenantId: string) =>
    (employees ?? []).filter((e) => e.tenant_id === tenantId);

  const getRolesForEmployee = (employeeId: string) =>
    (userRoles ?? []).filter((r) => r.user_id === employeeId).map((r) => r.role);

  const getAliasesForTenant = (tenantId: string) =>
    (aliases ?? []).filter((a) => a.tenant_id === tenantId);

  const handleAddUserToTenant = async (tenantId: string) => {
    const form = addUserForms[tenantId];
    if (!form?.email || !form?.name || !form?.password || !form?.role) {
      toast({ title: "Missing fields", description: "All fields are required", variant: "destructive" });
      return;
    }
    setAddingUser(tenantId);
    try {
      const { data, error } = await supabase.functions.invoke('create-employee', {
        body: {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          tenantId,
        }
      });
      if (error) throw error;

      // If a role other than the employee role is specified, also add to user_roles
      const employeeId = data?.employee?.id;
      if (employeeId && ['admin', 'developer', 'advisor', 'calculator'].includes(form.role)) {
        await supabase.from('user_roles').insert({
          user_id: employeeId,
          role: form.role as any,
        } as any);
      }

      setAddUserForms((p) => ({ ...p, [tenantId]: { email: '', name: '', password: '', role: 'worker' } }));
      await qc.invalidateQueries({ queryKey: ["dev"] });
      toast({ title: "User created", description: `${form.name} added to tenant` });
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message ?? "Error creating user", variant: "destructive" });
    } finally {
      setAddingUser(null);
    }
  };

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
          <CardContent className="grid gap-4 md:grid-cols-5">
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
            <div className="space-y-1">
              <Label className="text-slate-300">Logo URL (optional)</Label>
              <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." className="bg-white/10 border-white/20 text-white placeholder:text-slate-500" />
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
                          className="text-blue-400 hover:text-blue-300"
                          onClick={() => setOnboardingTenant({ id: t.id, name: t.name, slug: t.slug })}
                        >
                          <Rocket className="h-4 w-4 mr-1" /> Setup
                        </Button>
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
                        {/* Tenant Name Edit */}
                        <div>
                          <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                            <Building2 className="h-4 w-4" /> Display Name
                          </h3>
                          <div className="flex gap-2">
                            <Input
                              value={editingNames[t.id] ?? t.name}
                              onChange={(e) => setEditingNames((p) => ({ ...p, [t.id]: e.target.value }))}
                              className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 flex-1 max-w-sm"
                            />
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700"
                              disabled={(editingNames[t.id] ?? t.name) === t.name}
                              onClick={() => {
                                const newName = editingNames[t.id]?.trim();
                                if (newName && newName !== t.name) {
                                  updateTenantName.mutate({ id: t.id, name: newName });
                                }
                              }}
                            >
                              Save Name
                            </Button>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">This name is shown in the sidebar of the tenant's application</p>
                        </div>

                        {/* Employees */}
                        <div>
                          <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                            <Users className="h-4 w-4" /> Employees ({tenantEmployees.length})
                          </h3>
                          {tenantEmployees.length === 0 ? (
                            <p className="text-xs text-slate-500">No employees found.</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {tenantEmployees.map((emp) => {
                                const empRoles = getRolesForEmployee(emp.id);
                                return (
                                  <div key={emp.id} className="flex items-center justify-between bg-white/5 rounded-md px-3 py-2">
                                    <div>
                                      <p className="text-sm font-medium text-white">{emp.name}</p>
                                      <p className="text-xs text-slate-400">
                                        {emp.role} {emp.email ? `· ${emp.email}` : ""}
                                      </p>
                                      {empRoles.length > 0 && (
                                        <div className="flex gap-1 mt-1">
                                          {empRoles.map((r) => (
                                            <Badge key={r} className="text-[10px] bg-blue-600/60 px-1.5 py-0">{r}</Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <Badge variant="outline" className={emp.auth_user_id ? "border-emerald-500 text-emerald-400" : "border-amber-500 text-amber-400"}>
                                      {emp.auth_user_id ? "Linked" : "Not migrated"}
                                    </Badge>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Add User Form */}
                          <div className="mt-3 p-3 bg-white/5 rounded-md space-y-2">
                            <h4 className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                              <UserPlus className="h-3 w-3" /> Add New User
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                              <Input
                                value={addUserForms[t.id]?.name || ""}
                                onChange={(e) => setAddUserForms((p) => ({ ...p, [t.id]: { ...p[t.id] || { email: '', password: '', role: 'worker' }, name: e.target.value } }))}
                                placeholder="Name"
                                className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 text-xs h-8"
                              />
                              <Input
                                value={addUserForms[t.id]?.email || ""}
                                onChange={(e) => setAddUserForms((p) => ({ ...p, [t.id]: { ...p[t.id] || { name: '', password: '', role: 'worker' }, email: e.target.value } }))}
                                placeholder="Email"
                                type="email"
                                className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 text-xs h-8"
                              />
                              <Input
                                value={addUserForms[t.id]?.password || ""}
                                onChange={(e) => setAddUserForms((p) => ({ ...p, [t.id]: { ...p[t.id] || { name: '', email: '', role: 'worker' }, password: e.target.value } }))}
                                placeholder="Password"
                                type="password"
                                className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 text-xs h-8"
                              />
                              <Select
                                value={addUserForms[t.id]?.role || "worker"}
                                onValueChange={(v) => setAddUserForms((p) => ({ ...p, [t.id]: { ...p[t.id] || { name: '', email: '', password: '' }, role: v } }))}
                              >
                                <SelectTrigger className="bg-white/10 border-white/20 text-white text-xs h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="manager">Manager</SelectItem>
                                  <SelectItem value="teamleader">Teamleader</SelectItem>
                                  <SelectItem value="worker">Worker</SelectItem>
                                  <SelectItem value="preparater">Preparater</SelectItem>
                                  <SelectItem value="workstation">Workstation</SelectItem>
                                  <SelectItem value="installation_team">Installation Team</SelectItem>
                                  <SelectItem value="advisor">Advisor</SelectItem>
                                  <SelectItem value="calculator">Calculator</SelectItem>
                                  <SelectItem value="developer">Developer</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs"
                                disabled={addingUser === t.id}
                                onClick={() => handleAddUserToTenant(t.id)}
                              >
                                {addingUser === t.id ? "Adding..." : "Add User"}
                              </Button>
                            </div>
                          </div>
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
      {onboardingTenant && (
        <TenantOnboardingWizard
          tenantId={onboardingTenant.id}
          tenantName={onboardingTenant.name}
          tenantSlug={onboardingTenant.slug}
          onComplete={() => {
            setOnboardingTenant(null);
            qc.invalidateQueries({ queryKey: ["dev"] });
          }}
          onCancel={() => setOnboardingTenant(null)}
        />
      )}
    </main>
  );
};

export default DeveloperPortal;
