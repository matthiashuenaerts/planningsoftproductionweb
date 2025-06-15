import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import Navbar from '@/components/Navbar';
import WorkstationView from '@/components/WorkstationView';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { workstationService } from '@/services/workstationService';
import { workstationTasksService, WorkstationTask } from '@/services/workstationTasksService';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { ArrowLeft, Package, FileText, PackagePlus, Edit, ListCheck, PackageX, Calendar, ListOrdered, CalendarArrowDown, MoreVertical, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { useQueryClient } from '@tanstack/react-query';

// Define workstation with appropriate icon mapping
interface WorkstationWithIcon {
  id: string;
  name: string;
  description: string | null;
  icon: React.ReactNode;
}
const Workstations: React.FC = () => {
  const { id: workstationIdFromParams } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const selectedWorkstation = workstationIdFromParams || null;
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
          title: "Error",
          description: `Failed to load workstations: ${error.message}`,
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    loadWorkstations();
  }, [toast]);

  // Function to get icon based on workstation name
  const getWorkstationIcon = (name: string) => {
    const lowercaseName = name.toLowerCase();
    if (lowercaseName.includes('cnc')) return <FileText className="h-8 w-8" />;
    if (lowercaseName.includes('assembly')) return <Package className="h-8 w-8" />;
    if (lowercaseName.includes('warehouse')) return <PackagePlus className="h-8 w-8" />;
    if (lowercaseName.includes('cutting')) return <Edit className="h-8 w-8" />;
    if (lowercaseName.includes('quality')) return <ListCheck className="h-8 w-8" />;
    if (lowercaseName.includes('packaging')) return <PackageX className="h-8 w-8" />;
    if (lowercaseName.includes('planning')) return <Calendar className="h-8 w-8" />;
    if (lowercaseName.includes('production')) return <ListOrdered className="h-8 w-8" />;

    // Default icon
    return <CalendarArrowDown className="h-8 w-8" />;
  };
  const loadWorkstationTasks = async (workstationId: string) => {
    try {
      setLoadingTasks(true);
      const tasks = await workstationTasksService.getByWorkstation(workstationId);
      setWorkstationTasks(tasks);
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to load workstation tasks: ${error.message}`,
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
        title: "Workstation Task Started",
        description: `Started working on ${task.task_name}`
      });

      // Close the dialog after starting the task
      setShowWorkstationTasks(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to start task: ${error.message}`,
        variant: "destructive"
      });
    }
  };
  const getPriorityBadge = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return <Badge className="bg-red-100 text-red-800 border-red-300">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Medium</Badge>;
      case 'low':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Low</Badge>;
      default:
        return <Badge>{priority}</Badge>;
    }
  };
  const handleBack = () => {
    navigate('/workstations');
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
      <div className="ml-64 w-full p-6">
        <div className="max-w-7xl mx-auto">
          {selectedWorkstation ? <div>
              <Button variant="outline" className="mb-4" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Workstations
              </Button>
              <WorkstationView workstationId={selectedWorkstation} onBack={handleBack} />
            </div> : <div>
              <h1 className="text-2xl font-bold mb-6">Workstations</h1>
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
                            Workstation Tasks
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardContent className="p-6 flex flex-col items-center text-center" onClick={() => navigate(`/workstations/${workstation.id}`)}>
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

      {/* Workstation Tasks Dialog */}
      <Dialog open={!!showWorkstationTasks} onOpenChange={() => setShowWorkstationTasks(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Workstation Tasks - {selectedWorkstationForTasks?.name}
            </DialogTitle>
            <DialogDescription>
              Start tasks specific to this workstation
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {loadingTasks ? <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div> : workstationTasks.length === 0 ? <div className="text-center py-8">
                <ListCheck className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No workstation tasks available.</p>
                <p className="text-sm text-gray-400">Add tasks in the settings page.</p>
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
                            Start Task
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>)}
              </div>}
          </div>
        </DialogContent>
      </Dialog>
    </div>;
};
export default Workstations;
