import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Loader2, AlertTriangle, CheckCircle2, Clock, TrendingDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';
import { productionRouteService, ProductionRoute } from '@/services/productionRouteService';
import { standardTasksService, StandardTask } from '@/services/standardTasksService';
import { workstationService } from '@/services/workstationService';
import { automaticSchedulingService, ProjectCompletionInfo } from '@/services/automaticSchedulingService';
import { ProjectCompletionData } from '@/components/planning/ProductionCompletionTimeline';
import { supabase } from '@/integrations/supabase/client';

const formSchema = z.object({
  project_name: z.string().min(1, 'Required'),
  client: z.string().min(1, 'Required'),
  start_date: z.date(),
  installation_date: z.date(),
  project_value: z.number().min(1).max(100),
}).refine(
  (data) => data.installation_date >= data.start_date,
  { message: 'Installation date must be after start date', path: ['installation_date'] }
);

type FormValues = z.infer<typeof formSchema>;

interface SimulationResult {
  originalCompletions: ProjectCompletionInfo[];
  simulatedCompletions: ProjectCompletionInfo[];
  impactedProjects: {
    projectName: string;
    client: string;
    originalStatus: string;
    newStatus: string;
    originalDaysRemaining: number;
    newDaysRemaining: number;
    daysDifference: number;
  }[];
  newProjectCompletion: ProjectCompletionInfo | null;
  totalScheduleSlots: number;
}

interface TestRushProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCompletions: ProjectCompletionData[];
}

