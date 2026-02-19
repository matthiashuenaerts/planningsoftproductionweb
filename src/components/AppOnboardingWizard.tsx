import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Users, Factory, Route, ClipboardList, Package, Truck,
  CheckCircle2, ArrowRight, ArrowLeft, X, Rocket, BarChart3,
  Calendar, Settings, FileText, AlertTriangle, Zap, Eye,
} from "lucide-react";

type OnboardingMode = "settings" | "tour" | null;

interface AppOnboardingWizardProps {
  children: React.ReactNode;
}

// Tour steps for the app introduction
const TOUR_STEPS = [
  {
    key: "welcome",
    title: "Welcome to AutoMattiOn Compass!",
    icon: <Rocket className="h-10 w-10" />,
    description: "Your production planning system is ready. Let us show you around so you can get the most out of it.",
    details: [
      "Plan and monitor your entire production workflow",
      "Track tasks across workstations in real-time",
      "Manage projects, orders, and deliveries",
      "Coordinate installation teams and logistics",
    ],
  },
  {
    key: "dashboard",
    title: "Dashboard",
    icon: <BarChart3 className="h-10 w-10" />,
    description: "Your central overview of everything happening in production.",
    details: [
      "See active projects and their progress",
      "Monitor task completion rates",
      "View upcoming deadlines and installations",
      "Quick access to all key functions",
    ],
  },
  {
    key: "projects",
    title: "Projects & Planning",
    icon: <Calendar className="h-10 w-10" />,
    description: "Manage all your projects from start to installation.",
    details: [
      "Create projects with phases and tasks",
      "Set installation dates and deadlines",
      "Track progress through workstations",
      "Use the Gantt chart for visual planning",
    ],
  },
  {
    key: "workstations",
    title: "Workstations & Control Panel",
    icon: <Factory className="h-10 w-10" />,
    description: "Monitor your production floor in real-time.",
    details: [
      "See which machines are active",
      "Track who is working on what",
      "Monitor buffer times between stations",
      "Spot bottlenecks instantly",
    ],
  },
  {
    key: "orders",
    title: "Orders & Logistics",
    icon: <Package className="h-10 w-10" />,
    description: "Handle incoming orders and outgoing deliveries.",
    details: [
      "Create and track material orders",
      "Manage supplier relationships",
      "Track deliveries and backorders",
      "Prepare truck loading schedules",
    ],
  },
  {
    key: "time",
    title: "Time Registration",
    icon: <Eye className="h-10 w-10" />,
    description: "Track working hours and task durations.",
    details: [
      "Employees start/stop timers on tasks",
      "Automatic overtime detection",
      "View time reports per employee or project",
      "Compare estimated vs actual durations",
    ],
  },
  {
    key: "settings",
    title: "Settings",
    icon: <Settings className="h-10 w-10" />,
    description: "Configure your system to match your workflow.",
    details: [
      "Manage workstations and production lines",
      "Define standard tasks and routing",
      "Configure employees and teams",
      "Set up suppliers and email notifications",
    ],
  },
];

