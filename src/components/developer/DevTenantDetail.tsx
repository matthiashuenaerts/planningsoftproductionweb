import React, { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Users, Globe, Plus, Trash2, ExternalLink, Rocket,
  UserPlus, FileText, Upload, Building2,
} from "lucide-react";
import { format } from "date-fns";

type TenantRow = {
  id: string; name: string; slug: string; custom_domain: string | null;
  logo_url: string | null; is_active: boolean; created_at: string;
};

interface DevTenantDetailProps {
  tenant: TenantRow;
  onBack: () => void;
  onSetupWizard: (t: TenantRow) => void;
}

const DevTenantDetail: React.FC<DevTenantDetailProps> = ({ tenant, onBack, onSetupWizard }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editName, setEditName] = useState(tenant.name);
  const [aliasInput, setAliasInput] = useState("");
  const [addUserForm, setAddUserForm] = useState({ email: '', name: '', password: '', role: 'worker' });
  const [addingUser, setAddingUser] = useState(false);

  // Fetch tenant employees
  const { data: employees } = useQuery({
    queryKey: ["dev", "employees", tenant.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id,name,role,email,auth_user_id,tenant_id").eq("tenant_id", tenant.id).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch user roles for these employees
  const { data: userRoles } = useQuery({
    queryKey: ["dev", "userRoles", tenant.id],
    queryFn: async () => {
      const empIds = (employees ?? []).map(e => e.id);
      if (!empIds.length) return [];
      const { data, error } = await supabase.from("user_roles").select("id,user_id,role").in("user_id", empIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!employees?.length,
  });

  const { data: aliases } = useQuery({
    queryKey: ["dev", "aliases", tenant.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenant_aliases").select("id,tenant_id,domain,is_primary").eq("tenant_id", tenant.id).order("domain");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: invoices } = useQuery({
    queryKey: ["dev", "invoices", tenant.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("*").eq("tenant_id", tenant.id).order("year", { ascending: false }).order("month", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: supportTickets } = useQuery({
    queryKey: ["dev", "support", tenant.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("support_tickets").select("*, creator:employees!support_tickets_created_by_fkey(name)").eq("tenant_id", tenant.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tenants").update({ is_active: !tenant.is_active }).eq("id", tenant.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dev"] }); },
  });

  const updateName = useMutation({
    mutationFn: async () => {
      if (editName.trim() === tenant.name) return;
      const { error } = await supabase.from("tenants").update({ name: editName.trim() }).eq("id", tenant.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dev"] }); toast({ title: "Name updated" }); },
  });

  const addAlias = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tenant_aliases").insert({ tenant_id: tenant.id, domain: aliasInput.trim().toLowerCase() });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dev", "aliases"] }); setAliasInput(""); toast({ title: "Alias added" }); },
  });

  const removeAlias = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tenant_aliases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dev", "aliases"] }); },
  });

  const handleAddUser = async () => {
    if (!addUserForm.email || !addUserForm.name || !addUserForm.password) return;
    setAddingUser(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-employee', {
        body: { name: addUserForm.name, email: addUserForm.email, password: addUserForm.password, role: addUserForm.role, tenantId: tenant.id }
      });
      if (error) throw error;
      const employeeId = data?.employee?.id;
      if (employeeId && ['admin', 'developer'].includes(addUserForm.role)) {
        await supabase.from('user_roles').insert({ user_id: employeeId, role: addUserForm.role as any } as any);
      }
      setAddUserForm({ email: '', name: '', password: '', role: 'worker' });
      qc.invalidateQueries({ queryKey: ["dev"] });
      toast({ title: "User created" });
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    } finally {
      setAddingUser(false);
    }
  };

  // Invoice management
  const [invoiceMonth, setInvoiceMonth] = useState(new Date().getMonth() + 1);
  const [invoiceYear, setInvoiceYear] = useState(new Date().getFullYear());
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDeadline, setInvoiceDeadline] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("sent");
  const [uploadingInvoice, setUploadingInvoice] = useState(false);

  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingInvoice(true);
    try {
      const filePath = `${tenant.id}/${invoiceYear}-${String(invoiceMonth).padStart(2, '0')}.pdf`;
      const { error: uploadError } = await supabase.storage.from('invoices').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('invoices').upsert({
        tenant_id: tenant.id, month: invoiceMonth, year: invoiceYear,
        pdf_path: filePath, status: invoiceStatus,
        amount: invoiceAmount ? parseFloat(invoiceAmount) : null,
        payment_deadline: invoiceDeadline || null,
      } as any, { onConflict: 'tenant_id,month,year' });
      if (insertError) throw insertError;

      qc.invalidateQueries({ queryKey: ["dev", "invoices"] });
      toast({ title: "Invoice uploaded" });
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
    } finally {
      setUploadingInvoice(false);
    }
  };

  const updateInvoiceStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('invoices').update({ status } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dev", "invoices"] }); },
  });

  const getRolesForEmployee = (empId: string) => (userRoles ?? []).filter(r => r.user_id === empId).map(r => r.role);

  const statusColors: Record<string, string> = {
    open: 'bg-blue-500/20 text-blue-300',
    in_progress: 'bg-yellow-500/20 text-yellow-300',
    resolved: 'bg-green-500/20 text-green-300',
    closed: 'bg-slate-500/20 text-slate-300',
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" className="text-slate-300 hover:text-white" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Tenants
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{tenant.name}</h2>
          <p className="text-sm text-slate-400">Slug: <code className="text-blue-300">{tenant.slug}</code></p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="text-blue-400" onClick={() => onSetupWizard(tenant)}>
            <Rocket className="h-4 w-4 mr-1" /> Setup
          </Button>
          <Button variant="ghost" size="sm" className="text-slate-400" onClick={() => toggleActive.mutate()}>
            {tenant.is_active ? "Deactivate" : "Activate"}
          </Button>
          <a href={`/${tenant.slug}/login`} className="text-slate-400 hover:text-blue-400 flex items-center">
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-white/10 border border-white/10">
          <TabsTrigger value="overview" className="data-[state=active]:bg-white/20 text-white">Overview</TabsTrigger>
          <TabsTrigger value="billing" className="data-[state=active]:bg-white/20 text-white">Billing</TabsTrigger>
          <TabsTrigger value="support" className="data-[state=active]:bg-white/20 text-white">Support</TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-white/20 text-white">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Employees */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" /> Employees ({employees?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                {(employees ?? []).map((emp) => {
                  const empRoles = getRolesForEmployee(emp.id);
                  return (
                    <div key={emp.id} className="flex items-center justify-between bg-white/5 rounded-md px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-white">{emp.name}</p>
                        <p className="text-xs text-slate-400">{emp.role} {emp.email ? `· ${emp.email}` : ""}</p>
                        {empRoles.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {empRoles.map((r) => <Badge key={r} className="text-[10px] bg-blue-600/60 px-1.5 py-0">{r}</Badge>)}
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

              {/* Add User Form */}
              <div className="p-3 bg-white/5 rounded-md space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                  <UserPlus className="h-3 w-3" /> Add New User
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <Input value={addUserForm.name} onChange={(e) => setAddUserForm(p => ({ ...p, name: e.target.value }))} placeholder="Name" className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 text-xs h-8" />
                  <Input value={addUserForm.email} onChange={(e) => setAddUserForm(p => ({ ...p, email: e.target.value }))} placeholder="Email" type="email" className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 text-xs h-8" />
                  <Input value={addUserForm.password} onChange={(e) => setAddUserForm(p => ({ ...p, password: e.target.value }))} placeholder="Password" type="password" className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 text-xs h-8" />
                  <Select value={addUserForm.role} onValueChange={(v) => setAddUserForm(p => ({ ...p, role: v }))}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white text-xs h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['admin', 'manager', 'teamleader', 'worker', 'preparater', 'workstation', 'installation_team', 'advisor', 'calculator'].map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs" disabled={addingUser} onClick={handleAddUser}>
                    {addingUser ? "Adding..." : "Add User"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-sm">
                <Upload className="h-4 w-4" /> Upload Invoice
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
                <div>
                  <Label className="text-slate-300 text-xs">Month</Label>
                  <Select value={String(invoiceMonth)} onValueChange={(v) => setInvoiceMonth(Number(v))}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white text-xs h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Year</Label>
                  <Input type="number" value={invoiceYear} onChange={(e) => setInvoiceYear(Number(e.target.value))} className="bg-white/10 border-white/20 text-white text-xs h-8" />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Amount (€)</Label>
                  <Input value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} placeholder="0.00" className="bg-white/10 border-white/20 text-white text-xs h-8" />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Deadline</Label>
                  <Input type="date" value={invoiceDeadline} onChange={(e) => setInvoiceDeadline(e.target.value)} className="bg-white/10 border-white/20 text-white text-xs h-8" />
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">Status</Label>
                  <Select value={invoiceStatus} onValueChange={setInvoiceStatus}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white text-xs h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['draft', 'sent', 'paid', 'overdue', 'cancelled'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-300 text-xs">PDF</Label>
                  <Input type="file" accept=".pdf" onChange={handleInvoiceUpload} disabled={uploadingInvoice} className="bg-white/10 border-white/20 text-white text-xs h-8" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice History */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" /> Billing History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!invoices?.length ? (
                <p className="text-slate-400 text-sm">No invoices yet</p>
              ) : (
                <div className="space-y-2">
                  {invoices.map((inv: any) => (
                    <div key={inv.id} className="flex items-center justify-between bg-white/5 rounded-md px-3 py-2">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-sm text-white">{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][inv.month - 1]} {inv.year}</p>
                          {inv.amount && <p className="text-xs text-slate-400">€{Number(inv.amount).toFixed(2)}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {inv.payment_deadline && <span className="text-xs text-slate-400">Due: {format(new Date(inv.payment_deadline), 'dd/MM/yyyy')}</span>}
                        <Select value={inv.status} onValueChange={(v) => updateInvoiceStatus.mutate({ id: inv.id, status: v })}>
                          <SelectTrigger className="bg-white/10 border-white/20 text-white text-xs h-7 w-24"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['draft', 'sent', 'paid', 'overdue', 'cancelled'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Support Tab */}
        <TabsContent value="support" className="space-y-4">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-sm">Support Tickets ({supportTickets?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {!supportTickets?.length ? (
                <p className="text-slate-400 text-sm">No support tickets</p>
              ) : (
                <div className="space-y-2">
                  {supportTickets.map((ticket: any) => (
                    <div key={ticket.id} className="bg-white/5 rounded-md px-3 py-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-white">{ticket.subject}</p>
                          <p className="text-xs text-slate-400">by {ticket.creator?.name} · {format(new Date(ticket.created_at), 'dd/MM/yyyy')}</p>
                        </div>
                        <Badge className={statusColors[ticket.status] || ''}>{ticket.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          {/* Name Edit */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader><CardTitle className="text-white text-sm"><Building2 className="h-4 w-4 inline mr-2" />Display Name</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-white/10 border-white/20 text-white max-w-sm" />
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700" disabled={editName === tenant.name} onClick={() => updateName.mutate()}>Save</Button>
              </div>
            </CardContent>
          </Card>

          {/* Aliases */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader><CardTitle className="text-white text-sm"><Globe className="h-4 w-4 inline mr-2" />Alias URLs</CardTitle></CardHeader>
            <CardContent>
              {(aliases ?? []).length > 0 && (
                <div className="space-y-1 mb-3">
                  {aliases!.map((alias: any) => (
                    <div key={alias.id} className="flex items-center justify-between bg-white/5 rounded-md px-3 py-2">
                      <code className="text-sm text-blue-300">{alias.domain}</code>
                      <Button variant="ghost" size="sm" className="text-red-400 h-7 w-7 p-0" onClick={() => removeAlias.mutate(alias.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input value={aliasInput} onChange={(e) => setAliasInput(e.target.value)} placeholder="e.g. planning.company.be" className="bg-white/10 border-white/20 text-white flex-1" />
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700" disabled={!aliasInput.trim()} onClick={() => addAlias.mutate()}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Access URLs */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader><CardTitle className="text-white text-sm">Access URLs</CardTitle></CardHeader>
            <CardContent className="text-xs text-slate-400 space-y-1">
              <p>Path: <code className="text-blue-300">automattion-compass.com/{tenant.slug}/</code></p>
              <p>Login: <a href={`/${tenant.slug}/login`} className="text-blue-300 hover:underline">/{tenant.slug}/login</a></p>
              {tenant.custom_domain && <p>Custom domain: <code className="text-purple-300">https://{tenant.custom_domain}</code></p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DevTenantDetail;
