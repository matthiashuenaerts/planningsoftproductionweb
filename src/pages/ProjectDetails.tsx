import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon, ArrowLeft, PlusCircle, Truck, Users, ListChecks, Package } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { format } from 'date-fns';
import { cn } from "@/lib/utils"
import { Project, Phase, Task } from '@/services/dataService';
import { projectService } from '@/services/projectService';
import { phaseService } from '@/services/phaseService';
import { taskService } from '@/services/dataService';
import { ProjectTeamAssignment, projectTeamAssignmentService } from '@/services/projectTeamAssignmentService';
import { ProjectTruckAssignment, projectTruckAssignmentService } from '@/services/projectTruckAssignmentService';
import { orderService } from '@/services/orderService';
import { useToast } from '@/hooks/use-toast';
import { ProjectTeamAssignmentsPopup } from '@/components/ProjectTeamAssignmentsPopup';
import { ProjectTruckAssignmentPopup } from '@/components/ProjectTruckAssignmentPopup';
import { OrderPopup } from '@/components/OrderPopup';
import { TaskPopup } from '@/components/TaskPopup';
import { PartsListDialog } from '@/components/PartsListDialog';

interface Order {
  id: string;
  project_id: string;
  supplier: string;
  order_date: string;
  expected_delivery: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const ProjectDetails: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamAssignments, setTeamAssignments] = useState<ProjectTeamAssignment[]>([]);
  const [truckAssignments, setTruckAssignments] = useState<ProjectTruckAssignment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showTeamPopup, setShowTeamPopup] = useState(false);
  const [showTruckPopup, setShowTruckPopup] = useState(false);
  const [showOrderPopup, setShowOrderPopup] = useState(false);
  const [showTaskPopup, setShowTaskPopup] = useState(false);
  const [showPartsListDialog, setShowPartsListDialog] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);

  const [date, setDate] = React.useState<Date | undefined>(new Date())

  const loadProjectData = async () => {
    if (!projectId) {
      setError('Project ID is missing.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Load project details
      const projectData = await projectService.getById(projectId);
      if (projectData) {
        setProject(projectData);
      } else {
        setError('Project not found.');
      }

      // Load phases for the project
      const phasesData = await phaseService.getByProject(projectId);
      setPhases(phasesData);

      // Load tasks for the project - use existing method from dataService
      const tasksData = await taskService.getAll();
      const projectTasks = tasksData.filter(task => task.phase_id && phasesData.some(phase => phase.id === task.phase_id));
      setTasks(projectTasks as Task[]);

      // Load team assignments for the project
      const teamAssignmentsData = await projectTeamAssignmentService.getByProject(projectId);
      setTeamAssignments(teamAssignmentsData);

      // Load truck assignments for the project
      const truckAssignmentsData = await projectTruckAssignmentService.getByProject(projectId);
      setTruckAssignments(truckAssignmentsData);

      // Load orders for the project
      const ordersData = await orderService.getByProject(projectId);
      setOrders(ordersData as Order[]);

    } catch (err: any) {
      console.error('Error loading project details:', err);
      setError(err.message || 'Failed to load project details.');
      toast({
        title: "Error",
        description: `Failed to load data: ${err.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjectData();
  }, [projectId]);

  if (loading) {
    return <div className="text-center">Loading project details...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center">{error}</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/projects')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Projects
        </Button>
        <h1 className="text-2xl font-bold">Project Details</h1>
      </div>

      {project && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Project Details */}
            <Card>
              <CardHeader>
                <CardTitle>Project Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Name</p>
                    <p>{project.name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Client</p>
                    <p>{project.client}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Start Date</p>
                    <p>{format(new Date(project.start_date), 'PPP')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Installation Date</p>
                    <p>{format(new Date(project.installation_date), 'PPP')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Status</p>
                    <Badge variant="secondary">{project.status}</Badge>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium">Description</p>
                  <p>{project.description || 'No description provided.'}</p>
                </div>
              </CardContent>
            </Card>

            {/* Phases */}
            <Card>
              <CardHeader className="flex justify-between">
                <CardTitle>Phases</CardTitle>
                <Button size="sm" onClick={() => setShowTaskPopup(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Task
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {phases.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {phases.map((phase) => (
                      <Card key={phase.id} className="shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">{phase.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1">
                          <p className="text-xs">Start Date: {format(new Date(phase.start_date), 'PPP')}</p>
                          <p className="text-xs">End Date: {format(new Date(phase.end_date), 'PPP')}</p>
                          <Badge variant="outline">Progress: {phase.progress}%</Badge>
                          <Button size="sm" variant="secondary" onClick={() => {
                            setShowTaskPopup(true);
                            setSelectedPhaseId(phase.id);
                          }}>
                            <ListChecks className="mr-2 h-4 w-4" />
                            Add Task
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500">No phases defined for this project.</p>
                )}
              </CardContent>
            </Card>

            {/* Tasks */}
            <Card>
              <CardHeader>
                <CardTitle>Tasks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {tasks.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tasks.map((task) => (
                      <Card key={task.id} className="shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">{task.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1">
                          <p className="text-xs">Due Date: {format(new Date(task.due_date), 'PPP')}</p>
                          <p className="text-xs">Workstation: {task.workstation}</p>
                          <Badge variant="outline">Priority: {task.priority}</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500">No tasks defined for this project.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Project Team */}
            <Card>
              <CardHeader className="flex justify-between">
                <CardTitle>Project Team</CardTitle>
                <Button size="sm" onClick={() => setShowTeamPopup(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Assign Team
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {teamAssignments.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {teamAssignments.map((assignment) => (
                      <Card key={assignment.id} className="shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">{assignment.team}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1">
                          <p className="text-xs">Start Date: {format(new Date(assignment.start_date), 'PPP')}</p>
                          <p className="text-xs">Duration: {assignment.duration} days</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500">No team members assigned to this project.</p>
                )}
              </CardContent>
            </Card>

            {/* Truck Assignment */}
            <Card>
              <CardHeader className="flex justify-between">
                <CardTitle>Truck Assignment</CardTitle>
                <Button size="sm" onClick={() => setShowTruckPopup(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Assign Truck
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {truckAssignments.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {truckAssignments.map((assignment) => (
                      <Card key={assignment.id} className="shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">Truck {assignment.truck_id}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1">
                          <p className="text-xs">Loading Date: {format(new Date(assignment.loading_date), 'PPP')}</p>
                          <p className="text-xs">Installation Date: {format(new Date(assignment.installation_date), 'PPP')}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500">No trucks assigned to this project.</p>
                )}
              </CardContent>
            </Card>

            {/* Orders */}
            <Card>
              <CardHeader className="flex justify-between">
                <CardTitle>Orders</CardTitle>
                <Button size="sm" onClick={() => setShowOrderPopup(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Order
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {orders.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {orders.map((order) => (
                      <Card key={order.id} className="shadow-sm">
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">Order {format(new Date(order.order_date), 'PPP')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1">
                          <p className="text-xs">Supplier: {order.supplier}</p>
                          <p className="text-xs">Expected Delivery: {format(new Date(order.expected_delivery), 'PPP')}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500">No orders placed for this project.</p>
                )}
              </CardContent>
            </Card>
            
            {/* Files and Parts Lists Card */}
            <Card>
              <CardHeader>
                <CardTitle>Files & Parts Lists</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setShowPartsListDialog(true)}
                >
                  <Package className="mr-2 h-4 w-4" />
                  Manage Parts Lists
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Popups */}
      <ProjectTeamAssignmentsPopup
        isOpen={showTeamPopup}
        onClose={() => setShowTeamPopup(false)}
        projectId={projectId!}
        onTeamAssigned={loadProjectData}
      />

      <ProjectTruckAssignmentPopup
        isOpen={showTruckPopup}
        onClose={() => setShowTruckPopup(false)}
        projectId={projectId!}
        onTruckAssigned={loadProjectData}
      />

      <OrderPopup
        isOpen={showOrderPopup}
        onClose={() => setShowOrderPopup(false)}
        projectId={projectId!}
        onOrderCreated={loadProjectData}
      />

      <TaskPopup
        isOpen={showTaskPopup}
        onClose={() => setShowTaskPopup(false)}
        projectId={projectId!}
        phaseId={selectedPhaseId}
        onTaskCreated={loadProjectData}
      />

      <PartsListDialog
        isOpen={showPartsListDialog}
        onClose={() => setShowPartsListDialog(false)}
        projectId={projectId!}
        tasks={tasks}
        onImportComplete={loadProjectData}
      />
    </div>
  );
};

export default ProjectDetails;
