import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wrench, Monitor, Settings, Users, Calendar, Package, Zap, Timer, CheckCircle, Clock, AlertCircle, Factory, Cog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { taskService } from '@/services/dataService';
import { workstationService, Workstation } from '@/services/workstationService';
import { useAuth } from '@/context/AuthContext';
import WorkstationView from '@/components/WorkstationView';
import { useLanguage } from '@/context/LanguageContext';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'HOLD';
  priority: string;
  due_date: string;
  assignee_id: string;
  workstation: string;
  phase_id: string;
  duration: number;
  standard_task_id?: string;
  phases: {
    name: string;
    projects: {
      id: string;
      name: string;
      client: string;
    };
  };
}

const Workstations = () => {
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [activeWorkstation, setActiveWorkstation] = useState<Workstation | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { currentEmployee } = useAuth();
  const { t, createLocalizedPath } = useLanguage();

  useEffect(() => {
    const fetchWorkstations = async () => {
      setLoading(true);
      try {
        const data = await workstationService.getAll();
        setWorkstations(data);
        if (data.length > 0) {
          setActiveWorkstation(data[0]);
        }
      } catch (error) {
        console.error("Failed to fetch workstations:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkstations();
  }, []);

  useEffect(() => {
    const fetchTasks = async () => {
      if (activeWorkstation) {
        try {
          const tasksData = await taskService.getByWorkstation(activeWorkstation.name);
          setTasks(tasksData);
        } catch (error) {
          console.error("Failed to fetch tasks for workstation:", error);
          setTasks([]);
        }
      } else {
        setTasks([]);
      }
    };

    fetchTasks();
  }, [activeWorkstation]);

  const handleWorkstationChange = (workstation: Workstation) => {
    setActiveWorkstation(workstation);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
        <div className="ml-64 w-full p-6 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      <div className="ml-64 w-full p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex justify-between items-center">
            <h1 className="text-2xl font-bold">{t('workstations')}</h1>
            <Button onClick={() => navigate(createLocalizedPath('/schedules'))}>
              <Calendar className="mr-2 h-4 w-4" /> {t('view_schedule')}
            </Button>
          </div>

          <Tabs defaultValue={workstations.length > 0 ? workstations[0].id : "no-workstations"} className="space-y-4">
            <TabsList>
              {workstations.length > 0 ? (
                workstations.map((workstation) => (
                  <TabsTrigger 
                    key={workstation.id} 
                    value={workstation.id}
                    onClick={() => handleWorkstationChange(workstation)}
                  >
                    {workstation.name}
                  </TabsTrigger>
                ))
              ) : (
                <TabsTrigger value="no-workstations" disabled>{t('no_workstations_available')}</TabsTrigger>
              )}
            </TabsList>

            <Separator />

            {workstations.length > 0 ? (
              workstations.map((workstation) => (
                <TabsContent key={workstation.id} value={workstation.id}>
                  <WorkstationView workstation={workstation} tasks={tasks} />
                </TabsContent>
              ))
            ) : (
              <TabsContent value="no-workstations">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('no_workstations_title')}</CardTitle>
                    <CardDescription>{t('no_workstations_description')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p>{t('no_workstations_instructions')}</p>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Workstations;
