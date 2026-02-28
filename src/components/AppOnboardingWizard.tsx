import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Users, Factory, ClipboardList, Truck,
  CheckCircle2, ArrowRight, ArrowLeft, X, Rocket,
  Plus, Home, LayoutDashboard, AlertTriangle, ListChecks,
  Clock, Settings, Package, FileText, Receipt, Eye,
  MapPin, BarChart3, Calendar,
} from "lucide-react";

type OnboardingMode = "settings" | "tour" | null;

interface AppOnboardingWizardProps {
  children: React.ReactNode;
}

// ── Types ──
interface NewUser {
  name: string; email: string; password: string; language: string; role: string;
}
interface NewTask {
  task_name: string; task_number: string; time_coefficient: string;
  day_counter: string; hourly_cost: string; is_last_step: boolean;
}
interface NewWorkstation {
  name: string; sort_order: string; production_line: string;
  max_workers: string; assigned_tasks: string[];
}
interface NewTeam {
  name: string; color: string; default_users: string[];
}

const TEAM_COLORS = [
  { value: "green", label: "Green", class: "bg-green-500" },
  { value: "blue", label: "Blue", class: "bg-blue-500" },
  { value: "orange", label: "Orange", class: "bg-orange-500" },
  { value: "red", label: "Red", class: "bg-red-500" },
  { value: "yellow", label: "Yellow", class: "bg-yellow-500" },
  { value: "purple", label: "Purple", class: "bg-purple-500" },
];

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "teamleader", label: "Teamleader" },
  { value: "worker", label: "Worker" },
  { value: "preparater", label: "Preparater" },
  { value: "installation_team", label: "Installation Team" },
];

const SETTINGS_STEPS = ["welcome", "users", "tasks", "workstations", "teams", "done"];

// ── Tour step definitions (role-filtered, with actual routes) ──
interface TourStep {
  key: string;
  route: string; // relative to /:tenant/:lang
  title: string;
  icon: React.ReactNode;
  description: string;
  tips: string[];
  visibleForRoles: string[];
}