const AppOnboardingWizard: React.FC<AppOnboardingWizardProps> = ({ children }) => {
  const { currentEmployee } = useAuth();
  const { tenant } = useTenant();
  const { t } = useLanguage();
  const [mode, setMode] = useState<OnboardingMode>(null);
  const [loading, setLoading] = useState(true);
  const [tourStep, setTourStep] = useState(0);

  // Settings wizard state (reuse from TenantOnboardingWizard concept but inline)
  const [settingsStep, setSettingsStep] = useState(0);
  const [workstations, setWorkstations] = useState<{ name: string }[]>([{ name: "" }]);
  const [employees, setEmployees] = useState<{ name: string; role: string; password: string }[]>([{ name: "", role: "worker", password: "" }]);
  const [tasks, setTasks] = useState<{ task_name: string; task_number: string }[]>([{ task_name: "", task_number: "1" }]);
  const [saving, setSaving] = useState(false);

  const SETTINGS_STEPS = ["welcome", "workstations", "employees", "tasks", "done"];

  useEffect(() => {
    checkOnboardingStatus();
  }, [currentEmployee, tenant]);

  const checkOnboardingStatus = async () => {
    if (!currentEmployee || !tenant) {
      setLoading(false);
      return;
    }

    // Skip for workstation accounts
    if (currentEmployee.role === "workstation") {
      setLoading(false);
      return;
    }

    try {
      // Check if employee has completed onboarding
      const { data: emp } = await supabase
        .from("employees")
        .select("onboarding_completed")
        .eq("id", currentEmployee.id)
        .single();

      if (emp?.onboarding_completed) {
        setMode(null);
        setLoading(false);
        return;
      }

      // Check if essential settings exist
      const [wsResult, empResult, taskResult] = await Promise.all([
        supabase.from("workstations").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
        supabase.from("employees").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
        supabase.from("standard_tasks").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
      ]);

      const hasWorkstations = (wsResult.count || 0) > 0;
      const hasMultipleEmployees = (empResult.count || 0) > 1; // More than just the current user
      const hasTasks = (taskResult.count || 0) > 0;

      if (!hasWorkstations || !hasTasks) {
        // Settings not configured - show settings wizard (only for admin)
        if (currentEmployee.role === "admin") {
          setMode("settings");
        } else {
          // Non-admin, show tour only
          setMode("tour");
        }
      } else {
        // Settings exist, show intro tour
        setMode("tour");
      }
    } catch (error) {
      console.error("Error checking onboarding status:", error);
    }

    setLoading(false);
  };

  const markOnboardingComplete = async () => {
    if (!currentEmployee) return;
    await supabase
      .from("employees")
      .update({ onboarding_completed: true })
      .eq("id", currentEmployee.id);
    setMode(null);
  };

  const skipOnboarding = () => {
    markOnboardingComplete();
  };

  // Settings wizard save functions
  const saveWorkstations = async () => {
    const valid = workstations.filter(w => w.name.trim());
    if (!valid.length) { setSettingsStep(s => s + 1); return; }
    setSaving(true);
    try {
      await supabase.from("workstations").insert(
        valid.map(w => ({ name: w.name.trim(), tenant_id: tenant!.id }))
      );
      setSettingsStep(s => s + 1);
    } catch (e: any) {
      console.error("Error saving workstations:", e);
    }
    setSaving(false);
  };

  const saveEmployees = async () => {
    const valid = employees.filter(e => e.name.trim());
    if (!valid.length) { setSettingsStep(s => s + 1); return; }
    setSaving(true);
    try {
      for (const emp of valid) {
        await supabase.functions.invoke("create-employee", {
          body: {
            name: emp.name.trim(),
            role: emp.role,
            password: emp.password.trim() || emp.name.trim().toLowerCase(),
            tenant_id: tenant!.id,
          },
        });
      }
      setSettingsStep(s => s + 1);
    } catch (e: any) {
      console.error("Error saving employees:", e);
    }
    setSaving(false);
  };

  const saveTasks = async () => {
    const valid = tasks.filter(t => t.task_name.trim());
    if (!valid.length) { setSettingsStep(s => s + 1); return; }
    setSaving(true);
    try {
      await supabase.from("standard_tasks").insert(
        valid.map((t, i) => ({ task_name: t.task_name.trim(), task_number: t.task_number.trim() || String(i + 1), tenant_id: tenant!.id }))
      );
      setSettingsStep(s => s + 1);
    } catch (e: any) {
      console.error("Error saving tasks:", e);
    }
    setSaving(false);
  };

  if (loading || !mode) {
    return <>{children}</>;
  }

  // Settings wizard for admins when no settings exist
  if (mode === "settings") {
    const step = SETTINGS_STEPS[settingsStep];

    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-6">
            {SETTINGS_STEPS.map((s, i) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= settingsStep ? "bg-blue-500" : "bg-slate-700"}`} />
            ))}
          </div>

          <Card className="bg-white/5 border-white/10 p-8">
            {step === "welcome" && (
              <div className="text-center space-y-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 text-blue-400">
                  <Rocket className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-bold text-white">Let's set up your workspace</h2>
                <p className="text-slate-300 max-w-lg mx-auto">
                  We'll guide you through the essential settings to get your production planning system ready.
                  This only takes a few minutes.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" className="text-slate-300 border-slate-600" onClick={skipOnboarding}>
                    Skip for now
                  </Button>
                  <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setSettingsStep(1)}>
                    Let's go <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === "workstations" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <Factory className="h-6 w-6 text-blue-400" />
                  <h2 className="text-xl font-bold text-white">Workstations</h2>
                </div>
                <p className="text-sm text-slate-300">Define the stations in your factory (e.g. CNC, Edgebander, Assembly).</p>
                {workstations.map((ws, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      placeholder="Workstation name"
                      value={ws.name}
                      onChange={e => { const c = [...workstations]; c[i].name = e.target.value; setWorkstations(c); }}
                      className="flex-1 h-10 rounded-md border border-white/20 bg-white/10 text-white px-3 text-sm placeholder:text-slate-500"
                    />
                    {workstations.length > 1 && (
                      <Button variant="ghost" size="icon" className="text-red-400" onClick={() => setWorkstations(workstations.filter((_, j) => j !== i))}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" className="border-white/20 text-slate-300" onClick={() => setWorkstations([...workstations, { name: "" }])}>
                  + Add
                </Button>
                <div className="flex gap-3 pt-4">
                  <Button variant="outline" className="text-slate-300 border-slate-600" onClick={() => setSettingsStep(s => s - 1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button className="bg-blue-600 hover:bg-blue-700 ml-auto" onClick={saveWorkstations} disabled={saving}>
                    {saving ? "Saving..." : "Next"} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === "employees" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="h-6 w-6 text-blue-400" />
                  <h2 className="text-xl font-bold text-white">Employees</h2>
                </div>
                <p className="text-sm text-slate-300">Add team members. They'll log in with their name and password.</p>
                {employees.map((emp, i) => (
                  <div key={i} className="grid grid-cols-[1fr_100px_1fr_auto] gap-2">
                    <input placeholder="Name" value={emp.name} onChange={e => { const c = [...employees]; c[i].name = e.target.value; setEmployees(c); }} className="h-10 rounded-md border border-white/20 bg-white/10 text-white px-3 text-sm placeholder:text-slate-500" />
                    <select value={emp.role} onChange={e => { const c = [...employees]; c[i].role = e.target.value; setEmployees(c); }} className="h-10 rounded-md border border-white/20 bg-white/10 text-white px-2 text-sm">
                      <option value="admin">Admin</option>
                      <option value="worker">Worker</option>
                      <option value="teamleader">Leader</option>
                    </select>
                    <input placeholder="Password" value={emp.password} onChange={e => { const c = [...employees]; c[i].password = e.target.value; setEmployees(c); }} className="h-10 rounded-md border border-white/20 bg-white/10 text-white px-3 text-sm placeholder:text-slate-500" />
                    {employees.length > 1 && (
                      <Button variant="ghost" size="icon" className="text-red-400" onClick={() => setEmployees(employees.filter((_, j) => j !== i))}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" className="border-white/20 text-slate-300" onClick={() => setEmployees([...employees, { name: "", role: "worker", password: "" }])}>
                  + Add
                </Button>
                <div className="flex gap-3 pt-4">
                  <Button variant="outline" className="text-slate-300 border-slate-600" onClick={() => setSettingsStep(s => s - 1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button className="bg-blue-600 hover:bg-blue-700 ml-auto" onClick={saveEmployees} disabled={saving}>
                    {saving ? "Saving..." : "Next"} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === "tasks" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <ClipboardList className="h-6 w-6 text-blue-400" />
                  <h2 className="text-xl font-bold text-white">Standard Tasks</h2>
                </div>
                <p className="text-sm text-slate-300">Define common production tasks (e.g. CNC Cutting, Edgebanding, Assembly).</p>
                {tasks.map((task, i) => (
                  <div key={i} className="flex gap-2">
                    <input placeholder="#" value={task.task_number} onChange={e => { const c = [...tasks]; c[i].task_number = e.target.value; setTasks(c); }} className="w-16 h-10 rounded-md border border-white/20 bg-white/10 text-white px-3 text-sm placeholder:text-slate-500" />
                    <input placeholder="Task name" value={task.task_name} onChange={e => { const c = [...tasks]; c[i].task_name = e.target.value; setTasks(c); }} className="flex-1 h-10 rounded-md border border-white/20 bg-white/10 text-white px-3 text-sm placeholder:text-slate-500" />
                    {tasks.length > 1 && (
                      <Button variant="ghost" size="icon" className="text-red-400" onClick={() => setTasks(tasks.filter((_, j) => j !== i))}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" className="border-white/20 text-slate-300" onClick={() => setTasks([...tasks, { task_name: "", task_number: String(tasks.length + 1) }])}>
                  + Add
                </Button>
                <div className="flex gap-3 pt-4">
                  <Button variant="outline" className="text-slate-300 border-slate-600" onClick={() => setSettingsStep(s => s - 1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button className="bg-blue-600 hover:bg-blue-700 ml-auto" onClick={saveTasks} disabled={saving}>
                    {saving ? "Saving..." : "Next"} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {step === "done" && (
              <div className="text-center space-y-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 text-green-400">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-bold text-white">Setup Complete!</h2>
                <p className="text-slate-300">Your essential settings are configured. You can always adjust them in Settings.</p>
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { setMode("tour"); setTourStep(0); }}>
                  Take the Tour <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // Tour mode - introduction to the app
  if (mode === "tour") {
    const step = TOUR_STEPS[tourStep];
    const isLast = tourStep === TOUR_STEPS.length - 1;

    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {/* Progress */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 flex-1">
              {TOUR_STEPS.map((_, i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= tourStep ? "bg-blue-500" : "bg-slate-700"}`} />
              ))}
            </div>
            <Button variant="ghost" size="sm" className="text-slate-400 ml-4" onClick={skipOnboarding}>
              Skip
            </Button>
          </div>

          <Card className="bg-white/5 border-white/10 p-8">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-500/20 text-blue-400">
                {step.icon}
              </div>
              <div>
                <Badge className="bg-blue-600/60 mb-3">{tourStep + 1} / {TOUR_STEPS.length}</Badge>
                <h2 className="text-2xl font-bold text-white">{step.title}</h2>
                <p className="text-slate-300 mt-2 max-w-lg mx-auto">{step.description}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-lg mx-auto">
                {step.details.map((detail, i) => (
                  <div key={i} className="flex items-start gap-2 bg-white/5 rounded-lg p-3">
                    <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-300">{detail}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 justify-center pt-2">
                {tourStep > 0 && (
                  <Button variant="outline" className="text-slate-300 border-slate-600" onClick={() => setTourStep(s => s - 1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                )}
                {isLast ? (
                  <Button className="bg-green-600 hover:bg-green-700" onClick={markOnboardingComplete}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Get Started!
                  </Button>
                ) : (
                  <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setTourStep(s => s + 1)}>
                    Next <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AppOnboardingWizard;
