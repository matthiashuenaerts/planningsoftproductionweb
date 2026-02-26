import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield, UserPlus, Trash2 } from "lucide-react";

const DevDeveloperManagement: React.FC = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // Fetch all developers (employees with developer role in user_roles)
  const { data: developers, isLoading } = useQuery({
    queryKey: ["dev", "developers"],
    queryFn: async () => {
      const { data: devRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "developer" as any);
      if (rolesError) throw rolesError;

      const devIds = (devRoles ?? []).map((r: any) => r.user_id);
      if (!devIds.length) return [];

      const { data: devEmployees, error: empError } = await supabase
        .from("employees")
        .select("id,name,email,role,auth_user_id,tenant_id")
        .in("id", devIds)
        .order("name");
      if (empError) throw empError;

      return devEmployees ?? [];
    },
  });

  const handleCreateDeveloper = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast({ title: "Missing fields", description: "All fields are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Create developer in the first available tenant (they can access all)
      // We use a special approach - create in first tenant but mark as developer
      const { data: tenants } = await supabase.from("tenants").select("id").limit(1).single();
      if (!tenants) throw new Error("No tenants available");

      const { data, error } = await supabase.functions.invoke('create-employee', {
        body: {
          name: name.trim(),
          email: email.trim(),
          password: password.trim(),
          role: 'admin', // Base role for access
          tenantId: tenants.id,
        }
      });
      if (error) throw error;

      const employeeId = data?.employee?.id;
      if (employeeId) {
        // Add developer role
        await supabase.from('user_roles').insert({
          user_id: employeeId,
          role: 'developer' as any,
        } as any);
      }

      setName(""); setEmail(""); setPassword("");
      qc.invalidateQueries({ queryKey: ["dev", "developers"] });
      toast({ title: "Developer created", description: `${name} can now access all tenant accounts` });
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Add Developer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-400 mb-3">
            Developers can access all tenant accounts. They authenticate via the developer portal with email OTP verification.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-slate-300">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Developer name" className="bg-white/10 border-white/20 text-white placeholder:text-slate-500" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dev@company.com" type="email" className="bg-white/10 border-white/20 text-white placeholder:text-slate-500" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300">Password</Label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Secure password" type="password" className="bg-white/10 border-white/20 text-white placeholder:text-slate-500" />
            </div>
            <div className="flex items-end">
              <Button onClick={handleCreateDeveloper} disabled={saving} className="bg-blue-600 hover:bg-blue-700 w-full">
                {saving ? "Creating..." : "Create Developer"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="h-5 w-5" /> Active Developers ({developers?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-slate-400">Loading...</p>
          ) : !developers?.length ? (
            <p className="text-slate-400 text-sm">No developers configured</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {developers.map((dev: any) => (
                <div key={dev.id} className="flex items-center justify-between bg-white/5 rounded-md px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">{dev.name}</p>
                    <p className="text-xs text-slate-400">{dev.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-600/60 text-xs">developer</Badge>
                    <Badge variant="outline" className={dev.auth_user_id ? "border-emerald-500 text-emerald-400" : "border-amber-500 text-amber-400"}>
                      {dev.auth_user_id ? "Active" : "Pending"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DevDeveloperManagement;