const ALL_TOUR_STEPS: TourStep[] = [
  {
    key: "dashboard", route: "/",
    title: "Dashboard",
    icon: <Home className="h-6 w-6" />,
    description: "Your central hub — see project progress, upcoming deadlines and quick stats at a glance.",
    tips: ["Active project overview", "Task completion rates", "Quick access to all features"],
    visibleForRoles: ["admin", "manager", "worker", "teamleader", "preparater", "installation_team"],
  },
  {
    key: "control-panel", route: "/control-panel",
    title: "Control Panel",
    icon: <LayoutDashboard className="h-6 w-6" />,
    description: "Real-time monitoring of your entire production floor from a single screen.",
    tips: ["Live workstation status", "Active task tracking", "Spot bottlenecks instantly"],
    visibleForRoles: ["admin", "manager", "teamleader"],
  },
  {
    key: "projects", route: "/projects",
    title: "Projects",
    icon: <Calendar className="h-6 w-6" />,
    description: "Manage all projects from creation to installation — phases, tasks, and Gantt planning.",
    tips: ["Create projects with deadlines", "Track progress per phase", "Visual Gantt chart planning"],
    visibleForRoles: ["admin", "manager", "worker", "teamleader", "preparater", "installation_team"],
  },
  {
    key: "workstations", route: "/workstations",
    title: "Workstations",
    icon: <Factory className="h-6 w-6" />,
    description: "See which machines are running, who is working, and scan tasks with QR codes.",
    tips: ["Real-time machine status", "Worker assignments", "QR code scanning"],
    visibleForRoles: ["admin", "manager", "worker", "teamleader", "preparater"],
  },
  {
    key: "broken-parts", route: "/broken-parts",
    title: "Broken Parts",
    icon: <AlertTriangle className="h-6 w-6" />,
    description: "Report and track broken or damaged parts with photos and descriptions.",
    tips: ["Quick photo reports", "Track resolution status", "Summary overview"],
    visibleForRoles: ["admin", "manager", "worker", "teamleader", "preparater"],
  },
  {
    key: "personal-tasks", route: "/personal-tasks",
    title: "Personal Tasks",
    icon: <ListChecks className="h-6 w-6" />,
    description: "Your personal task list — start timers, add notes, and track productivity.",
    tips: ["Start/stop task timers", "Add notes and photos", "See assigned tasks"],
    visibleForRoles: ["admin", "manager", "worker", "teamleader", "preparater"],
  },
  {
    key: "daily-tasks", route: "/daily-tasks",
    title: "Installation Planning",
    icon: <Truck className="h-6 w-6" />,
    description: "Plan installation team schedules and assign teams to projects.",
    tips: ["Assign teams to projects", "View installation calendar", "Manage truck loading"],
    visibleForRoles: ["admin", "manager", "teamleader", "installation_team"],
  },
  {
    key: "planning", route: "/planning",
    title: "Production Planning",
    icon: <BarChart3 className="h-6 w-6" />,
    description: "Gantt-based production planning with drag-and-drop scheduling.",
    tips: ["Drag to reschedule", "Capacity overview", "Deadline tracking"],
    visibleForRoles: ["admin", "manager", "teamleader", "installation_team"],
  },
  {
    key: "orders", route: "/orders",
    title: "Orders",
    icon: <Package className="h-6 w-6" />,
    description: "Manage supplier orders, track deliveries, and handle backorders.",
    tips: ["Create and track orders", "Delivery date tracking", "Supplier management"],
    visibleForRoles: ["admin", "manager", "teamleader", "preparater"],
  },
  {
    key: "logistics", route: "/logistics",
    title: "Logistics In",
    icon: <Truck className="h-6 w-6" />,
    description: "Receive and confirm incoming deliveries with barcode scanning.",
    tips: ["Scan incoming deliveries", "Confirm quantities", "Track backorders"],
    visibleForRoles: ["admin", "manager", "teamleader", "preparater"],
  },
  {
    key: "rush-orders", route: "/rush-orders",
    title: "Rush Orders",
    icon: <Package className="h-6 w-6" />,
    description: "Handle urgent rush orders with priority tracking and team chat.",
    tips: ["Priority status tracking", "In-app team chat", "Quick assignment"],
    visibleForRoles: ["admin", "manager", "teamleader", "worker", "installation_team"],
  },
  {
    key: "time-registrations", route: "/time-registrations",
    title: "Time Registrations",
    icon: <Clock className="h-6 w-6" />,
    description: "View time reports per employee or project, compare estimated vs actual hours.",
    tips: ["Employee time overview", "Project cost tracking", "Overtime detection"],
    visibleForRoles: ["admin", "manager", "teamleader"],
  },
  {
    key: "settings", route: "/settings",
    title: "Settings",
    icon: <Settings className="h-6 w-6" />,
    description: "Configure workstations, tasks, employees, suppliers, and email notifications.",
    tips: ["Manage production routing", "Configure employees", "Set up integrations"],
    visibleForRoles: ["admin", "teamleader"],
  },
];