const TestRushProjectDialog: React.FC<TestRushProjectDialogProps> = ({
  open,
  onOpenChange,
  currentCompletions,
}) => {
  const { t } = useLanguage();
  const [routes, setRoutes] = useState<ProductionRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      project_name: 'TEST-PROJECT',
      client: 'Test Client',
      start_date: new Date(),
      installation_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      project_value: 50,
    },
  });

  useEffect(() => {
    if (open) {
      setSimulationResult(null);
      const fetchRoutes = async () => {
        setLoading(true);
        try {
          const routesData = await productionRouteService.getAll();
          setRoutes(routesData);
        } catch (e) {
          console.error('Error fetching routes:', e);
        } finally {
          setLoading(false);
        }
      };
      fetchRoutes();
    }
  }, [open]);

  const runSimulation = async (values: FormValues) => {
    setSimulating(true);
    setSimulationResult(null);

    try {
      // Step 1: Count existing projects to get the right count
      const { count, error: countError } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .in('status', ['planned', 'in_progress']);
      
      if (countError) throw countError;
      const projectCount = (count || 0) + 1; // +1 for the test project

      // Step 2: Create temporary project, phases, and tasks
      const { data: tempProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: values.project_name,
          client: values.client,
          start_date: format(values.start_date, 'yyyy-MM-dd'),
          installation_date: format(values.installation_date, 'yyyy-MM-dd'),
          status: 'planned',
          description: 'SIMULATION_TEST_PROJECT',
          progress: 0,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Step 3: Create phase for the test project
      const { data: tempPhase, error: phaseError } = await supabase
        .from('phases')
        .insert({
          project_id: tempProject.id,
          name: 'Production',
          start_date: format(values.start_date, 'yyyy-MM-dd'),
          end_date: format(values.installation_date, 'yyyy-MM-dd'),
          progress: 0,
        })
        .select()
        .single();

      if (phaseError) throw phaseError;

      // Step 4: Get tasks based on route or all standard tasks
      let standardTasks: StandardTask[] = [];
      if (selectedRouteId) {
        const routeTasks = await productionRouteService.getRouteTasks(selectedRouteId);
        const allStandardTasks = await standardTasksService.getAll();
        const routeTaskIds = new Set(routeTasks.map(rt => rt.standard_task_id));
        standardTasks = allStandardTasks.filter(st => routeTaskIds.has(st.id));
      } else {
        standardTasks = await standardTasksService.getAll();
      }

      // Step 5: Create tasks for the test project
      const projectValue = values.project_value;
      const taskInserts = [];

      for (const stdTask of standardTasks) {
        const duration = stdTask.time_coefficient 
          ? Math.round(stdTask.time_coefficient * projectValue)
          : 60;

        // Get workstation for task
        const links = await workstationService.getWorkstationsForStandardTask(stdTask.id);
        const workstationId = links?.[0]?.id || null;

        taskInserts.push({
          phase_id: tempPhase.id,
          title: `${stdTask.task_name} (${values.project_name})`,
          duration,
          status: 'TODO',
          priority: 'Medium',
          due_date: format(values.installation_date, 'yyyy-MM-dd'),
          standard_task_id: stdTask.id,
          workstation: links?.[0]?.name || '',
        });
      }

      if (taskInserts.length > 0) {
        const { data: createdTasks, error: tasksError } = await supabase
          .from('tasks')
          .insert(taskInserts)
          .select();

        if (tasksError) throw tasksError;

        // Create task_workstation_links
        if (createdTasks) {
          for (const task of createdTasks) {
            if (task.standard_task_id) {
              const links = await workstationService.getWorkstationsForStandardTask(task.standard_task_id);
              if (links && links.length > 0) {
                await supabase.from('task_workstation_links').insert(
                  links.map(l => ({ task_id: task.id, workstation_id: l.id }))
                );
              }
            }
          }
        }
      }

      // Step 6: Run the scheduling engine with the test project included
      const { completions: simulatedCompletions, lastProductionStepName } = 
        await automaticSchedulingService.generateSchedule(projectCount, new Date());

      // Step 7: Compare results with current completions
      const originalMap = new Map(
        currentCompletions.map(c => [c.projectId, c])
      );

      const impactedProjects = simulatedCompletions
        .filter(sim => sim.projectId !== tempProject.id)
        .map(sim => {
          const original = originalMap.get(sim.projectId);
          if (!original) return null;

          const daysDiff = (original.daysRemaining || 0) - (sim.daysRemaining || 0);
          
          // Only show if status changed or days shifted significantly
          if (original.status === sim.status && Math.abs(daysDiff) < 1) return null;

          return {
            projectName: sim.projectName,
            client: sim.client,
            originalStatus: original.status,
            newStatus: sim.status,
            originalDaysRemaining: Math.round(original.daysRemaining),
            newDaysRemaining: Math.round(sim.daysRemaining),
            daysDifference: Math.round(daysDiff),
          };
        })
        .filter(Boolean) as SimulationResult['impactedProjects'];

      const newProjectCompletion = simulatedCompletions.find(c => c.projectId === tempProject.id) || null;

      setSimulationResult({
        originalCompletions: currentCompletions,
        simulatedCompletions,
        impactedProjects,
        newProjectCompletion,
        totalScheduleSlots: simulatedCompletions.length,
      });

      // Step 8: Cleanup - remove the temporary project (cascades delete phases/tasks)
      await supabase.from('projects').delete().eq('id', tempProject.id);

      // Step 9: Restore original gantt_schedules by re-running without test project
      const { schedules: originalSchedules } = 
        await automaticSchedulingService.generateSchedule(count || 0, new Date());
      await automaticSchedulingService.saveSchedulesToDatabase(originalSchedules);

    } catch (error: any) {
      console.error('Simulation error:', error);
      // Cleanup: try to delete the test project if it exists
      try {
        await supabase.from('projects').delete().eq('description', 'SIMULATION_TEST_PROJECT');
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    } finally {
      setSimulating(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'on_track': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'at_risk': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'overdue': return <Clock className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'on_track': return <Badge className="bg-green-100 text-green-800">OK</Badge>;
      case 'at_risk': return <Badge className="bg-yellow-100 text-yellow-800">{t('timeline_at_risk')}</Badge>;
      case 'overdue': return <Badge className="bg-red-100 text-red-800">{t('timeline_overdue')}</Badge>;
      default: return <Badge variant="secondary">?</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            {t('timeline_test_project')}
          </DialogTitle>
          <DialogDescription>
            {t('timeline_test_project_desc')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 p-1">
            {/* Form */}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(runSimulation)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="project_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('timeline_project_name')}</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="client"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('timeline_client')}</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="start_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>{t('timeline_start_date')}</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                {field.value ? format(field.value, 'PPP') : t('timeline_pick_date')}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} weekStartsOn={1} />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="installation_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>{t('timeline_end_date')}</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button variant="outline" className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                {field.value ? format(field.value, 'PPP') : t('timeline_pick_date')}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} weekStartsOn={1} />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Route selection */}
                <div>
                  <FormLabel>{t('timeline_route')}</FormLabel>
                  <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('timeline_select_route')} />
                    </SelectTrigger>
                    <SelectContent>
                      {routes.map(route => (
                        <SelectItem key={route.id} value={route.id}>{route.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Complexity factor */}
                <FormField
                  control={form.control}
                  name="project_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('timeline_complexity_factor')}: {field.value}</FormLabel>
                      <FormControl>
                        <Slider
                          min={1}
                          max={100}
                          step={1}
                          value={[field.value]}
                          onValueChange={(val) => field.onChange(val[0])}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={simulating || !selectedRouteId} className="w-full">
                  {simulating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('timeline_simulating')}
                    </>
                  ) : (
                    t('timeline_run_simulation')
                  )}
                </Button>
              </form>
            </Form>

            {/* Results */}
            {simulationResult && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-lg">{t('timeline_simulation_results')}</h3>

                {/* New project status */}
                {simulationResult.newProjectCompletion && (
                  <div className="p-3 rounded-lg border bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{simulationResult.newProjectCompletion.projectName}</span>
                        <span className="text-sm text-muted-foreground ml-2">({t('timeline_new_project')})</span>
                      </div>
                      {getStatusBadge(simulationResult.newProjectCompletion.status)}
                    </div>
                    {simulationResult.newProjectCompletion.lastProductionStepEnd && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {t('timeline_production_ready')}: {format(simulationResult.newProjectCompletion.lastProductionStepEnd, 'dd/MM/yyyy HH:mm')}
                      </p>
                    )}
                  </div>
                )}

                {/* Impacted projects */}
                {simulationResult.impactedProjects.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      {t('timeline_impacted_projects')} ({simulationResult.impactedProjects.length})
                    </h4>
                    {simulationResult.impactedProjects.map((project, idx) => (
                      <div key={idx} className="p-3 rounded-lg border text-sm space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{project.projectName}</span>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(project.originalStatus)}
                            <span>→</span>
                            {getStatusBadge(project.newStatus)}
                          </div>
                        </div>
                        <div className="text-muted-foreground">
                          {t('timeline_client')}: {project.client}
                        </div>
                        {project.daysDifference !== 0 && (
                          <div className={cn(
                            "font-medium",
                            project.daysDifference > 0 ? "text-red-600" : "text-green-600"
                          )}>
                            {project.daysDifference > 0 
                              ? `${t('timeline_days_later').replace('{{days}}', String(project.daysDifference))}`
                              : `${Math.abs(project.daysDifference)} ${t('timeline_days_earlier')}`
                            }
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg border bg-green-50 text-green-800 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {t('timeline_no_impact')}
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('close') || 'Sluiten'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TestRushProjectDialog;
