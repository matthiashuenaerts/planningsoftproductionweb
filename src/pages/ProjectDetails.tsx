import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MoreVertical, Edit, Copy, Trash2, Plus, Loader2, CheckCircle, AlertTriangle } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { projectService } from '@/services/projectService';
import { taskService } from '@/services/taskService';
import { userService } from '@/services/userService';
import { Link } from "react-router-dom";
import { Project, ProjectPhase, Task } from '@/types/project';
import { format, parseISO } from 'date-fns';
import { Order } from '@/types/order';
import { orderService } from '@/services/orderService';
import OrderEditModal from '@/components/OrderEditModal';
import NewOrderModal from '@/components/NewOrderModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Progress } from "@/components/ui/progress"
import { useScreenshot } from 'use-react-screenshot'
import { useRef } from 'react';
import { saveAs } from 'file-saver';
import { generateProjectReport } from '@/lib/projectReportGenerator';
import { ProjectReportData } from '@/types/report';
import { useNavigate as useReactRouterNavigate } from 'react-router-dom';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { OverviewTab } from '@/components/project-details/OverviewTab';
import { TasksTab } from '@/components/project-details/TasksTab';
import { BudgetTab } from '@/components/project-details/BudgetTab';
import { FilesTab } from '@/components/project-details/FilesTab';
import { SettingsTab } from '@/components/project-details/SettingsTab';
import { AccessoriesTab } from '@/components/project-details/AccessoriesTab';
import { OrderWithDetails } from '@/types/order';
import { AccessoriesOrder } from '@/types/accessories';
import { accessoriesService } from '@/services/accessoriesService';
import { Accessory } from '@/services/accessoriesService';
import { InstallationDetails } from '@/components/project-details/InstallationDetails';

interface ProjectDetailsProps { }

