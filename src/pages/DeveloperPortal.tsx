import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  is_active: boolean;
  created_at: string;
};

async function fetchTenants(): Promise<TenantRow[]> {
  const { data, error } = await supabase
    .from("tenants")
    .select("id,name,slug,custom_domain,is_active,created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as TenantRow[];
}

const DeveloperPortal: React.FC = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: tenants, isLoading, error } = useQuery({
    queryKey: ["dev", "tenants"],
    queryFn: fetchTenants,
    staleTime: 1000 * 60 * 10,
  });

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [saving, setSaving] = useState(false);

  const suggestedSlug = useMemo(() => {
    const s = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    return s;
  }, [name]);

  const handleCreateTenant = async () => {
    if (!name.trim()) {
      toast({
        title: "Missing name",
        description: "Please enter a tenant name",
        variant: "destructive",
      });
      return;
    }

    const finalSlug = (slug || suggestedSlug).trim();
    if (!finalSlug) {
      toast({
        title: "Missing slug",
        description: "Please enter a tenant slug",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase.from("tenants").insert({
        name: name.trim(),
        slug: finalSlug,
        custom_domain: customDomain.trim() ? customDomain.trim() : null,
        is_active: true,
      });

      if (error) throw error;

      setName("");
      setSlug("");
      setCustomDomain("");

      await qc.invalidateQueries({ queryKey: ["dev", "tenants"] });

      toast({
        title: "Tenant created",
        description: `Created ${finalSlug}`,
      });
    } catch (e: any) {
      toast({
        title: "Create failed",
        description: e?.message ?? "Failed to create tenant",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">Developer Portal</h1>
          <p className="text-sm text-muted-foreground">
            Manage tenants (multi-company setup)
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Create tenant</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="tenant-name">Name</Label>
              <Input
                id="tenant-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Thonon"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-slug">Slug</Label>
              <Input
                id="tenant-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={suggestedSlug || "thonon"}
              />
              <p className="text-xs text-muted-foreground">
                Used for subdomain: <code>{(slug || suggestedSlug || "tenant") + "."}automattion-compass.com</code>
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-domain">Custom domain (optional)</Label>
              <Input
                id="tenant-domain"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="planning.thonon.be"
              />
            </div>
            <div className="md:col-span-3">
              <Button onClick={handleCreateTenant} disabled={saving}>
                {saving ? "Creating..." : "Create tenant"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : error ? (
              <p className="text-sm text-destructive">
                {(error as any)?.message ?? "Failed to load"}
              </p>
            ) : tenants && tenants.length ? (
              <div className="space-y-3">
                {tenants.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <div className="font-medium">
                        {t.name} <span className="text-muted-foreground">({t.slug})</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t.custom_domain ? `Domain: ${t.custom_domain}` : "Subdomain only"} · {t.is_active ? "Active" : "Inactive"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No tenants yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default DeveloperPortal;
