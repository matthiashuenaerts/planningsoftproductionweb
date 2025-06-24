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
import { ArrowLeft, MoreVertical, Play, ListCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/context/LanguageContext';

// Define workstation with appropriate image mapping
interface WorkstationWithImage {
  id: string;
  name: string;
  description: string | null;
  image: string;
}

const Workstations: React.FC = () => {
  const [selectedWorkstation, setSelectedWorkstation] = useState<string | null>(null);
  const [workstations, setWorkstations] = useState<WorkstationWithImage[]>([]);
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

        // Map workstations to include images
        const workstationsWithImages = data.map(ws => {
          return {
            ...ws,
            image: getWorkstationImage(ws.name)
          };
        });
        setWorkstations(workstationsWithImages);
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

  // Function to get image based on workstation name
  const getWorkstationImage = (name: string) => {
    const lowercaseName = name.toLowerCase();
    
    // Factory/Manufacturing related images from Unsplash
    if (lowercaseName.includes('cnc') || lowercaseName.includes('machining')) {
      return 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=400&h=300&fit=crop';
    }
    if (lowercaseName.includes('assembly') || lowercaseName.includes('montage')) {
      return 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&h=300&fit=crop';
    }
    if (lowercaseName.includes('warehouse') || lowercaseName.includes('stock') || lowercaseName.includes('magazijn')) {
      return 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=300&fit=crop';
    }
    if (lowercaseName.includes('cutting') || lowercaseName.includes('snijden') || lowercaseName.includes('laser')) {
      return 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400&h=300&fit=crop';
    }
    if (lowercaseName.includes('quality') || lowercaseName.includes('kwaliteit') || lowercaseName.includes('inspection')) {
      return 'https://images.unsplash.com/photo-1582560475093-ba66accbc424?w=400&h=300&fit=crop';
    }
    if (lowercaseName.includes('packaging') || lowercaseName.includes('verpakking') || lowercaseName.includes('packing')) {
      return 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=300&fit=crop';
    }
    if (lowercaseName.includes('planning') || lowercaseName.includes('office') || lowercaseName.includes('kantoor')) {
      return 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=400&h=300&fit=crop';
    }
    if (lowercaseName.includes('production') || lowercaseName.includes('productie') || lowercaseName.includes('manufacturing')) {
      return 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=400&h=300&fit=crop';
    }
    if (lowercaseName.includes('welding') || lowercaseName.includes('lassen') || lowercaseName.includes('soldering')) {
      return 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400&h=300&fit=crop';
    }
    if (lowercaseName.includes('paint') || lowercaseName.includes('verf') || lowercaseName.includes('coating')) {
      return 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400&h=300&fit=crop';
    }

    // Default factory image
    return 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=400&h=300&fit=crop';
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
                    {workstations.map(workstation => <Card key={workstation.id} className="hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden">
                        <div className="absolute top-2 right-2 z-10">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 bg-white/80 backdrop-blur-sm" onClick={e => e.stopPropagation()}>
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
                        <div className="relative h-48 overflow-hidden">
                          <img
                            src={workstation.image}
                            alt={workstation.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback to default factory image if image fails to load
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=400&h=300&fit=crop';
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        </div>
                        <CardContent className="p-6 flex flex-col items-center text-center" onClick={() => setSelectedWorkstation(workstation.id)}>
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