const ProjectDetails: React.FC<ProjectDetailsProps> = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [installationDate, setInstallationDate] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [newOrderModalOpen, setNewOrderModalOpen] = useState(false);
  const [editOrderModal, setEditOrderModal] = useState<{ open: boolean; order: OrderWithDetails | null }>({ open: false, order: null });
  const [accessoriesOrders, setAccessoriesOrders] = useState<AccessoriesOrder[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [selectedAccessories, setSelectedAccessories] = useState<Accessory[]>([]);
  const [isAccessoriesOrderModalOpen, setIsAccessoriesOrderModalOpen] = useState(false);
  const [isBulkOrder, setIsBulkOrder] = useState(false);
  const [bulkOrderSupplier, setBulkOrderSupplier] = useState<string>('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isTimelineValid, setIsTimelineValid] = useState(true);
  const [timelineValidationMessage, setTimelineValidationMessage] = useState<string | null>(null);
  const [isTimelineCheckRunning, setIsTimelineCheckRunning] = useState(false);
  const [isInstallationDetailsModalOpen, setIsInstallationDetailsModalOpen] = useState(false);
  const routerNavigate = useReactRouterNavigate();
  const { toast } = useToast();
  const ref = useRef(null)
  const [image, takeScreenshot] = useScreenshot()
  const [isScreenshotLoading, setIsScreenshotLoading] = useState(false);

  const getImage = () => {
    setIsScreenshotLoading(true);
    takeScreenshot(ref.current)
      .then(() => setIsScreenshotLoading(false))
      .catch(() => setIsScreenshotLoading(false));
  }

  useEffect(() => {
    if (image) {
      saveAs(image, 'project-details.png');
    }
  }, [image]);

  const downloadProjectReport = async () => {
    if (!project) {
      toast({
        title: "Error",
        description: "Project details not loaded.",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingReport(true);
    try {
      const reportData: ProjectReportData = {
        project,
        tasks,
        orders,
        accessoriesOrders,
        installationDate
      };
      await generateProjectReport(reportData);
      toast({
        title: "Success",
        description: "Project report generated successfully."
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to generate project report: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const loadProject = useCallback(async () => {
    if (!projectId) {
      setError('Project ID is missing.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const projectData = await projectService.getById(projectId);
      setProject(projectData);
      setInstallationDate(projectData.installation_date || null);
    } catch (err: any) {
      setError(err.message || 'Failed to load project.');
      toast({
        title: "Error",
        description: `Failed to load project: ${err.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  const loadTasks = useCallback(async () => {
    if (!projectId) return;
    try {
      const tasksData = await taskService.getByProject(projectId);
      setTasks(tasksData);
    } catch (err: any) {
      toast({
        title: "Error",
        description: `Failed to load tasks: ${err.message}`,
        variant: "destructive"
      });
    }
  }, [projectId, toast]);

  const loadOrders = useCallback(async () => {
    if (!projectId) return;
    try {
      const ordersData = await orderService.getByProject(projectId);
      setOrders(ordersData);
    } catch (err: any) {
      toast({
        title: "Error",
        description: `Failed to load orders: ${err.message}`,
        variant: "destructive"
      });
    }
  }, [projectId, toast]);

  const loadAccessoriesOrders = useCallback(async () => {
    if (!projectId) return;
    try {
      const accessoriesOrdersData = await accessoriesService.getByProject(projectId);
      setAccessoriesOrders(accessoriesOrdersData);
    } catch (err: any) {
      toast({
        title: "Error",
        description: `Failed to load accessories orders: ${err.message}`,
        variant: "destructive"
      });
    }
  }, [projectId, toast]);

  const loadAccessories = useCallback(async () => {
    try {
      const accessoriesData = await accessoriesService.getAll();
      setAccessories(accessoriesData);
    } catch (err: any) {
      toast({
        title: "Error",
        description: `Failed to load accessories: ${err.message}`,
        variant: "destructive"
      });
    }
  }, [toast]);

  useEffect(() => {
    loadProject();
    loadTasks();
    loadOrders();
    loadAccessoriesOrders();
    loadAccessories();
  }, [loadProject, loadTasks, loadOrders, loadAccessoriesOrders, loadAccessories]);

  const handleProjectUpdate = async (updatedProject: Project) => {
    setProject(updatedProject);
  };

  const handleTaskUpdate = () => {
    loadTasks();
  };

  const handleOrderUpdate = () => {
    loadOrders();
  };

  const handleAccessoriesOrderUpdate = () => {
    loadAccessoriesOrders();
  };

  const handleInstallationDateUpdate = (newDate: string | null) => {
    setInstallationDate(newDate);
    if (project) {
      setProject({ ...project, installation_date: newDate });
    }
  };

  const handleDeleteProject = async () => {
    if (!projectId) {
      toast({
        title: "Error",
        description: "Project ID is missing.",
        variant: "destructive"
      });
      return;
    }

    try {
      await projectService.delete(projectId);
      toast({
        title: "Success",
        description: "Project deleted successfully."
      });
      navigate('/projects');
    } catch (err: any) {
      toast({
        title: "Error",
        description: `Failed to delete project: ${err.message}`,
        variant: "destructive"
      });
    } finally {
      setIsDeleteModalOpen(false);
    }
  };

  const handleDuplicateProject = async () => {
    if (!project) {
      toast({
        title: "Error",
        description: "Project details not loaded.",
        variant: "destructive"
      });
      return;
    }

    setIsDuplicating(true);
    try {
      // Remove id from the project object before duplicating
      const { id, ...projectWithoutId } = project;
      const duplicatedProject = await projectService.create(projectWithoutId);

      // Duplicate tasks
      for (const task of tasks) {
        const { id, ...taskWithoutId } = task;
        await taskService.create({ ...taskWithoutId, project_id: duplicatedProject.id });
      }

      // Duplicate orders
      for (const order of orders) {
        const { id, ...orderWithoutId } = order;
        const newOrder = await orderService.create({ ...orderWithoutId, project_id: duplicatedProject.id });

        // Duplicate order items
        const orderItems = await orderService.getOrderItems(order.id);
        for (const item of orderItems) {
          const { id, ...itemWithoutId } = item;
          await orderService.createOrderItem({ ...itemWithoutId, order_id: newOrder.id });
        }
      }

      toast({
        title: "Success",
        description: "Project duplicated successfully."
      });
      navigate(`/projects/${duplicatedProject.id}`);
    } catch (err: any) {
      toast({
        title: "Error",
        description: `Failed to duplicate project: ${err.message}`,
        variant: "destructive"
      });
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleCreateBulkAccessoriesOrder = async () => {
    if (!projectId) {
      toast({
        title: "Error",
        description: "Project ID is missing.",
        variant: "destructive"
      });
      return;
    }

    if (selectedAccessories.length === 0) {
      toast({
        title: "Warning",
        description: "No accessories selected.",
        variant: "warning"
      });
      return;
    }

    if (!bulkOrderSupplier) {
      toast({
        title: "Warning",
        description: "Please enter a supplier for the bulk order.",
        variant: "warning"
      });
      return;
    }

    try {
      // Create a new accessories order
      const accessoriesOrder = await accessoriesService.createAccessoriesOrder({
        project_id: projectId,
        order_date: new Date().toISOString(),
        supplier: bulkOrderSupplier,
        status: 'pending',
        notes: `Bulk order for accessories: ${selectedAccessories.map(a => a.article_name).join(', ')}`,
      });

      // Link selected accessories to the new order
      for (const accessory of selectedAccessories) {
        await accessoriesService.update(accessory.id, {
          accessories_order_id: accessoriesOrder.id,
          project_id: projectId,
          status: 'pending',
        });
      }

      toast({
        title: "Success",
        description: "Bulk accessories order created successfully."
      });
      setSelectedAccessories([]);
      setBulkOrderSupplier('');
      setIsAccessoriesOrderModalOpen(false);
      loadAccessoriesOrders();
    } catch (err: any) {
      toast({
        title: "Error",
        description: `Failed to create bulk accessories order: ${err.message}`,
        variant: "destructive"
      });
    }
  };

  const handleCreateAccessoriesOrder = async (accessories: Accessory[], supplier?: string) => {
    if (!projectId) {
      toast({
        title: "Error",
        description: "Project ID is missing.",
        variant: "destructive"
      });
      return;
    }

    if (accessories.length === 0) {
      toast({
        title: "Warning",
        description: "No accessories selected.",
        variant: "warning"
      });
      return;
    }

    try {
      // Create a new accessories order
      const accessoriesOrder = await accessoriesService.createAccessoriesOrder({
        project_id: projectId,
        order_date: new Date().toISOString(),
        supplier: supplier || 'Accessories Order',
        status: 'pending',
        notes: `Order for accessories: ${accessories.map(a => a.article_name).join(', ')}`,
      });

      // Link selected accessories to the new order
      for (const accessory of accessories) {
        await accessoriesService.update(accessory.id, {
          accessories_order_id: accessoriesOrder.id,
          project_id: projectId,
          status: 'pending',
          order_id: null, // remove direct link to order
        });
      }

      toast({
        title: "Success",
        description: "Accessories order created successfully."
      });
      loadAccessoriesOrders();
    } catch (err: any) {
      toast({
        title: "Error",
        description: `Failed to create accessories order: ${err.message}`,
        variant: "destructive"
      });
    }
  };

  const validateTimeline = async () => {
    if (!projectId) {
      toast({
        title: "Error",
        description: "Project ID is missing.",
        variant: "destructive"
      });
      return;
    }

    setIsTimelineCheckRunning(true);
    setIsTimelineValid(true);
    setTimelineValidationMessage(null);

    try {
      // Fetch all orders for the project
      const orders = await orderService.getByProject(projectId);

      // Validate each order
      for (const order of orders) {
        if (order.order_type === 'semi-finished') {
          // Fetch order steps
          const steps = await orderService.getOrderSteps(order.id);

          // Check if installation date is set
          if (!installationDate) {
            setIsTimelineValid(false);
            setTimelineValidationMessage("Warning: Project installation date is not set. Cannot validate delivery timeline.");
            return;
          }

          // Calculate the end date of the last step
          let endOfLastStep: Date | null = null;
          if (steps.length > 0) {
            // Sort steps by start date
            const sortedSteps = steps.sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
            const lastStep = sortedSteps[sortedSteps.length - 1];

            if (lastStep.start_date && lastStep.expected_duration_days) {
              const startDate = parseISO(lastStep.start_date);
              const duration = lastStep.expected_duration_days;
              endOfLastStep = new Date(startDate);
              endOfLastStep.setDate(startDate.getDate() + duration);
            }
          }

          if (endOfLastStep) {
            const deadline = new Date(parseISO(installationDate));
            deadline.setDate(deadline.getDate() - 5); // 5 days before installation

            if (endOfLastStep > deadline) {
              setIsTimelineValid(false);
              setTimelineValidationMessage(`Error: Order "${order.supplier}" is scheduled to finish on ${format(endOfLastStep, 'MMM dd, yyyy')}, which is less than 5 working days before the installation date (${format(parseISO(installationDate), 'MMM dd, yyyy')}).`);
              return;
            }
          }
        }
      }

      if (isTimelineValid) {
        setTimelineValidationMessage("All orders are on track with the project timeline.");
      }
    } catch (error: any) {
      setIsTimelineValid(false);
      setTimelineValidationMessage(`Error during timeline validation: ${error.message}`);
      toast({
        title: "Error",
        description: `Error during timeline validation: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsTimelineCheckRunning(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Loading project details...
    </div>;
  }

  if (!project) {
    return <div className="flex justify-center items-center h-screen text-red-500">
      Error: {error || 'Project not found.'}
    </div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-4 flex justify-between items-center">
        <CardTitle className="text-2xl font-bold">{project.name}</CardTitle>
        <div>
          <Button variant="outline" onClick={() => routerNavigate(-1)}>Back to Projects</Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="accessories">Accessories</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab project={project} onProjectUpdate={handleProjectUpdate} />
        </TabsContent>
        <TabsContent value="tasks">
          <TasksTab projectId={projectId} tasks={tasks} onTaskUpdate={handleTaskUpdate} />
        </TabsContent>
        <TabsContent value="budget">
          <BudgetTab project={project} onProjectUpdate={handleProjectUpdate} />
        </TabsContent>
        <TabsContent value="accessories">
          <AccessoriesTab
            projectId={projectId}
            accessories={accessories}
            accessoriesOrders={accessoriesOrders}
            onAccessoriesOrderUpdate={handleAccessoriesOrderUpdate}
            onCreateAccessoriesOrder={handleCreateAccessoriesOrder}
          />
        </TabsContent>
        <TabsContent value="orders">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <CardTitle>Orders</CardTitle>
              <div className="space-x-2">
                <Button onClick={() => setNewOrderModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Order
                </Button>
                <Button onClick={() => setIsAccessoriesOrderModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Order Accessories
                </Button>
              </div>
            </div>

            {orders.length === 0 ? (
              <Card className="w-full">
                <CardContent>
                  <p className="text-center text-gray-500">No orders found for this project.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {orders.map((order) => (
                  <Card key={order.id} className="bg-white shadow-md rounded-md overflow-hidden">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold">{order.supplier}</CardTitle>
                      <CardDescription>
                        Order Date: {format(parseISO(order.order_date), 'MMM dd, yyyy')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <p>
                          Status: <Badge variant="secondary">{order.status}</Badge>
                        </p>
                        <p>Expected Delivery: {format(parseISO(order.expected_delivery), 'MMM dd, yyyy')}</p>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="ml-auto flex h-8 w-8 p-0 data-[state=open]:bg-muted">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[160px]">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setEditOrderModal({ open: true, order: order as OrderWithDetails })}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="files">
          <FilesTab projectId={projectId} />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsTab project={project} onProjectUpdate={handleProjectUpdate} />
        </TabsContent>
      </Tabs>

      <Separator className="my-4" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Project Timeline</CardTitle>
            <CardDescription>Manage project timeline and key dates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InstallationDetails installationDate={installationDate} onInstallationDateUpdate={handleInstallationDateUpdate} />
            <Button variant="outline" onClick={validateTimeline} disabled={isTimelineCheckRunning}>
              {isTimelineCheckRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Validate Timeline
            </Button>
            {timelineValidationMessage && (
              <div className={`p-3 rounded-md ${isTimelineValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {isTimelineValid ? <CheckCircle className="mr-2 h-4 w-4 inline-block" /> : <AlertTriangle className="mr-2 h-4 w-4 inline-block" />}
                {timelineValidationMessage}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Manage project actions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="destructive" onClick={() => setIsDeleteModalOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Project
            </Button>
            <Button variant="secondary" onClick={handleDuplicateProject} disabled={isDuplicating}>
              {isDuplicating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Copy className="mr-2 h-4 w-4" />
              Duplicate Project
            </Button>
            <Button variant="secondary" onClick={downloadProjectReport} disabled={isGeneratingReport}>
              {isGeneratingReport && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Report
            </Button>
            <Button variant="secondary" onClick={getImage} disabled={isScreenshotLoading}>
              {isScreenshotLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Take Screenshot
            </Button>
          </CardContent>
        </Card>
      </div>

      <NewOrderModal
        open={newOrderModalOpen}
        onOpenChange={setNewOrderModalOpen}
        projectId={projectId}
        onSuccess={loadOrders}
        installationDate={installationDate || undefined}
      />

      {editOrderModal.open && editOrderModal.order && (
        <OrderEditModal
          open={editOrderModal.open}
          onOpenChange={(open) => setEditOrderModal(prev => ({ ...prev, open }))}
          orderId={editOrderModal.order.id}
          onSuccess={() => {
            setEditOrderModal({ open: false, order: null });
            loadOrders();
          }}
        />
      )}

      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the project and all related data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isAccessoriesOrderModalOpen} onOpenChange={setIsAccessoriesOrderModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Accessories Order</DialogTitle>
            <DialogDescription>
              Select accessories to order for this project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bulkOrder">
                <Input type="checkbox" id="bulkOrder" checked={isBulkOrder} onChange={(e) => setIsBulkOrder(e.target.checked)} className="mr-2" />
                Create a bulk order for multiple accessories
              </Label>
              {isBulkOrder && (
                <>
                  <Label htmlFor="supplier">Supplier</Label>
                  <Input id="supplier" value={bulkOrderSupplier} onChange={(e) => setBulkOrderSupplier(e.target.value)} placeholder="Supplier name" />
                </>
              )}
            </div>
            {!isBulkOrder && (
              <p className="text-sm text-muted-foreground">
                You can select accessories from the Accessories tab and create an order for them.
              </p>
            )}
            {isBulkOrder && (
              <div className="space-y-2">
                <Label>Select Accessories</Label>
                <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
                  {accessories.map((accessory) => (
                    <Label key={accessory.id} htmlFor={`accessory-${accessory.id}`} className="flex items-center space-x-2">
                      <Input
                        type="checkbox"
                        id={`accessory-${accessory.id}`}
                        checked={selectedAccessories.some(a => a.id === accessory.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAccessories([...selectedAccessories, accessory]);
                          } else {
                            setSelectedAccessories(selectedAccessories.filter(a => a.id !== accessory.id));
                          }
                        }}
                      />
                      <span>{accessory.article_name}</span>
                    </Label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="secondary" onClick={() => setIsAccessoriesOrderModalOpen(false)}>
              Cancel
            </Button>
            {isBulkOrder ? (
              <Button type="button" onClick={handleCreateBulkAccessoriesOrder} disabled={selectedAccessories.length === 0}>
                Create Bulk Order
              </Button>
            ) : (
              <Button type="button" onClick={() => {
                setIsAccessoriesOrderModalOpen(false);
                routerNavigate(`/projects/${projectId}/accessories`);
              }}>
                Go to Accessories
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectDetails;
