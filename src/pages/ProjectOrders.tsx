import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, ArrowLeft, Package, Trash2, Plus, Edit } from 'lucide-react';
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

const ProjectOrders = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showEditOrderModal, setShowEditOrderModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const { toast } = useToast();
  const { currentEmployee } = useAuth();

  useEffect(() => {
    fetchProjectOrders();
  }, [projectId]);

  const fetchProjectOrders = async () => {
    try {
      setLoading(true);
      
      if (!projectId) {
        throw new Error('Project ID is required');
      }

      const projectData = await projectService.getById(projectId);
      setProject(projectData);

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
    } finally {
      setLoading(false);
    }
  };

  const handleAttachmentUpload = async () => {
    // Refresh orders to show new attachments
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
      
      // Update the order's attachments in state
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
      // If deleteAccessories is true, delete linked accessories
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
        // Just unlink accessories from the order
        await supabase
          .from('accessories')
          .update({ order_id: null, status: 'to_check' })
          .eq('order_id', orderId);
      }

      // Delete order items
      await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId);

      // Delete order attachments
      await supabase
        .from('order_attachments')
        .delete()
        .eq('order_id', orderId);

      // Delete the order
      await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

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
              onClick={() => navigate(`/projects/${projectId}`)}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Project
            </Button>
            
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Package className="h-6 w-6" />
                <h1 className="text-3xl font-bold">Project Orders</h1>
              </div>
              <Button onClick={() => setShowNewOrderModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Order
              </Button>
            </div>
            <p className="text-slate-600">Orders for this project</p>
          </div>

          <div className="space-y-6">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : orders.length === 0 ? (
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
                        {/* Order Items */}
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

                        {/* Order Steps for semi-finished products */}
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

                        {/* Order Attachments */}
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
                  ))}
                </div>
              </div>
            )}
          </div>
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
    </div>
  );
};

export default ProjectOrders;
