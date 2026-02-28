import React, { useState, useEffect } from "react";
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
  Users, Factory, Route, ClipboardList, Truck,
  CheckCircle2, ArrowRight, ArrowLeft, X, Rocket, BarChart3,
  Calendar, Settings, FileText, Eye, Package, Plus,
  Home, LayoutDashboard, AlertTriangle, ListChecks, Clock, Receipt,
} from "lucide-react";

type OnboardingMode = "settings" | "tour" | null;

interface AppOnboardingWizardProps {
  children: React.ReactNode;
}

// Types for wizard data
interface NewUser {
  name: string;
  email: string;
  password: string;
  language: string;
  role: string;
}

interface NewTask {
  task_name: string;
  task_number: string;
  time_coefficient: string;
  day_counter: string;
  hourly_cost: string;
  is_last_step: boolean;
}

interface NewWorkstation {
  name: string;
  sort_order: string;
  production_line: string;
  max_workers: string;
  assigned_tasks: string[];
}

interface NewTeam {
  name: string;
  color: string;
  default_users: string[];
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

// Role-based tour steps
const ALL_TOUR_STEPS = [
  {
    key: "welcome",
    title: "Welcome to AutoMattiOn Compass!",
    icon: <Rocket className="h-10 w-10" />,
    description: "Your production planning system is ready. Let us show you around.",
    details: [
      "Plan and monitor your entire production workflow",
      "Track tasks across workstations in real-time",
      "Manage projects, orders, and deliveries",
      "Coordinate installation teams and logistics",
    ],
    visibleForRoles: ["admin", "manager", "worker", "teamleader", "preparater", "installation_team"],
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
    visibleForRoles: ["admin", "manager", "worker", "teamleader", "preparater", "installation_team"],
  },
  {
    key: "control-panel",
    title: "Control Panel",
    icon: <LayoutDashboard className="h-10 w-10" />,
    description: "Real-time monitoring of your production floor.",
    details: [
      "Live workstation status overview",
      "Monitor active tasks and workers",
      "Spot bottlenecks and issues instantly",
      "Take immediate corrective action",
    ],
    visibleForRoles: ["admin", "manager", "teamleader"],
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
    visibleForRoles: ["admin", "manager", "worker", "teamleader", "preparater", "installation_team"],
  },
  {
    key: "workstations",
    title: "Workstations",
    icon: <Factory className="h-10 w-10" />,
    description: "Monitor your production floor in real-time.",
    details: [
      "See which machines are active",
      "Track who is working on what",
      "Monitor buffer times between stations",
      "Scan tasks with QR codes",
    ],
    visibleForRoles: ["admin", "manager", "worker", "teamleader", "preparater"],
  },
  {
    key: "personal-tasks",
    title: "Personal Tasks & Notes",
    icon: <ListChecks className="h-10 w-10" />,
    description: "Your personal task list and quick notes.",
    details: [
      "See tasks assigned to you",
      "Start and stop task timers",
      "Add notes and photos to tasks",
      "Track your personal productivity",
    ],
    visibleForRoles: ["admin", "manager", "worker", "teamleader", "preparater"],
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
    visibleForRoles: ["admin", "manager", "teamleader", "preparater"],
  },
  {
    key: "installation-planning",
    title: "Installation Planning",
    icon: <Truck className="h-10 w-10" />,
    description: "Plan and manage installation team schedules.",
    details: [
      "Assign teams to projects",
      "Track installation timelines",
      "Manage truck loading schedules",
      "Coordinate team members and availability",
    ],
    visibleForRoles: ["admin", "manager", "teamleader", "installation_team"],
  },
  {
    key: "time-registrations",
    title: "Time Registration",
    icon: <Clock className="h-10 w-10" />,
    description: "Track working hours and task durations.",
    details: [
      "Employees start/stop timers on tasks",
      "Automatic overtime detection",
      "View time reports per employee or project",
      "Compare estimated vs actual durations",
    ],
    visibleForRoles: ["admin", "manager", "teamleader"],
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
    visibleForRoles: ["admin", "teamleader"],
  },
];

const AppOnboardingWizard: React.FC<AppOnboardingWizardProps> = ({ children }) => {
  const { currentEmployee, isDeveloper } = useAuth();
  const { tenant } = useTenant();
  const { t } = useLanguage();
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

  // Created IDs for cross-referencing
  const [createdTaskNames, setCreatedTaskNames] = useState<string[]>([]);
  const [createdUserNames, setCreatedUserNames] = useState<string[]>([]);

  // Get role-filtered tour steps
  const tourSteps = ALL_TOUR_STEPS.filter((step) => {
    if (isDeveloper) return true;
    if (!currentEmployee) return step.key === "welcome";
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
  };

  // Save functions for each step
  const saveUsers = async () => {
    const valid = users.filter((u) => u.name.trim() && u.email.trim());
    if (!valid.length) {
      setCreatedUserNames([]);
      setSettingsStep((s) => s + 1);
      return;
    }
    setSaving(true);
    try {
      const names: string[] = [];
      for (const user of valid) {
        await supabase.functions.invoke("create-employee", {
          body: {
            name: user.name.trim(),
            email: user.email.trim(),
            password: user.password.trim() || user.name.trim().toLowerCase(),
            role: user.role,
            tenantId: tenant!.id,
            preferred_language: user.language,
          },
        });
        names.push(user.name.trim());
      }
      setCreatedUserNames(names);
      setSettingsStep((s) => s + 1);
    } catch (e: any) {
      console.error("Error saving users:", e);
    }
    setSaving(false);
  };

  const saveTasks = async () => {
    const valid = tasks.filter((t) => t.task_name.trim());
    if (!valid.length) {
      setCreatedTaskNames([]);
      setSettingsStep((s) => s + 1);
      return;
    }
    setSaving(true);
    try {
      await supabase.from("standard_tasks").insert(
        valid.map((t) => ({
          task_name: t.task_name.trim(),
          task_number: t.task_number.trim() || "1",
          time_coefficient: parseFloat(t.time_coefficient) || 1.0,
          day_counter: parseInt(t.day_counter) || 0,
          hourly_cost: parseFloat(t.hourly_cost) || 0,
          is_last_production_step: t.is_last_step,
          tenant_id: tenant!.id,
        }))
      );
      setCreatedTaskNames(valid.map((t) => t.task_name.trim()));
      setSettingsStep((s) => s + 1);
    } catch (e: any) {
      console.error("Error saving tasks:", e);
    }
    setSaving(false);
  };

  const saveWorkstations = async () => {
    const valid = workstations.filter((w) => w.name.trim());
    if (!valid.length) {
      setSettingsStep((s) => s + 1);
      return;
    }
    setSaving(true);
    try {
      for (const ws of valid) {
        const { data: inserted, error } = await supabase
          .from("workstations")
          .insert({
            name: ws.name.trim(),
            sort_order: parseInt(ws.sort_order) || 1,
            production_line: parseInt(ws.production_line) || 1,
            max_workers: parseInt(ws.max_workers) || 2,
            tenant_id: tenant!.id,
          })
          .select("id")
          .single();

        if (error) throw error;

        // Assign selected tasks to this workstation
        if (ws.assigned_tasks.length > 0 && inserted) {
          const { data: taskRows } = await supabase
            .from("standard_tasks")
            .select("id, task_name")
            .eq("tenant_id", tenant!.id)
            .in("task_name", ws.assigned_tasks);

          if (taskRows?.length) {
            await supabase.from("task_workstation_links").insert(
              taskRows.map((tr) => ({
                task_id: tr.id,
                workstation_id: inserted.id,
                tenant_id: tenant!.id,
              }))
            );
          }
        }
      }
      setSettingsStep((s) => s + 1);
    } catch (e: any) {
      console.error("Error saving workstations:", e);
    }
    setSaving(false);
  };

  const saveTeams = async () => {
    const valid = teams.filter((t) => t.name.trim());
    if (!valid.length) {
      setSettingsStep((s) => s + 1);
      return;
    }
    setSaving(true);
    try {
      for (const team of valid) {
        const { data: inserted, error } = await supabase
          .from("placement_teams")
          .insert({
            name: team.name.trim(),
            color: team.color,
            is_active: true,
            external_team_names: [],
            tenant_id: tenant!.id,
          })
          .select("id")
          .single();

        if (error) throw error;

        // Add default members
        if (team.default_users.length > 0 && inserted) {
          const { data: empRows } = await supabase
            .from("employees")
            .select("id, name")
            .eq("tenant_id", tenant!.id)
            .in("name", team.default_users);

          if (empRows?.length) {
            await supabase.from("placement_team_members").insert(
              empRows.map((emp) => ({
                team_id: inserted.id,
                employee_id: emp.id,
                tenant_id: tenant!.id,
              }))
            );
          }
        }
      }
      setSettingsStep((s) => s + 1);
    } catch (e: any) {
      console.error("Error saving teams:", e);
    }
    setSaving(false);
  };

  if (loading || !mode) {
    return <>{children}</>;
  }

  // ── Settings Wizard ──
  if (mode === "settings") {
    const step = SETTINGS_STEPS[settingsStep];

    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-3xl my-8">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-6">
            {SETTINGS_STEPS.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= settingsStep ? "bg-blue-500" : "bg-slate-700"
                }`}
              />
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
                  We'll guide you through the essential configuration steps. This takes about 5 minutes and will set up
                  users, tasks, workstations, and installation teams.
                </p>
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
                  <Button variant="outline" className="text-slate-300 border-slate-600" onClick={() => setSettingsStep((s) => s - 1)}>
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
                  <Button variant="outline" className="text-slate-300 border-slate-600" onClick={() => setSettingsStep((s) => s - 1)}>
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
                                <Badge
                                  key={taskName}
                                  className={`cursor-pointer text-[10px] ${isSelected ? "bg-blue-600" : "bg-white/10 text-slate-400"}`}
                                  onClick={() => {
                                    const c = [...workstations];
                                    if (isSelected) {
                                      c[i].assigned_tasks = c[i].assigned_tasks.filter((t) => t !== taskName);
                                    } else {
                                      c[i].assigned_tasks = [...c[i].assigned_tasks, taskName];
                                    }
                                    setWorkstations(c);
                                  }}
                                >
                                  {taskName}
                                </Badge>
                              );
                            })}
                            {createdTaskNames.length === 0 && (
                              <span className="text-xs text-slate-500">No tasks created yet</span>
                            )}
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
                  <Button variant="outline" className="text-slate-300 border-slate-600" onClick={() => setSettingsStep((s) => s - 1)}>
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
                              <button
                                key={color.value}
                                className={`w-7 h-7 rounded-full ${color.class} ${team.color === color.value ? "ring-2 ring-white ring-offset-2 ring-offset-slate-800" : "opacity-50"}`}
                                onClick={() => { const c = [...teams]; c[i].color = color.value; setTeams(c); }}
                                title={color.label}
                              />
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
                              <Badge
                                key={userName}
                                className={`cursor-pointer text-[10px] ${isSelected ? "bg-green-600" : "bg-white/10 text-slate-400"}`}
                                onClick={() => {
                                  const c = [...teams];
                                  if (isSelected) {
                                    c[i].default_users = c[i].default_users.filter((u) => u !== userName);
                                  } else {
                                    c[i].default_users = [...c[i].default_users, userName];
                                  }
                                  setTeams(c);
                                }}
                              >
                                {userName}
                              </Badge>
                            );
                          })}
                          {/* Also show current employee */}
                          {currentEmployee && (
                            <Badge
                              className={`cursor-pointer text-[10px] ${team.default_users.includes(currentEmployee.name) ? "bg-green-600" : "bg-white/10 text-slate-400"}`}
                              onClick={() => {
                                const c = [...teams];
                                if (team.default_users.includes(currentEmployee.name)) {
                                  c[i].default_users = c[i].default_users.filter((u) => u !== currentEmployee.name);
                                } else {
                                  c[i].default_users = [...c[i].default_users, currentEmployee.name];
                                }
                                setTeams(c);
                              }}
                            >
                              {currentEmployee.name} (you)
                            </Badge>
                          )}
                          {createdUserNames.length === 0 && !currentEmployee && (
                            <span className="text-xs text-slate-500">No users created yet</span>
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
                  <Button variant="outline" className="text-slate-300 border-slate-600" onClick={() => setSettingsStep((s) => s - 1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button className="bg-blue-600 hover:bg-blue-700 ml-auto" onClick={saveTeams} disabled={saving}>
                    {saving ? "Saving..." : "Next"} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Done */}
            {step === "done" && (
              <div className="text-center space-y-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 text-green-400">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-bold text-white">Setup Complete!</h2>
                <p className="text-slate-300">
                  Your essential settings are configured. You can always adjust them in Settings.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" className="text-slate-300 border-slate-600" onClick={markOnboardingComplete}>
                    Skip Tour
                  </Button>
                  <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { setMode("tour"); setTourStep(0); }}>
                    Take the Tour <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // ── Tour Mode ──
  if (mode === "tour") {
    const step = tourSteps[tourStep];
    const isLast = tourStep === tourSteps.length - 1;

    if (!step) {
      markOnboardingComplete();
      return <>{children}</>;
    }

    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {/* Progress */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 flex-1">
              {tourSteps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i <= tourStep ? "bg-blue-500" : "bg-slate-700"
                  }`}
                />
              ))}
            </div>
            <Button variant="ghost" size="sm" className="text-slate-400 ml-4" onClick={markOnboardingComplete}>
              Skip
            </Button>
          </div>

          <Card className="bg-white/5 border-white/10 p-8">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-500/20 text-blue-400">
                {step.icon}
              </div>
              <div>
                <Badge className="bg-blue-600/60 mb-3">
                  {tourStep + 1} / {tourSteps.length}
                </Badge>
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
                  <Button variant="outline" className="text-slate-300 border-slate-600" onClick={() => setTourStep((s) => s - 1)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                )}
                {isLast ? (
                  <Button className="bg-green-600 hover:bg-green-700" onClick={markOnboardingComplete}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Get Started!
                  </Button>
                ) : (
                  <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setTourStep((s) => s + 1)}>
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
