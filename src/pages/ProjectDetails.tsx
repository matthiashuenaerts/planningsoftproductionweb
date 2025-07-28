import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, ArrowLeft, Package, Trash2, Plus, Edit, Camera, Calendar, Users, FileText, Truck, Settings, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import Navbar from '@/components/Navbar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from 'react-router-dom';
import { orderService } from '@/services/orderService';
import { accessoriesService, Accessory } from '@/services/accessoriesService';
import OrderAttachmentUploader from '@/components/OrderAttachmentUploader';
import NewOrderModal from '@/components/NewOrderModal';
import OrderEditModal from '@/components/OrderEditModal';
import { DeliveryConfirmationModal } from '@/components/logistics/DeliveryConfirmationModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { projectService } from '@/services/dataService';
import { Project } from '@/services/dataService';
import ProjectFileManager from '@/components/ProjectFileManager';
import OneDriveIntegration from '@/components/OneDriveIntegration';

interface Order {
  id: string;
  project_id: string;
  supplier: string;
  order_date: string;
  expected_delivery: string;
  status: 'pending' | 'delivered' | 'canceled' | 'delayed';
  created_at: string;
  updated_at: string;
  order_type: 'standard' | 'semi-finished';
  orderItems?: OrderItem[];
  attachments?: OrderAttachment[];
  orderSteps?: OrderStep[];
}

interface OrderItem {
  id: string;
  order_id: string;
  description: string;
  quantity: number;
  article_code: string | null;
  unit_price: number | null;
  total_price: number | null;
  created_at: string;
  updated_at: string;
}

interface OrderAttachment {
  id: string;
  order_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
  updated_at: string;
}

interface OrderStep {
  id: string;
  order_id: string;
  step_number: number;
  name: string;
  supplier?: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  start_date?: string | null;
  expected_duration_days?: number | null;
  end_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

const ProjectDetails = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { createLocalizedPath } = useLanguage();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [orders, setOrders] = useState<Order[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showEditOrderModal, setShowEditOrderModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderForDelivery, setSelectedOrderForDelivery] = useState<Order | null>(null);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const { toast } = useToast();
  const { currentEmployee } = useAuth();

  const fetchProjectOrders = async () => {
    try {
      if (!projectId) return;

      // Fetch accessories for the project
      const accessoriesData = await accessoriesService.getByProject(projectId);
      setAccessories(accessoriesData);

      // Fetch orders for the specific project
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      
      if (ordersError) throw ordersError;

      // Fetch order items and attachments for each order
      const ordersWithDetails = await Promise.all(
        (ordersData || []).map(async (order) => {
          const { data: itemsData, error: itemsError } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', order.id);
          
          if (itemsError) {
            console.error('Error fetching order items:', itemsError);
          }

          // Fetch attachments
          const attachments = await orderService.getOrderAttachments(order.id);
          
          // Fetch order steps if it's a semi-finished product
          let orderSteps: OrderStep[] = [];
          if (order.order_type === 'semi-finished') {
            orderSteps = await orderService.getOrderSteps(order.id);
          }
          
          return { 
            ...order, 
            status: order.status as 'pending' | 'delivered' | 'canceled' | 'delayed',
            order_type: order.order_type as 'standard' | 'semi-finished',
            orderItems: itemsData || [],
            attachments: attachments || [],
            orderSteps: orderSteps,
          };
        })
      );

      setOrders(ordersWithDetails);
    } catch (error: any) {
      console.error('Error fetching project orders:', error);
      toast({
        title: 'Error',
        description: `Failed to load project orders: ${error.message}`,
        variant: 'destructive'
      });
    }
  };

  const handleAttachmentUpload = async () => {
    const updatedOrders = await Promise.all(
      orders.map(async (order) => {
        const attachments = await orderService.getOrderAttachments(order.id);
        return { ...order, attachments: attachments || [] };
      })
    );
    setOrders(updatedOrders);
  };

  const handleDeleteAttachment = async (attachmentId: string, orderId: string) => {
    try {
      await orderService.deleteOrderAttachment(attachmentId);
      
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId 
            ? { ...order, attachments: (order.attachments || []).filter(att => att.id !== attachmentId) }
            : order
        )
      );