const AppOnboardingWizard: React.FC<AppOnboardingWizardProps> = ({ children }) => {
  const { currentEmployee, isDeveloper } = useAuth();
  const { tenant } = useTenant();
  const { t, lang, createLocalizedPath } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<OnboardingMode>(null);
  const [loading, setLoading] = useState(true);
  const [tourStep, setTourStep] = useState(0);
  const [settingsStep, setSettingsStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Settings wizard data
  const [users, setUsers] = useState<NewUser[]>([
    { name: "", email: "", password: "", language: "nl", role: "worker" },
  ]);
  const [tasks, setTasks] = useState<NewTask[]>([
    { task_name: "", task_number: "1", time_coefficient: "1.0", day_counter: "0", hourly_cost: "0", is_last_step: false },
  ]);
  const [workstations, setWorkstations] = useState<NewWorkstation[]>([
    { name: "", sort_order: "1", production_line: "1", max_workers: "2", assigned_tasks: [] },
  ]);
  const [teams, setTeams] = useState<NewTeam[]>([
    { name: "", color: "green", default_users: [] },
  ]);
  const [createdTaskNames, setCreatedTaskNames] = useState<string[]>([]);
  const [createdUserNames, setCreatedUserNames] = useState<string[]>([]);

  // Role-filtered tour steps
  const tourSteps = ALL_TOUR_STEPS.filter((step) => {
    if (isDeveloper) return true;
    if (!currentEmployee) return false;
    return step.visibleForRoles.includes(currentEmployee.role);
  });

  useEffect(() => {
    checkOnboardingStatus();
  }, [currentEmployee, tenant]);

  const checkOnboardingStatus = async () => {
    if (!currentEmployee || !tenant) {
      setLoading(false);
      return;
    }
    if (currentEmployee.role === "workstation") {
      setLoading(false);
      return;
    }

    try {
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

      // Check if basic settings exist
      const [wsResult, taskResult] = await Promise.all([
        supabase.from("workstations").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
        supabase.from("standard_tasks").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
      ]);

      const hasWorkstations = (wsResult.count || 0) > 0;
      const hasTasks = (taskResult.count || 0) > 0;

      if (!hasWorkstations || !hasTasks) {
        if (currentEmployee.role === "admin" || isDeveloper) {
          setMode("settings");
        } else {
          setMode("tour");
        }
      } else {
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
    // Navigate back to dashboard
    navigate(createLocalizedPath("/"));
  };

  // ── Save functions ──
  const saveUsers = async () => {
    const valid = users.filter((u) => u.name.trim() && u.email.trim());
    if (!valid.length) { setCreatedUserNames([]); setSettingsStep(s => s + 1); return; }
    setSaving(true);
    try {
      const names: string[] = [];
      for (const user of valid) {
        await supabase.functions.invoke("create-employee", {
          body: {
            name: user.name.trim(), email: user.email.trim(),
            password: user.password.trim() || user.name.trim().toLowerCase(),
            role: user.role, tenantId: tenant!.id, preferred_language: user.language,
          },
        });
        names.push(user.name.trim());
      }
      setCreatedUserNames(names);
      setSettingsStep(s => s + 1);
    } catch (e: any) { console.error("Error saving users:", e); }
    setSaving(false);
  };

  const saveTasks = async () => {
    const valid = tasks.filter((t) => t.task_name.trim());
    if (!valid.length) { setCreatedTaskNames([]); setSettingsStep(s => s + 1); return; }
    setSaving(true);
    try {
      await supabase.from("standard_tasks").insert(
        valid.map((t) => ({
          task_name: t.task_name.trim(), task_number: t.task_number.trim() || "1",
          time_coefficient: parseFloat(t.time_coefficient) || 1.0,
          day_counter: parseInt(t.day_counter) || 0,
          hourly_cost: parseFloat(t.hourly_cost) || 0,
          is_last_production_step: t.is_last_step, tenant_id: tenant!.id,
        }))
      );
      setCreatedTaskNames(valid.map((t) => t.task_name.trim()));
      setSettingsStep(s => s + 1);
    } catch (e: any) { console.error("Error saving tasks:", e); }
    setSaving(false);
  };

  const saveWorkstations = async () => {
    const valid = workstations.filter((w) => w.name.trim());
    if (!valid.length) { setSettingsStep(s => s + 1); return; }
    setSaving(true);
    try {
      for (const ws of valid) {
        const { data: inserted, error } = await supabase
          .from("workstations")
          .insert({
            name: ws.name.trim(), sort_order: parseInt(ws.sort_order) || 1,
            production_line: parseInt(ws.production_line) || 1,
            max_workers: parseInt(ws.max_workers) || 2, tenant_id: tenant!.id,
          })
          .select("id").single();
        if (error) throw error;
        if (ws.assigned_tasks.length > 0 && inserted) {
          const { data: taskRows } = await supabase
            .from("standard_tasks").select("id, task_name")
            .eq("tenant_id", tenant!.id).in("task_name", ws.assigned_tasks);
          if (taskRows?.length) {
            await supabase.from("task_workstation_links").insert(
              taskRows.map((tr) => ({ task_id: tr.id, workstation_id: inserted.id, tenant_id: tenant!.id }))
            );
          }
        }
      }
      setSettingsStep(s => s + 1);
    } catch (e: any) { console.error("Error saving workstations:", e); }
    setSaving(false);
  };

  const saveTeams = async () => {
    const valid = teams.filter((t) => t.name.trim());
    if (!valid.length) { setSettingsStep(s => s + 1); return; }
    setSaving(true);
    try {
      for (const team of valid) {
        const { data: inserted, error } = await supabase
          .from("placement_teams")
          .insert({ name: team.name.trim(), color: team.color, is_active: true, external_team_names: [], tenant_id: tenant!.id })
          .select("id").single();
        if (error) throw error;
        if (team.default_users.length > 0 && inserted) {
          const { data: empRows } = await supabase
            .from("employees").select("id, name")
            .eq("tenant_id", tenant!.id).in("name", team.default_users);
          if (empRows?.length) {
            await supabase.from("placement_team_members").insert(
              empRows.map((emp) => ({ team_id: inserted.id, employee_id: emp.id, tenant_id: tenant!.id }))
            );
          }
        }
      }
      setSettingsStep(s => s + 1);
    } catch (e: any) { console.error("Error saving teams:", e); }
    setSaving(false);
  };

  // ── Tour navigation ──
  const navigateToTourStep = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < tourSteps.length) {
      const step = tourSteps[stepIndex];
      setTourStep(stepIndex);
      navigate(createLocalizedPath(step.route));
    }
  }, [tourSteps, navigate, createLocalizedPath]);

  const handleTourNext = () => {
    if (tourStep < tourSteps.length - 1) {
      navigateToTourStep(tourStep + 1);
    } else {
      markOnboardingComplete();
    }
  };

  const handleTourBack = () => {
    if (tourStep > 0) {
      navigateToTourStep(tourStep - 1);
    }
  };

  const startTour = () => {
    setMode("tour");
    setTourStep(0);
    if (tourSteps.length > 0) {
      navigate(createLocalizedPath(tourSteps[0].route));
    }
  };

  if (loading || !mode) {
    return <>{children}</>;
  }

  // ═══════════════════════════════════════════
  // ── SETTINGS WIZARD (fullscreen overlay) ──
  // ═══════════════════════════════════════════
  if (mode === "settings") {
    const step = SETTINGS_STEPS[settingsStep];

    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-3xl my-8">
          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-6">
            {SETTINGS_STEPS.map((s, i) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= settingsStep ? "bg-blue-500" : "bg-slate-700"}`} />
            ))}
          </div>

          <Card className="bg-white/5 border-white/10 p-6 md:p-8">
            {/* Welcome */}
            {step === "welcome" && (
              <div className="text-center space-y-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 text-blue-400">
                  <Rocket className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-bold text-white">Let's set up your workspace</h2>
                <p className="text-slate-300 max-w-lg mx-auto">
                  We'll guide you through the essential configuration in 4 quick steps:
                  Users, Tasks, Workstations, and Installation Teams.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-lg mx-auto">
                  {[
                    { icon: <Users className="h-5 w-5" />, label: "Users" },
                    { icon: <ClipboardList className="h-5 w-5" />, label: "Tasks" },
                    { icon: <Factory className="h-5 w-5" />, label: "Workstations" },
                    { icon: <Truck className="h-5 w-5" />, label: "Teams" },
                  ].map((item) => (
                    <div key={item.label} className="bg-white/5 rounded-lg p-3 text-center">
                      <div className="text-blue-400 flex justify-center mb-1">{item.icon}</div>
                      <span className="text-xs text-slate-300">{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" className="text-slate-300 border-slate-600" onClick={markOnboardingComplete}>
                    Skip for now
                  </Button>
                  <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setSettingsStep(1)}>
                    Let's go <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 1: Users */}
            {step === "users" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="h-6 w-6 text-blue-400" />
                  <div>
                    <h2 className="text-xl font-bold text-white">Add Users</h2>
                    <p className="text-sm text-slate-400">Create authenticated users for your workspace</p>
                  </div>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {users.map((user, i) => (
                    <div key={i} className="bg-white/5 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-medium">User {i + 1}</span>
                        {users.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => setUsers(users.filter((_, j) => j !== i))}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-slate-400">Username</Label>
                          <Input placeholder="John Doe" value={user.name} onChange={(e) => { const c = [...users]; c[i].name = e.target.value; setUsers(c); }}
                            className="bg-white/10 border-white/20 text-white text-sm h-9 placeholder:text-slate-500" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-400">Email</Label>
                          <Input type="email" placeholder="john@company.com" value={user.email} onChange={(e) => { const c = [...users]; c[i].email = e.target.value; setUsers(c); }}
                            className="bg-white/10 border-white/20 text-white text-sm h-9 placeholder:text-slate-500" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-400">Password</Label>
                          <Input type="password" placeholder="Min 6 characters" value={user.password} onChange={(e) => { const c = [...users]; c[i].password = e.target.value; setUsers(c); }}
                            className="bg-white/10 border-white/20 text-white text-sm h-9 placeholder:text-slate-500" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-slate-400">Language</Label>
                            <Select value={user.language} onValueChange={(v) => { const c = [...users]; c[i].language = v; setUsers(c); }}>
                              <SelectTrigger className="bg-white/10 border-white/20 text-white text-sm h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="nl">NL</SelectItem>
                                <SelectItem value="en">EN</SelectItem>
                                <SelectItem value="fr">FR</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-400">Role</Label>
                            <Select value={user.role} onValueChange={(v) => { const c = [...users]; c[i].role = v; setUsers(c); }}>
                              <SelectTrigger className="bg-white/10 border-white/20 text-white text-sm h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="border-white/20 text-slate-300"
                  onClick={() => setUsers([...users, { name: "", email: "", password: "", language: "nl", role: "worker" }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add User
                </Button>
                <div className="flex gap-3 pt-4">
                  <Button variant="outline" className="text-slate-300 border-slate-600" onClick={() => setSettingsStep(s => s - 1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button className="bg-blue-600 hover:bg-blue-700 ml-auto" onClick={saveUsers} disabled={saving}>
                    {saving ? "Saving..." : "Next"} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Standard Tasks */}
            {step === "tasks" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <ClipboardList className="h-6 w-6 text-blue-400" />
                  <div>
                    <h2 className="text-xl font-bold text-white">Standard Tasks</h2>
                    <p className="text-sm text-slate-400">Define production tasks (e.g., CNC Cutting, Assembly)</p>
                  </div>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {tasks.map((task, i) => (
                    <div key={i} className="bg-white/5 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400 font-medium">Task {i + 1}</span>
                        {tasks.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => setTasks(tasks.filter((_, j) => j !== i))}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <Label className="text-xs text-slate-400">Task Name</Label>
                          <Input placeholder="e.g. CNC Cutting" value={task.task_name} onChange={(e) => { const c = [...tasks]; c[i].task_name = e.target.value; setTasks(c); }}
                            className="bg-white/10 border-white/20 text-white text-sm h-9 placeholder:text-slate-500" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-400">#</Label>
                          <Input placeholder="1" value={task.task_number} onChange={(e) => { const c = [...tasks]; c[i].task_number = e.target.value; setTasks(c); }}
                            className="bg-white/10 border-white/20 text-white text-sm h-9 placeholder:text-slate-500" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <div>
                          <Label className="text-xs text-slate-400">Time Coeff.</Label>
                          <Input type="number" step="0.1" value={task.time_coefficient} onChange={(e) => { const c = [...tasks]; c[i].time_coefficient = e.target.value; setTasks(c); }}
                            className="bg-white/10 border-white/20 text-white text-sm h-9" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-400">Day Counter</Label>
                          <Input type="number" value={task.day_counter} onChange={(e) => { const c = [...tasks]; c[i].day_counter = e.target.value; setTasks(c); }}
                            className="bg-white/10 border-white/20 text-white text-sm h-9" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-400">€/hour</Label>
                          <Input type="number" step="0.01" value={task.hourly_cost} onChange={(e) => { const c = [...tasks]; c[i].hourly_cost = e.target.value; setTasks(c); }}
                            className="bg-white/10 border-white/20 text-white text-sm h-9" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Switch checked={task.is_last_step} onCheckedChange={(v) => { const c = [...tasks]; c[i].is_last_step = v; setTasks(c); }} />
                        <Label className="text-xs text-slate-400">Last production step</Label>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="border-white/20 text-slate-300"
                  onClick={() => setTasks([...tasks, { task_name: "", task_number: String(tasks.length + 1), time_coefficient: "1.0", day_counter: "0", hourly_cost: "0", is_last_step: false }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add Task
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

            {/* Step 3: Workstations */}
            {step === "workstations" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <Factory className="h-6 w-6 text-blue-400" />
                  <div>
                    <h2 className="text-xl font-bold text-white">Workstations</h2>
                    <p className="text-sm text-slate-400">Configure your production line workstations</p>
                  </div>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {workstations.map((ws, i) => (
                    <div key={i} className="bg-white/5 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400 font-medium">Workstation {i + 1}</span>
                        {workstations.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => setWorkstations(workstations.filter((_, j) => j !== i))}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-2">
                          <Label className="text-xs text-slate-400">Name</Label>
                          <Input placeholder="e.g. CNC Machine" value={ws.name} onChange={(e) => { const c = [...workstations]; c[i].name = e.target.value; setWorkstations(c); }}
                            className="bg-white/10 border-white/20 text-white text-sm h-9 placeholder:text-slate-500" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-400">Order</Label>
                          <Input type="number" value={ws.sort_order} onChange={(e) => { const c = [...workstations]; c[i].sort_order = e.target.value; setWorkstations(c); }}
                            className="bg-white/10 border-white/20 text-white text-sm h-9" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-400">Line</Label>
                          <Input type="number" value={ws.production_line} onChange={(e) => { const c = [...workstations]; c[i].production_line = e.target.value; setWorkstations(c); }}
                            className="bg-white/10 border-white/20 text-white text-sm h-9" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <Label className="text-xs text-slate-400">Max Employees</Label>
                          <Input type="number" value={ws.max_workers} onChange={(e) => { const c = [...workstations]; c[i].max_workers = e.target.value; setWorkstations(c); }}
                            className="bg-white/10 border-white/20 text-white text-sm h-9" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-400">Assign Tasks</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {createdTaskNames.map((taskName) => {
                              const isSelected = ws.assigned_tasks.includes(taskName);
                              return (
                                <Badge key={taskName}
                                  className={`cursor-pointer text-[10px] ${isSelected ? "bg-blue-600" : "bg-white/10 text-slate-400"}`}
                                  onClick={() => {
                                    const c = [...workstations];
                                    c[i].assigned_tasks = isSelected
                                      ? c[i].assigned_tasks.filter((t) => t !== taskName)
                                      : [...c[i].assigned_tasks, taskName];
                                    setWorkstations(c);
                                  }}>
                                  {taskName}
                                </Badge>
                              );
                            })}
                            {createdTaskNames.length === 0 && <span className="text-xs text-slate-500">No tasks created yet</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="border-white/20 text-slate-300"
                  onClick={() => setWorkstations([...workstations, { name: "", sort_order: String(workstations.length + 1), production_line: "1", max_workers: "2", assigned_tasks: [] }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add Workstation
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

            {/* Step 4: Installation Teams */}
            {step === "teams" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <Truck className="h-6 w-6 text-blue-400" />
                  <div>
                    <h2 className="text-xl font-bold text-white">Installation Teams</h2>
                    <p className="text-sm text-slate-400">Set up your installation teams with colors and members</p>
                  </div>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {teams.map((team, i) => (
                    <div key={i} className="bg-white/5 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400 font-medium">Team {i + 1}</span>
                        {teams.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => setTeams(teams.filter((_, j) => j !== i))}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-slate-400">Team Name</Label>
                          <Input placeholder="e.g. Team Green" value={team.name} onChange={(e) => { const c = [...teams]; c[i].name = e.target.value; setTeams(c); }}
                            className="bg-white/10 border-white/20 text-white text-sm h-9 placeholder:text-slate-500" />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-400">Color</Label>
                          <div className="flex gap-2 mt-1">
                            {TEAM_COLORS.map((color) => (
                              <button key={color.value}
                                className={`w-7 h-7 rounded-full ${color.class} ${team.color === color.value ? "ring-2 ring-white ring-offset-2 ring-offset-slate-800" : "opacity-50"}`}
                                onClick={() => { const c = [...teams]; c[i].color = color.value; setTeams(c); }}
                                title={color.label} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2">
                        <Label className="text-xs text-slate-400">Default Members</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {createdUserNames.map((userName) => {
                            const isSelected = team.default_users.includes(userName);
                            return (
                              <Badge key={userName}
                                className={`cursor-pointer text-[10px] ${isSelected ? "bg-green-600" : "bg-white/10 text-slate-400"}`}
                                onClick={() => {
                                  const c = [...teams];
                                  c[i].default_users = isSelected
                                    ? c[i].default_users.filter((u) => u !== userName)
                                    : [...c[i].default_users, userName];
                                  setTeams(c);
                                }}>
                                {userName}
                              </Badge>
                            );
                          })}
                          {currentEmployee && (
                            <Badge
                              className={`cursor-pointer text-[10px] ${team.default_users.includes(currentEmployee.name) ? "bg-green-600" : "bg-white/10 text-slate-400"}`}
                              onClick={() => {
                                const c = [...teams];
                                c[i].default_users = team.default_users.includes(currentEmployee.name)
                                  ? c[i].default_users.filter((u) => u !== currentEmployee.name)
                                  : [...c[i].default_users, currentEmployee.name];
                                setTeams(c);
                              }}>
                              {currentEmployee.name} (you)
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="border-white/20 text-slate-300"
                  onClick={() => setTeams([...teams, { name: "", color: TEAM_COLORS[teams.length % TEAM_COLORS.length].value, default_users: [] }])}>
                  <Plus className="h-3 w-3 mr-1" /> Add Team
                </Button>
                <div className="flex gap-3 pt-4">
                  <Button variant="outline" className="text-slate-300 border-slate-600" onClick={() => setSettingsStep(s => s - 1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button className="bg-blue-600 hover:bg-blue-700 ml-auto" onClick={saveTeams} disabled={saving}>
                    {saving ? "Saving..." : "Finish Setup"} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Done → transition to tour */}
            {step === "done" && (
              <div className="text-center space-y-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 text-green-400">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-bold text-white">Setup Complete!</h2>
                <p className="text-slate-300">
                  Your workspace is configured. Would you like a guided tour of the application?
                </p>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" className="text-slate-300 border-slate-600" onClick={markOnboardingComplete}>
                    Skip Tour
                  </Button>
                  <Button className="bg-blue-600 hover:bg-blue-700" onClick={startTour}>
                    <Eye className="mr-2 h-4 w-4" /> Take the Tour
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // ── TOUR MODE (floating overlay on real app) ──
  // ═══════════════════════════════════════════
  if (mode === "tour") {
    const step = tourSteps[tourStep];
    const isLast = tourStep === tourSteps.length - 1;
    const isFirst = tourStep === 0;

    if (!step) {
      markOnboardingComplete();
      return <>{children}</>;
    }

    return (
      <>
        {/* Render the actual app underneath */}
        {children}

        {/* Semi-transparent overlay */}
        <div className="fixed inset-0 z-40 bg-black/40 pointer-events-none" />

        {/* Floating tour card — bottom-right on desktop, bottom on mobile */}
        <div className="fixed z-50 bottom-6 right-6 left-6 md:left-auto md:w-[420px] animate-in slide-in-from-bottom-4 duration-500">
          <Card className="bg-slate-900/95 backdrop-blur-xl border-blue-500/30 shadow-2xl shadow-blue-500/10 p-0 overflow-hidden">
            {/* Top accent bar */}
            <div className="h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-600" />

            <div className="p-5">
              {/* Header with step count and skip */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                    {step.icon}
                  </div>
                  <Badge className="bg-blue-600/60 text-[11px]">
                    {tourStep + 1} / {tourSteps.length}
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white text-xs h-7 px-2"
                  onClick={markOnboardingComplete}>
                  Skip tour
                </Button>
              </div>

              {/* Content */}
              <h3 className="text-lg font-bold text-white mb-1">{step.title}</h3>
              <p className="text-sm text-slate-300 mb-4">{step.description}</p>

              {/* Tips */}
              <div className="space-y-1.5 mb-5">
                {step.tips.map((tip, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                    <span className="text-xs text-slate-400">{tip}</span>
                  </div>
                ))}
              </div>

              {/* Progress dots */}
              <div className="flex gap-1 mb-4">
                {tourSteps.map((_, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    i < tourStep ? "bg-blue-500" : i === tourStep ? "bg-blue-400" : "bg-slate-700"
                  }`} />
                ))}
              </div>

              {/* Navigation buttons */}
              <div className="flex gap-2">
                {!isFirst && (
                  <Button variant="outline" size="sm" className="text-slate-300 border-slate-600 hover:bg-slate-800"
                    onClick={handleTourBack}>
                    <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
                  </Button>
                )}
                <Button size="sm" className={`ml-auto ${isLast ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"}`}
                  onClick={handleTourNext}>
                  {isLast ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Get Started!
                    </>
                  ) : (
                    <>
                      Next Page <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </>
    );
  }

  return <>{children}</>;
};

export default AppOnboardingWizard;
