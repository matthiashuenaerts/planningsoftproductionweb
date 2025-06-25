import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import Navbar from '@/components/Navbar';
import WorkstationView from '@/components/WorkstationView';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { workstationService } from '@/services/workstationService';
import { workstationTasksService, WorkstationTask } from '@/services/workstationTasksService';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { ArrowLeft, Package, FileText, PackagePlus, Edit, ListCheck, PackageX, Calendar, ListOrdered, CalendarArrowDown, MoreVertical, Play, Wrench, Cog, Factory, Truck, Hammer, Scissors, Drill, Package2, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/context/LanguageContext';

// Define workstation with appropriate icon mapping
interface WorkstationWithIcon {
  id: string;
  name: string;
  description: string | null;
  icon: React.ReactNode;
}
const Workstations: React.FC = () => {
  const [selectedWorkstation, setSelectedWorkstation] = useState<string | null>(null);
  const [workstations, setWorkstations] = useState<WorkstationWithIcon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWorkstationTasks, setShowWorkstationTasks] = useState<string | null>(null);
  const [workstationTasks, setWorkstationTasks] = useState<WorkstationTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const {
    toast
  } = useToast();
  const {
    currentEmployee
  } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  useEffect(() => {
    const loadWorkstations = async () => {
      try {
        const data = await workstationService.getAll();

        // Map workstations to include icons
        const workstationsWithIcons = data.map(ws => {
          return {
            ...ws,
            icon: getWorkstationIcon(ws.name)
          };
        });
        setWorkstations(workstationsWithIcons);
      } catch (error: any) {
        toast({
          title: t('error'),
          description: t('failed_to_load_workstations', { message: error.message }),
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    loadWorkstations();
  }, [toast, t]);

  // Function to get icon based on workstation name (Dutch names)
  const getWorkstationIcon = (name: string) => {
    const lowercaseName = name.toLowerCase();
    
    // Dutch workstation names mapping
    if (lowercaseName.includes('cnc') || lowercaseName.includes('numeriek')) return <Cog className="h-8 w-8" />;
    if (lowercaseName.includes('montage') || lowercaseName.includes('assemblage')) return <Wrench className="h-8 w-8" />;
    if (lowercaseName.includes('magazijn') || lowercaseName.includes('opslag')) return <Package2 className="h-8 w-8" />;
    if (lowercaseName.includes('snij') || lowercaseName.includes('zaag')) return <Scissors className="h-8 w-8" />;
    if (lowercaseName.includes('kwaliteit') || lowercaseName.includes('controle')) return <ListCheck className="h-8 w-8" />;
    if (lowercaseName.includes('verpakking') || lowercaseName.includes('inpak')) return <PackageX className="h-8 w-8" />;
    if (lowercaseName.includes('planning') || lowercaseName.includes('schema')) return <Calendar className="h-8 w-8" />;
    if (lowercaseName.includes('productie') || lowercaseName.includes('fabricage')) return <Factory className="h-8 w-8" />;
    if (lowercaseName.includes('boor') || lowercaseName.includes('drill')) return <Drill className="h-8 w-8" />;
    if (lowercaseName.includes('zaag') || lowercaseName.includes('snij')) return <Scissors className="h-8 w-8" />;
    if (lowercaseName.includes('las') || lowercaseName.includes('weld')) return <Zap className="h-8 w-8" />;
    if (lowercaseName.includes('transport') || lowercaseName.includes('verzend')) return <Truck className="h-8 w-8" />;
    if (lowercaseName.includes('hamer') || lowercaseName.includes('smeed')) return <Hammer className="h-8 w-8" />;
    if (lowercaseName.includes('bewerk') || lowercaseName.includes('machin')) return <Cog className="h-8 w-8" />;
    
    // Default icon for unmatched workstations
    return <Factory className="h-8 w-8" />;
  };
  const loadWorkstationTasks = async (workstationId: string) => {
    try {
      setLoadingTasks(true);
      const tasks = await workstationTasksService.getByWorkstation(workstationId);
      setWorkstationTasks(tasks);
    } catch (error: any) {
      toast({
        title: t('error'),
        description: t('failed_to_load_workstation_tasks', { message: error.message }),
        variant: "destructive"
      });
    } finally {
      setLoadingTasks(false);
    }
  };
  const handleShowWorkstationTasks = (workstationId: string) => {
    setShowWorkstationTasks(workstationId);
    loadWorkstationTasks(workstationId);
  };
  const handleStartWorkstationTask = async (task: WorkstationTask) => {
    if (!currentEmployee) return;
    try {
      // Start time registration for workstation task using the new method
      await timeRegistrationService.startWorkstationTask(currentEmployee.id, task.id);

      // Invalidate queries to refresh the TaskTimer
      queryClient.invalidateQueries({
        queryKey: ['activeTimeRegistration']
      });
      toast({
        title: t('workstation_task_started'),
        description: t('workstation_task_started_desc', { taskName: task.task_name })
      });

      // Close the dialog after starting the task
      setShowWorkstationTasks(null);
    } catch (error: any) {
      toast({
        title: t('error'),
        description: t('failed_to_start_task', { message: error.message }),
        variant: "destructive"
      });
    }
  };
  const getPriorityBadge = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return <Badge className="bg-red-100 text-red-800 border-red-300">{t('priority_high_label')}</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">{t('priority_medium_label')}</Badge>;
      case 'low':
        return <Badge className="bg-green-100 text-green-800 border-green-300">{t('priority_low_label')}</Badge>;
      default:
        return <Badge>{priority}</Badge>;
    }
  };
  if (loading) {
    return <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
        <div className="ml-64 w-full p-6 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </div>;
  }
  const selectedWorkstationForTasks = workstations.find(ws => ws.id === showWorkstationTasks);
  return <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      <div className="ml-64 w-full">
        <ScrollArea className="h-screen">
          <div className="p-6">
            <div className="max-w-7xl mx-auto">
              {selectedWorkstation ? <div>
                  <Button variant="outline" className="mb-4" onClick={() => setSelectedWorkstation(null)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> {t('back_to_workstations')}
                  </Button>
                  <WorkstationView workstationId={selectedWorkstation} onBack={() => setSelectedWorkstation(null)} />
                </div> : <div>
                  <h1 className="text-2xl font-bold mb-6">{t('workstations_title')}</h1>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {workstations.map(workstation => <Card key={workstation.id} className="hover:shadow-md transition-shadow cursor-pointer relative">
                        <div className="absolute top-2 right-2 z-10">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => e.stopPropagation()}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={e => {
                        e.stopPropagation();
                        handleShowWorkstationTasks(workstation.id);
                      }}>
                                <ListCheck className="mr-2 h-4 w-4" />
                                {t('workstation_tasks')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <CardContent className="p-6 flex flex-col items-center text-center" onClick={() => setSelectedWorkstation(workstation.id)}>
                          <div className="bg-primary/10 p-4 rounded-full mb-4">
                            {workstation.icon}
                          </div>
                          <h3 className="text-lg font-medium mb-1">{workstation.name}</h3>
                          {workstation.description && <p className="text-sm text-muted-foreground">{workstation.description}</p>}
                        </CardContent>
                      </Card>)}
                  </div>
                </div>}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Workstation Tasks Dialog */}
      <Dialog open={!!showWorkstationTasks} onOpenChange={() => setShowWorkstationTasks(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {t('workstation_tasks_for', { name: selectedWorkstationForTasks?.name })}
            </DialogTitle>
            <DialogDescription>
              {t('workstation_tasks_desc')}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              {loadingTasks ? <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div> : workstationTasks.length === 0 ? <div className="text-center py-8">
                  <ListCheck className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">{t('no_workstation_tasks')}</p>
                  <p className="text-sm text-gray-400">{t('add_tasks_in_settings')}</p>
                </div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {workstationTasks.map(task => <Card key={task.id} className="h-fit">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div>
                            <h3 className="font-medium text-lg">{selectedWorkstationForTasks?.name}</h3>
                            <p className="text-slate-950 text-xl font-bold">{task.task_name}</p>
                          </div>
                          
                          <div className="flex flex-wrap gap-2">
                            {getPriorityBadge(task.priority)}
                            {task.duration && <Badge variant="outline">{task.duration}h</Badge>}
                          </div>

                          {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}

                          <div className="flex gap-2 pt-2 border-t">
                            <Button size="sm" onClick={() => handleStartWorkstationTask(task)} className="flex-1">
                              <Play className="h-4 w-4 mr-1" />
                              {t('start_task')}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>)}
                </div>}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>;
};
export default Workstations;
