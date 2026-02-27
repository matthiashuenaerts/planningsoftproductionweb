import React, { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Building2, Users, Globe, Plus, Trash2, ExternalLink,
  ChevronDown, ChevronRight, LogOut, Shield, Rocket, UserPlus,
  FileText, LifeBuoy, Activity, Upload,
} from "lucide-react";
import TenantOnboardingWizard from "@/components/developer/TenantOnboardingWizard";
import DevTenantDetail from "@/components/developer/DevTenantDetail";
import DevDeveloperManagement from "@/components/developer/DevDeveloperManagement";
import DevDashboard from "@/components/developer/DevDashboard";
import DevSupportManagement from "@/components/developer/DevSupportManagement";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
};

async function fetchTenants(): Promise<TenantRow[]> {
  const { data, error } = await supabase
    .from("tenants")
    .select("id,name,slug,custom_domain,logo_url,is_active,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TenantRow[];
}

const DeveloperPortal: React.FC = () => {
  const { toast } = useToast();
  const { logout, currentEmployee } = useAuth();
  const qc = useQueryClient();

  const { data: tenants, isLoading: tenantsLoading } = useQuery({
    queryKey: ["dev", "tenants"],
    queryFn: fetchTenants,
  });

  // Create tenant form
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [onboardingTenant, setOnboardingTenant] = useState<{ id: string; name: string; slug: string } | null>(null);

  const suggestedSlug = name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

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
        name: tenantName, slug: finalSlug,
        custom_domain: customDomain.trim() || null,
        logo_url: logoUrl.trim() || null, is_active: true,
      }).select("id").single();
      if (error) throw error;
      setName(""); setSlug(""); setCustomDomain(""); setLogoUrl("");
      await qc.invalidateQueries({ queryKey: ["dev"] });
      toast({ title: "Tenant created", description: `Created ${finalSlug}` });
      setOnboardingTenant({ id: inserted.id, name: tenantName, slug: finalSlug });
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message ?? "Error creating tenant", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const selectedTenant = tenants?.find((t) => t.id === selectedTenantId);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-blue-400" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">Developer Portal</h1>
              <p className="text-xs text-slate-400">Logged in as {currentEmployee?.name ?? "Developer"}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="bg-white/10 border border-white/10">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-white/20 text-white">
              <Activity className="h-4 w-4 mr-1" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="tenants" className="data-[state=active]:bg-white/20 text-white">
              <Building2 className="h-4 w-4 mr-1" /> Tenants
            </TabsTrigger>
            <TabsTrigger value="developers" className="data-[state=active]:bg-white/20 text-white">
              <Shield className="h-4 w-4 mr-1" /> Developers
            </TabsTrigger>
            <TabsTrigger value="support" className="data-[state=active]:bg-white/20 text-white">
              <LifeBuoy className="h-4 w-4 mr-1" /> Support
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard">
            <DevDashboard />
          </TabsContent>

          {/* Tenants Tab */}
          <TabsContent value="tenants" className="space-y-6">
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
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company" className="bg-white/10 border-white/20 text-white placeholder:text-slate-500" />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300">Slug</Label>
                  <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={suggestedSlug || "slug"} className="bg-white/10 border-white/20 text-white placeholder:text-slate-500" />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300">Primary Domain (optional)</Label>
                  <Input value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="planning.company.be" className="bg-white/10 border-white/20 text-white placeholder:text-slate-500" />
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

            {/* Tenant List or Detail */}
            {selectedTenantId && selectedTenant ? (
              <DevTenantDetail
                tenant={selectedTenant}
                onBack={() => setSelectedTenantId(null)}
                onSetupWizard={(t) => setOnboardingTenant({ id: t.id, name: t.name, slug: t.slug })}
              />
            ) : (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                  <Building2 className="h-5 w-5" /> All Tenants
                </h2>
                {tenantsLoading ? (
                  <p className="text-slate-400">Loading...</p>
                ) : !tenants?.length ? (
                  <p className="text-slate-400">No tenants yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {tenants.map((t) => (
                      <Card
                        key={t.id}
                        className="bg-white/5 border-white/10 cursor-pointer hover:bg-white/10 transition"
                        onClick={() => setSelectedTenantId(t.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-white">{t.name}</span>
                            <Badge variant={t.is_active ? "default" : "secondary"} className={t.is_active ? "bg-emerald-600/80" : "bg-red-600/80"}>
                              {t.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-400">
                            <code className="text-blue-300">{t.slug}</code>
                            {t.custom_domain && <> · <code className="text-purple-300">{t.custom_domain}</code></>}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Developers Tab */}
          <TabsContent value="developers">
            <DevDeveloperManagement />
          </TabsContent>

          {/* Support Tab */}
          <TabsContent value="support">
            <DevSupportManagement />
          </TabsContent>
        </Tabs>
      </div>

      {onboardingTenant && (
        <TenantOnboardingWizard
          tenantId={onboardingTenant.id}
          tenantName={onboardingTenant.name}
          tenantSlug={onboardingTenant.slug}
          onComplete={() => { setOnboardingTenant(null); qc.invalidateQueries({ queryKey: ["dev"] }); }}
          onCancel={() => setOnboardingTenant(null)}
        />
      )}
    </main>
  );
};

export default DeveloperPortal;
