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
  FileText, LifeBuoy, Activity, Upload, HelpCircle, Megaphone,
} from "lucide-react";
import TenantOnboardingWizard from "@/components/developer/TenantOnboardingWizard";
import DevTenantDetail from "@/components/developer/DevTenantDetail";
import DevDeveloperManagement from "@/components/developer/DevDeveloperManagement";
import DevDashboard from "@/components/developer/DevDashboard";
import DevSupportManagement from "@/components/developer/DevSupportManagement";
import DevHelpManagement from "@/components/developer/DevHelpManagement";
import DevGeneralMessages from "@/components/developer/DevGeneralMessages";

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
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400 flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold tracking-tight truncate">Developer Portal</h1>
              <p className="text-[10px] sm:text-xs text-slate-400 truncate">Logged in as {currentEmployee?.name ?? "Developer"}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white flex-shrink-0 h-8 px-2 sm:px-3" onClick={logout}>
            <LogOut className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <Tabs defaultValue="dashboard" className="space-y-4 sm:space-y-6">
          {/* Horizontally scrollable tabs on mobile */}
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-none">
            <TabsList className="bg-white/10 border border-white/10 inline-flex w-auto min-w-full sm:min-w-0">
              <TabsTrigger value="dashboard" className="data-[state=active]:bg-white/20 text-white text-xs sm:text-sm px-2.5 sm:px-3">
                <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" /> <span className="whitespace-nowrap">Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="tenants" className="data-[state=active]:bg-white/20 text-white text-xs sm:text-sm px-2.5 sm:px-3">
                <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" /> <span className="whitespace-nowrap">Tenants</span>
              </TabsTrigger>
              <TabsTrigger value="developers" className="data-[state=active]:bg-white/20 text-white text-xs sm:text-sm px-2.5 sm:px-3">
                <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" /> <span className="whitespace-nowrap">Developers</span>
              </TabsTrigger>
              <TabsTrigger value="support" className="data-[state=active]:bg-white/20 text-white text-xs sm:text-sm px-2.5 sm:px-3">
                <LifeBuoy className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" /> <span className="whitespace-nowrap">Support</span>
              </TabsTrigger>
              <TabsTrigger value="help" className="data-[state=active]:bg-white/20 text-white text-xs sm:text-sm px-2.5 sm:px-3">
                <HelpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" /> <span className="whitespace-nowrap">Help</span>
              </TabsTrigger>
              <TabsTrigger value="messages" className="data-[state=active]:bg-white/20 text-white text-xs sm:text-sm px-2.5 sm:px-3">
                <Megaphone className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" /> <span className="whitespace-nowrap">Messages</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard">
            <DevDashboard />
          </TabsContent>

          {/* Tenants Tab */}
          <TabsContent value="tenants" className="space-y-4 sm:space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <Card className="bg-white/5 border-white/10 text-white">
                <CardContent className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5">
                  <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-400 flex-shrink-0" />
                  <div>
                    <p className="text-xl sm:text-2xl font-bold">{tenants?.length ?? 0}</p>
                    <p className="text-xs sm:text-sm text-slate-400">Tenants</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Create Tenant */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="px-3 sm:px-6 py-3 sm:py-6">
                <CardTitle className="text-white flex items-center gap-2 text-sm sm:text-base">
                  <Plus className="h-4 w-4 sm:h-5 sm:w-5" /> Create New Tenant
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6 pt-0 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-5">
                <div className="space-y-1">
                  <Label className="text-slate-300 text-xs sm:text-sm">Company Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company" className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300 text-xs sm:text-sm">Slug</Label>
                  <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={suggestedSlug || "slug"} className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300 text-xs sm:text-sm">Primary Domain (optional)</Label>
                  <Input value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="planning.company.be" className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-300 text-xs sm:text-sm">Logo URL (optional)</Label>
                  <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 h-9" />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleCreateTenant} disabled={saving} className="bg-blue-600 hover:bg-blue-700 w-full h-9 text-sm">
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

          {/* Help Tab */}
          <TabsContent value="help">
            <DevHelpManagement />
          </TabsContent>
          {/* Messages Tab */}
          <TabsContent value="messages">
            <DevGeneralMessages />
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