      toast({
        title: "Success",
        description: "Attachment deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to delete attachment: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleDeleteOrder = async (orderId: string, deleteAccessories: boolean = false) => {
    try {
      if (deleteAccessories) {
        const { data: linkedAccessories } = await supabase
          .from('accessories')
          .select('id')
          .eq('order_id', orderId);
        
        if (linkedAccessories && linkedAccessories.length > 0) {
          for (const accessory of linkedAccessories) {
            await accessoriesService.delete(accessory.id);
          }
        }
      } else {
        await supabase
          .from('accessories')
          .update({ order_id: null, status: 'to_check' })
          .eq('order_id', orderId);
      }

      await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId);
        
      await supabase
        .from('order_steps')
        .delete()
        .eq('order_id', orderId);

      await supabase
        .from('order_attachments')
        .delete()
        .eq('order_id', orderId);

      await orderService.delete(orderId);

      toast({
        title: "Success",
        description: "Order deleted successfully",
      });

      fetchProjectOrders();
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to delete order: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleOrderSuccess = () => {
    fetchProjectOrders();
    setShowNewOrderModal(false);
  };

  const handleOrderEditSuccess = () => {
    fetchProjectOrders();
    setShowEditOrderModal(false);
    setSelectedOrderId(null);
  };

  const handleConfirmDelivery = (order: Order) => {
    setSelectedOrderForDelivery(order);
    setShowDeliveryModal(true);
  };

  const handleDeliveryConfirmed = () => {
    fetchProjectOrders();
    setShowDeliveryModal(false);
    setSelectedOrderForDelivery(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Pending</Badge>;
      case 'delivered':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Delivered</Badge>;
      case 'canceled':
        return <Badge className="bg-red-100 text-red-800 border-red-300">Canceled</Badge>;
      case 'delayed':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-300">Delayed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getStepStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-300">Pending</Badge>;
      case 'in_progress':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-300">In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Completed</Badge>;
      case 'delayed':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-300">Delayed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  useEffect(() => {
    if (activeTab === 'orders') {
      fetchProjectOrders();
    }
  }, [activeTab, projectId]);

  const fetchProject = async () => {
    try {
      setLoading(true);
      if (!projectId) {
        throw new Error('Project ID is required');
      }
      const projectData = await projectService.getById(projectId);
      setProject(projectData);
    } catch (error: any) {
      console.error('Error fetching project:', error);
      toast({
        title: 'Error',
        description: `Failed to load project: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
        <div className="ml-64 w-full flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
        <div className="ml-64 w-full flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Project not found</h1>
            <p className="text-gray-600 mt-2">The project you're looking for doesn't exist.</p>
          </div>
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
          <div className="mb-6">
            <Button 
              variant="outline" 
              onClick={() => navigate(createLocalizedPath('/projects'))}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
            </Button>
            
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
                <p className="text-gray-600 mt-2">{project.description}</p>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="onedrive">OneDrive</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Status</CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{project.status}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Installation Date</CardTitle>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {project.installation_date 
                        ? format(new Date(project.installation_date), 'MMM dd, yyyy')
                        : 'Not set'
                      }
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Customer</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{project.customer_name || 'Not specified'}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Project Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Address</p>
                      <p className="font-medium">{project.address || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Created</p>
                      <p className="font-medium">{format(new Date(project.created_at), 'MMM dd, yyyy')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="orders" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Orders</h2>
                <Button onClick={() => setShowNewOrderModal(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Order
                </Button>
              </div>

              <div className="space-y-4">
                {orders.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500">No orders found for this project.</p>
                      <Button onClick={() => setShowNewOrderModal(true)} className="mt-4">
                        <Plus className="mr-2 h-4 w-4" />
                        Create First Order
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {orders.map((order) => {
                      const isProcessingOnlyOrder = order.order_type === 'semi-finished' && (!order.orderItems || order.orderItems.length === 0) && order.orderSteps && order.orderSteps.length > 0;
                      
                      return (
                        <Card key={order.id} className="overflow-hidden">
                          <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-lg">{order.supplier}</CardTitle>
                                <CardDescription>
                                  {isProcessingOnlyOrder
                                    ? `Processing Order | Starts: ${format(new Date(order.expected_delivery), 'MMM dd, yyyy')}`
                                    : `Ordered: ${format(new Date(order.order_date), 'MMM dd, yyyy')} | Expected: ${format(new Date(order.expected_delivery), 'MMM dd, yyyy')}`
                                  }
                                </CardDescription>
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusBadge(order.status)}
                                {order.status === 'pending' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleConfirmDelivery(order)}
                                    className="text-green-600 hover:text-green-700"
                                  >
                                    <Camera className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedOrderId(order.id);
                                    setShowEditOrderModal(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Order</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This order has linked accessories. What would you like to do?
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteOrder(order.id, false)}
                                        className="bg-blue-600 hover:bg-blue-700"
                                      >
                                        Keep Accessories
                                      </AlertDialogAction>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteOrder(order.id, true)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Delete All
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {order.orderItems && order.orderItems.length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold mb-2">Order Items</h4>
                                <div className="border rounded-lg overflow-hidden">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="h-8 py-2 text-xs">Article Code</TableHead>
                                        <TableHead className="h-8 py-2 text-xs">Description</TableHead>
                                        <TableHead className="h-8 py-2 text-xs text-right">Quantity</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {order.orderItems.map((item) => (
                                        <TableRow key={item.id} className="h-8">
                                          <TableCell className="py-1 text-xs font-medium">
                                            {item.article_code || 'N/A'}
                                          </TableCell>
                                          <TableCell className="py-1 text-xs">{item.description}</TableCell>
                                          <TableCell className="py-1 text-xs text-right">{item.quantity}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}

                            {order.order_type === 'semi-finished' && order.orderSteps && order.orderSteps.length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold mb-2">Logistics Out</h4>
                                <div className="border rounded-lg overflow-hidden">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="h-8 py-2 text-xs">#</TableHead>
                                        <TableHead className="h-8 py-2 text-xs">Step</TableHead>
                                        <TableHead className="h-8 py-2 text-xs">Supplier</TableHead>
                                        <TableHead className="h-8 py-2 text-xs">Status</TableHead>
                                        <TableHead className="h-8 py-2 text-xs">Start</TableHead>
                                        <TableHead className="h-8 py-2 text-xs">End</TableHead>
                                        <TableHead className="h-8 py-2 text-xs text-center">Duration</TableHead>
                                        <TableHead className="h-8 py-2 text-xs">Notes</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {order.orderSteps.map((step) => (
                                        <TableRow key={step.id} className="h-8">
                                          <TableCell className="py-1 text-xs font-medium">{step.step_number}</TableCell>
                                          <TableCell className="py-1 text-xs">{step.name}</TableCell>
                                          <TableCell className="py-1 text-xs">{step.supplier || 'Internal'}</TableCell>
                                          <TableCell className="py-1 text-xs">{getStepStatusBadge(step.status)}</TableCell>
                                          <TableCell className="py-1 text-xs">{step.start_date ? format(new Date(step.start_date), 'MMM d, yy') : 'N/A'}</TableCell>
                                          <TableCell className="py-1 text-xs">{step.end_date ? format(new Date(step.end_date), 'MMM d, yy') : 'N/A'}</TableCell>
                                          <TableCell className="py-1 text-xs text-center">{step.expected_duration_days ? `${step.expected_duration_days}d` : '-'}</TableCell>
                                          <TableCell className="py-1 text-xs">{step.notes || '-'}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}

                            <div>
                              <div className="flex justify-between items-center mb-2">
                                <h4 className="text-sm font-semibold">Files</h4>
                                <OrderAttachmentUploader 
                                  orderId={order.id} 
                                  onUploadSuccess={handleAttachmentUpload}
                                  compact={true}
                                />
                              </div>
                              
                              {order.attachments && order.attachments.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {order.attachments.map((attachment) => (
                                    <div 
                                      key={attachment.id} 
                                      className="border rounded p-2 flex items-center justify-between bg-gray-50 text-xs"
                                    >
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{attachment.file_name}</p>
                                        <p className="text-muted-foreground">
                                          {(attachment.file_size / 1024).toFixed(1)} KB
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-1 ml-2">
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-6 w-12 text-xs"
                                          onClick={() => window.open(attachment.file_path, '_blank')}
                                        >
                                          View
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="sm"
                                          className="h-6 w-6 p-0"
                                          onClick={() => handleDeleteAttachment(attachment.id, order.id)}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">No files attached to this order.</p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="files" className="space-y-6">
              <ProjectFileManager projectId={projectId!} />
            </TabsContent>

            <TabsContent value="onedrive" className="space-y-6">
              <OneDriveIntegration projectId={projectId!} />
            </TabsContent>

            <TabsContent value="team" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Team Management</CardTitle>
                  <CardDescription>Manage team assignments for this project</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Team management functionality coming soon...</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Project Settings</CardTitle>
                  <CardDescription>Configure project-specific settings</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Project settings functionality coming soon...</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <NewOrderModal
        open={showNewOrderModal}
        onOpenChange={setShowNewOrderModal}
        projectId={projectId!}
        onSuccess={handleOrderSuccess}
        accessories={accessories}
        installationDate={project?.installation_date}
      />

      {selectedOrderId && (
        <OrderEditModal
          open={showEditOrderModal}
          onOpenChange={setShowEditOrderModal}
          orderId={selectedOrderId}
          onSuccess={handleOrderEditSuccess}
        />
      )}

      {selectedOrderForDelivery && (
        <DeliveryConfirmationModal
          order={selectedOrderForDelivery}
          isOpen={showDeliveryModal}
          onClose={() => {
            setShowDeliveryModal(false);
            setSelectedOrderForDelivery(null);
          }}
          onConfirmed={handleDeliveryConfirmed}
        />
      )}
    </div>
  );
};

export default ProjectDetails;
