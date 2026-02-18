import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Users, Wrench, ClipboardList, Truck, CheckCircle2,
  ArrowRight, ArrowLeft, Plus, Trash2, Factory, Route, Package,
} from "lucide-react";

interface TenantOnboardingWizardProps {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  onComplete: () => void;
  onCancel: () => void;
}

type Step = "welcome" | "workstations" | "employees" | "routing" | "tasks" | "suppliers" | "teams" | "complete";

const STEPS: { key: Step; label: string; icon: React.ReactNode; description: string }[] = [
  { key: "welcome", label: "Welcome", icon: <Building2 className="h-5 w-5" />, description: "Introduction to the system" },
  { key: "workstations", label: "Workstations", icon: <Factory className="h-5 w-5" />, description: "Define your production workstations" },
  { key: "employees", label: "Employees", icon: <Users className="h-5 w-5" />, description: "Add your team members" },
  { key: "routing", label: "Production Routing", icon: <Route className="h-5 w-5" />, description: "Set up the production flow" },
  { key: "tasks", label: "Standard Tasks", icon: <ClipboardList className="h-5 w-5" />, description: "Define recurring tasks" },
  { key: "suppliers", label: "Suppliers", icon: <Package className="h-5 w-5" />, description: "Add your suppliers" },
  { key: "teams", label: "Installation Teams", icon: <Truck className="h-5 w-5" />, description: "Configure installation teams" },
  { key: "complete", label: "Complete", icon: <CheckCircle2 className="h-5 w-5" />, description: "You're all set!" },
];

const TenantOnboardingWizard: React.FC<TenantOnboardingWizardProps> = ({
  tenantId, tenantName, tenantSlug, onComplete, onCancel,
}) => {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  const [saving, setSaving] = useState(false);

  // Workstations
  const [workstations, setWorkstations] = useState<{ name: string; description: string }[]>([
    { name: "", description: "" },
  ]);

  // Employees
  const [employees, setEmployees] = useState<{ name: string; role: string; email: string; password: string }[]>([
    { name: "", role: "worker", email: "", password: "" },
  ]);

  // Standard tasks
  const [tasks, setTasks] = useState<{ task_name: string; task_number: string }[]>([
    { task_name: "", task_number: "1" },
  ]);

  // Suppliers
  const [suppliers, setSuppliers] = useState<{ name: string; email: string }[]>([
    { name: "", email: "" },
  ]);

  // Teams
  const [teams, setTeams] = useState<{ name: string }[]>([{ name: "" }]);

  const stepIndex = STEPS.findIndex((s) => s.key === currentStep);

  const goNext = () => {
    const next = STEPS[stepIndex + 1];
    if (next) setCurrentStep(next.key);
  };

  const goBack = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) setCurrentStep(prev.key);
  };

  const saveWorkstations = async () => {
    const valid = workstations.filter((w) => w.name.trim());
    if (!valid.length) { goNext(); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("workstations").insert(
        valid.map((w) => ({ name: w.name.trim(), description: w.description.trim() || null, tenant_id: tenantId }))
      );
      if (error) throw error;
      toast({ title: `${valid.length} workstation(s) created` });
      goNext();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveEmployees = async () => {
    const valid = employees.filter((e) => e.name.trim());
    if (!valid.length) { goNext(); return; }
    setSaving(true);
    try {
      for (const emp of valid) {
        const res = await supabase.functions.invoke("create-employee", {
          body: {
            name: emp.name.trim(),
            role: emp.role,
            email: emp.email.trim() || null,
            password: emp.password.trim() || emp.name.trim().toLowerCase(),
            tenant_id: tenantId,
          },
        });
        if (res.error) throw new Error(res.error.message || "Failed to create employee");
      }
      toast({ title: `${valid.length} employee(s) created` });
      goNext();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveTasks = async () => {
    const valid = tasks.filter((t) => t.task_name.trim());
    if (!valid.length) { goNext(); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("standard_tasks").insert(
        valid.map((t, i) => ({ task_name: t.task_name.trim(), task_number: t.task_number.trim() || String(i + 1), tenant_id: tenantId }))
      );
      if (error) throw error;
      toast({ title: `${valid.length} task(s) created` });
      goNext();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveSuppliers = async () => {
    const valid = suppliers.filter((s) => s.name.trim());
    if (!valid.length) { goNext(); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("suppliers").insert(
        valid.map((s) => ({ name: s.name.trim(), email: s.email.trim() || null, tenant_id: tenantId }))
      );
      if (error) throw error;
      toast({ title: `${valid.length} supplier(s) created` });
      goNext();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveTeams = async () => {
    const valid = teams.filter((t) => t.name.trim());
    if (!valid.length) { goNext(); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("placement_teams").insert(
        valid.map((t) => ({ name: t.name.trim(), tenant_id: tenantId }))
      );
      if (error) throw error;
      toast({ title: `${valid.length} team(s) created` });
      goNext();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addItem = <T,>(list: T[], setList: (l: T[]) => void, template: T) => {
    setList([...list, template]);
  };

  const removeItem = <T,>(list: T[], setList: (l: T[]) => void, idx: number) => {
    setList(list.filter((_, i) => i !== idx));
  };

  const updateItem = <T,>(list: T[], setList: (l: T[]) => void, idx: number, field: keyof T, value: any) => {
    const copy = [...list];
    (copy[idx] as any)[field] = value;
    setList(copy);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "welcome":
        return (
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 text-blue-400">
                <Building2 className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold text-white">Welcome to AutoMattiOn Compass</h2>
              <p className="text-slate-300 max-w-lg mx-auto">
                Let's set up <span className="text-blue-400 font-semibold">{tenantName}</span> step by step.
                This wizard will guide you through configuring the essential settings for your production planning system.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {[
                { icon: <Factory className="h-5 w-5" />, title: "Workstations", desc: "Define where your products are processed" },
                { icon: <Users className="h-5 w-5" />, title: "Employees", desc: "Add your team members and assign roles" },
                { icon: <Route className="h-5 w-5" />, title: "Production Routing", desc: "Set up the flow through workstations" },
                { icon: <ClipboardList className="h-5 w-5" />, title: "Standard Tasks", desc: "Define recurring production tasks" },
                { icon: <Package className="h-5 w-5" />, title: "Suppliers", desc: "Manage your material suppliers" },
                { icon: <Truck className="h-5 w-5" />, title: "Installation Teams", desc: "Configure on-site installation teams" },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 bg-white/5 rounded-lg p-4">
                  <div className="text-blue-400 mt-0.5">{item.icon}</div>
                  <div>
                    <p className="font-medium text-white text-sm">{item.title}</p>
                    <p className="text-xs text-slate-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-slate-400">
              You can skip any step and configure it later in Settings.
            </p>
          </div>
        );

      case "workstations":
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Workstations represent the physical stations in your factory where products are processed.
              Each project task is assigned to a workstation.
            </p>
            {workstations.map((ws, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="Workstation name (e.g. CNC, Edgebander, Assembly)"
                    value={ws.name}
                    onChange={(e) => updateItem(workstations, setWorkstations, i, "name", e.target.value)}
                    className="bg-white/10 border-white/20 text-white placeholder:text-slate-500"
                  />
                </div>
                {workstations.length > 1 && (
                  <Button variant="ghost" size="icon" className="text-red-400 mt-1" onClick={() => removeItem(workstations, setWorkstations, i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" className="border-white/20 text-slate-300" onClick={() => addItem(workstations, setWorkstations, { name: "", description: "" })}>
              <Plus className="h-4 w-4 mr-1" /> Add Workstation
            </Button>
          </div>
        );

      case "employees":
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Add employees who will use the system. Each employee gets a login with their name and password.
              Roles determine what they can access: <Badge className="bg-blue-600/60 text-xs">admin</Badge>{" "}
              <Badge className="bg-emerald-600/60 text-xs">manager</Badge>{" "}
              <Badge className="bg-slate-600/60 text-xs">worker</Badge>{" "}
              <Badge className="bg-amber-600/60 text-xs">teamleader</Badge>
            </p>
            {employees.map((emp, i) => (
              <div key={i} className="grid grid-cols-[1fr_120px_1fr_1fr_auto] gap-2 items-start">
                <Input placeholder="Name" value={emp.name} onChange={(e) => updateItem(employees, setEmployees, i, "name", e.target.value)} className="bg-white/10 border-white/20 text-white placeholder:text-slate-500" />
                <select
                  value={emp.role}
                  onChange={(e) => updateItem(employees, setEmployees, i, "role", e.target.value)}
                  className="h-10 rounded-md border border-white/20 bg-white/10 text-white px-2 text-sm"
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="worker">Worker</option>
                  <option value="teamleader">Teamleader</option>
                  <option value="preparater">Preparater</option>
                  <option value="workstation">Workstation</option>
                </select>
                <Input placeholder="Email" value={emp.email} onChange={(e) => updateItem(employees, setEmployees, i, "email", e.target.value)} className="bg-white/10 border-white/20 text-white placeholder:text-slate-500" />
                <Input placeholder="Password" type="text" value={emp.password} onChange={(e) => updateItem(employees, setEmployees, i, "password", e.target.value)} className="bg-white/10 border-white/20 text-white placeholder:text-slate-500" />
                {employees.length > 1 && (
                  <Button variant="ghost" size="icon" className="text-red-400" onClick={() => removeItem(employees, setEmployees, i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" className="border-white/20 text-slate-300" onClick={() => addItem(employees, setEmployees, { name: "", role: "worker", email: "", password: "" })}>
              <Plus className="h-4 w-4 mr-1" /> Add Employee
            </Button>
          </div>
        );

      case "routing":
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Production routing defines the order in which products pass through your workstations.
              This is configured per-workstation in the Settings page after setup.
            </p>
            <div className="bg-white/5 rounded-lg p-6 text-center space-y-3">
              <Route className="h-10 w-10 text-blue-400 mx-auto" />
              <p className="text-white font-medium">Production Routing</p>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                After creating workstations, you can define the production flow in{" "}
                <span className="text-blue-400">Settings → Production Routing</span>.
                This determines the sequence tasks follow through your factory.
              </p>
              <p className="text-xs text-slate-500">
                You can skip this step and configure routing later.
              </p>
            </div>
          </div>
        );

      case "tasks":
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Standard tasks are templates used when creating project phases.
              Define the common tasks that occur in your production process.
            </p>
            {tasks.map((task, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="w-20">
                  <Input
                    placeholder="#"
                    value={task.task_number}
                    onChange={(e) => updateItem(tasks, setTasks, i, "task_number", e.target.value)}
                    className="bg-white/10 border-white/20 text-white placeholder:text-slate-500"
                  />
                </div>
                <Input
                  placeholder="Task name (e.g. CNC Cutting, Edgebanding, Assembly)"
                  value={task.task_name}
                  onChange={(e) => updateItem(tasks, setTasks, i, "task_name", e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 flex-1"
                />
                {tasks.length > 1 && (
                  <Button variant="ghost" size="icon" className="text-red-400" onClick={() => removeItem(tasks, setTasks, i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" className="border-white/20 text-slate-300" onClick={() => addItem(tasks, setTasks, { task_name: "", task_number: String(tasks.length + 1) })}>
              <Plus className="h-4 w-4 mr-1" /> Add Task
            </Button>
          </div>
        );

      case "suppliers":
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Add your material and hardware suppliers. These will be available when creating orders and tracking deliveries.
            </p>
            {suppliers.map((sup, i) => (
              <div key={i} className="flex gap-2 items-start">
                <Input placeholder="Supplier name" value={sup.name} onChange={(e) => updateItem(suppliers, setSuppliers, i, "name", e.target.value)} className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 flex-1" />
                <Input placeholder="Contact email (optional)" value={sup.email} onChange={(e) => updateItem(suppliers, setSuppliers, i, "email", e.target.value)} className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 flex-1" />
                {suppliers.length > 1 && (
                  <Button variant="ghost" size="icon" className="text-red-400" onClick={() => removeItem(suppliers, setSuppliers, i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" className="border-white/20 text-slate-300" onClick={() => addItem(suppliers, setSuppliers, { name: "", email: "" })}>
              <Plus className="h-4 w-4 mr-1" /> Add Supplier
            </Button>
          </div>
        );

      case "teams":
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Installation teams handle on-site placement of finished products. Define your teams here and assign members later.
            </p>
            {teams.map((team, i) => (
              <div key={i} className="flex gap-2 items-start">
                <Input placeholder="Team name (e.g. Team A, Placement Brussels)" value={team.name} onChange={(e) => updateItem(teams, setTeams, i, "name", e.target.value)} className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 flex-1" />
                {teams.length > 1 && (
                  <Button variant="ghost" size="icon" className="text-red-400" onClick={() => removeItem(teams, setTeams, i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" className="border-white/20 text-slate-300" onClick={() => addItem(teams, setTeams, { name: "" })}>
              <Plus className="h-4 w-4 mr-1" /> Add Team
            </Button>
          </div>
        );

      case "complete":
        return (
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold text-white">Setup Complete!</h2>
            <p className="text-slate-300 max-w-md mx-auto">
              <span className="text-blue-400 font-semibold">{tenantName}</span> is ready to use.
              You can now access the application at{" "}
              <a href={`/${tenantSlug}/login`} className="text-blue-400 hover:underline">
                /{tenantSlug}/login
              </a>{" "}
              and fine-tune settings from within the app.
            </p>
            <div className="bg-white/5 rounded-lg p-4 max-w-md mx-auto text-left space-y-2">
              <p className="text-sm font-medium text-white">Key features available:</p>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>📋 <strong>Projects</strong> — Create and manage production projects</li>
                <li>📅 <strong>Planning</strong> — Gantt chart scheduling with drag & drop</li>
                <li>🏭 <strong>Workstation Control</strong> — Real-time production monitoring</li>
                <li>📦 <strong>Orders & Logistics</strong> — Track orders and deliveries</li>
                <li>⏱️ <strong>Time Registration</strong> — Employee time tracking</li>
                <li>🔧 <strong>Broken Parts</strong> — Report and track defects</li>
                <li>🚚 <strong>Installation Planning</strong> — Team scheduling & truck loading</li>
              </ul>
            </div>
          </div>
        );
    }
  };

  const handleStepAction = () => {
    switch (currentStep) {
      case "welcome": goNext(); break;
      case "workstations": saveWorkstations(); break;
      case "employees": saveEmployees(); break;
      case "routing": goNext(); break;
      case "tasks": saveTasks(); break;
      case "suppliers": saveSuppliers(); break;
      case "teams": saveTeams(); break;
      case "complete": onComplete(); break;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="bg-slate-900 border-white/10 w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Progress */}
        <div className="px-6 pt-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {STEPS.map((step, i) => (
              <React.Fragment key={step.key}>
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                  i < stepIndex ? "bg-emerald-500/20 text-emerald-400" :
                  i === stepIndex ? "bg-blue-500/20 text-blue-400" :
                  "bg-white/5 text-slate-500"
                }`}>
                  {i < stepIndex ? <CheckCircle2 className="h-3.5 w-3.5" /> : step.icon}
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`w-4 h-px ${i < stepIndex ? "bg-emerald-500/40" : "bg-white/10"}`} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              {STEPS[stepIndex].icon} {STEPS[stepIndex].label}
            </h3>
            <p className="text-sm text-slate-400">{STEPS[stepIndex].description}</p>
          </div>
          {renderStepContent()}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
          <div>
            {stepIndex > 0 && currentStep !== "complete" && (
              <Button variant="ghost" className="text-slate-300" onClick={goBack} disabled={saving}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {currentStep !== "complete" && currentStep !== "welcome" && (
              <Button variant="ghost" className="text-slate-400" onClick={goNext} disabled={saving}>
                Skip
              </Button>
            )}
            <Button
              onClick={handleStepAction}
              disabled={saving}
              className={currentStep === "complete" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"}
            >
              {saving ? "Saving..." :
                currentStep === "welcome" ? "Let's Start" :
                currentStep === "complete" ? "Close Wizard" :
                <>Save & Continue <ArrowRight className="h-4 w-4 ml-1" /></>
              }
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default TenantOnboardingWizard;
