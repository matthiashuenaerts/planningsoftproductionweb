
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  FileText,
  Paperclip,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { orderService } from '@/services/orderService';
import { projectService } from '@/services/dataService';
import { Order, OrderItem, OrderAttachment } from '@/types/order';
import NewOrderModal from '@/components/NewOrderModal';
import OrderAttachmentUploader from '@/components/OrderAttachmentUploader';

const ProjectOrders: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [project, setProject] = useState<any>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [orderAttachments, setOrderAttachments] = useState<Record<string, OrderAttachment[]>>({});
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  
  useEffect(() => {
    if (!projectId) {
      navigate('/projects');
      return;
    }
    
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Get project details
        const projectData = await projectService.getById(projectId);
        if (!projectData) {
          throw new Error("Project not found");
        }
        setProject(projectData);
        
        // Get all orders for this project
        const ordersData = await orderService.getByProject(projectId);
        setOrders(ordersData);
      } catch (error: any) {
        console.error("Error loading project orders:", error);
        toast({
          title: "Error",
          description: `Failed to load project data: ${error.message}`,
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [projectId, navigate, toast]);
  
  const toggleOrderExpansion = async (orderId: string) => {
    // Close if already open
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
      return;
    }
    
    // Open and load order items if they haven't been loaded yet
    setExpandedOrder(orderId);
    
    if (!orderItems[orderId]) {
      try {
        const items = await orderService.getOrderItems(orderId);
        setOrderItems(prev => ({
          ...prev,
          [orderId]: items
        }));
        
        // Also load attachments
        await loadOrderAttachments(orderId);
      } catch (error: any) {
        toast({
          title: "Error",
          description: `Failed to load order details: ${error.message}`,
          variant: "destructive"
        });
      }
    }
  };
  
  const loadOrderAttachments = async (orderId: string) => {
    try {
      const attachments = await orderService.getOrderAttachments(orderId);
      setOrderAttachments(prev => ({
        ...prev,
        [orderId]: attachments
      }));
    } catch (error: any) {
      console.error("Error loading attachments:", error);
    }
  };
  
  const handleDeleteAttachment = async (attachmentId: string, orderId: string) => {
    try {
      await orderService.deleteOrderAttachment(attachmentId);
      
      // Update the UI by removing the deleted attachment
      setOrderAttachments(prev => ({
        ...prev,
        [orderId]: prev[orderId].filter(att => att.id !== attachmentId)
      }));
      
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
  
  const handleDeleteOrder = async (orderId: string) => {
    if (window.confirm("Are you sure you want to delete this order? This action cannot be undone.")) {
      try {
        await orderService.deleteOrder(orderId);
        
        // Update UI
        setOrders(prev => prev.filter(order => order.id !== orderId));
        setExpandedOrder(null);
        
        toast({
          title: "Success",
          description: "Order deleted successfully",
        });
      } catch (error: any) {
        toast({
          title: "Error",
          description: `Failed to delete order: ${error.message}`,
          variant: "destructive"
        });
      }
    }
  };
  
  const handleAttachmentUploadSuccess = async (orderId: string) => {
    await loadOrderAttachments(orderId);
    toast({
      title: "Success",
      description: "Attachment uploaded successfully",
    });
  };
  
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (error) {
      return 'Invalid date';
    }
  };
  
  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">Pending</Badge>;
      case 'delivered':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Delivered</Badge>;
      case 'canceled':
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Canceled</Badge>;
      case 'delayed':
        return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">Delayed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold mb-1">{project?.name} - Orders</h1>
              <p className="text-muted-foreground">{project?.client}</p>
            </div>
            <div className="mt-4 sm:mt-0">
              <Button 
                onClick={() => setShowNewOrderModal(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Order
              </Button>
              <Button
                variant="outline"
                className="ml-2"
                onClick={() => navigate(`/projects/${projectId}`)}
              >
                Back to Project
              </Button>
            </div>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Project Orders</span>
                <span className="text-sm font-normal">
                  {orders.length} {orders.length === 1 ? 'order' : 'orders'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Order Date</TableHead>
                        <TableHead>Expected Delivery</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <React.Fragment key={order.id}>
                          <TableRow className="cursor-pointer hover:bg-muted/50">
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => toggleOrderExpansion(order.id)}
                                className="h-8 w-8"
                              >
                                {expandedOrder === order.id ? 
                                  <ChevronUp className="h-4 w-4" /> : 
                                  <ChevronDown className="h-4 w-4" />
                                }
                              </Button>
                            </TableCell>
                            <TableCell 
                              className="font-medium"
                              onClick={() => toggleOrderExpansion(order.id)}
                            >
                              {order.supplier}
                            </TableCell>
                            <TableCell onClick={() => toggleOrderExpansion(order.id)}>
                              {formatDate(order.order_date)}
                            </TableCell>
                            <TableCell onClick={() => toggleOrderExpansion(order.id)}>
                              {formatDate(order.expected_delivery)}
                            </TableCell>
                            <TableCell onClick={() => toggleOrderExpansion(order.id)}>
                              {getStatusBadge(order.status)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteOrder(order.id)}
                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-100"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                          
                          {expandedOrder === order.id && (
                            <TableRow>
                              <TableCell colSpan={6} className="p-0">
                                <div className="bg-muted/30 p-4">
                                  <div className="mb-4">
                                    <h4 className="font-medium mb-2">Order Items</h4>
                                    {!orderItems[order.id] ? (
                                      <div className="flex justify-center p-4">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                                      </div>
                                    ) : orderItems[order.id].length === 0 ? (
                                      <p className="text-sm text-muted-foreground">No items in this order.</p>
                                    ) : (
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right">Quantity</TableHead>
                                            <TableHead className="text-right">Unit Price</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {orderItems[order.id].map((item) => (
                                            <TableRow key={item.id}>
                                              <TableCell>{item.description}</TableCell>
                                              <TableCell className="text-right">{item.quantity}</TableCell>
                                              <TableCell className="text-right">€{item.unit_price.toFixed(2)}</TableCell>
                                              <TableCell className="text-right">€{item.total_price.toFixed(2)}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    )}
                                  </div>
                                  
                                  <div className="mt-4">
                                    <div className="flex justify-between items-center mb-2">
                                      <h4 className="font-medium">Attachments</h4>
                                      <OrderAttachmentUploader 
                                        orderId={order.id}
                                        onUploadSuccess={() => handleAttachmentUploadSuccess(order.id)}
                                      />
                                    </div>
                                    {!orderAttachments[order.id] ? (
                                      <div className="flex justify-center p-4">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                                      </div>
                                    ) : orderAttachments[order.id]?.length === 0 ? (
                                      <p className="text-sm text-muted-foreground">No attachments for this order.</p>
                                    ) : (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {orderAttachments[order.id].map((attachment) => (
                                          <div 
                                            key={attachment.id}
                                            className="flex items-center justify-between p-2 bg-background rounded border"
                                          >
                                            <div className="flex items-center gap-2 truncate">
                                              <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                                              <span className="truncate">{attachment.file_name}</span>
                                            </div>
                                            <div className="flex space-x-1">
                                              <Button 
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => window.open(attachment.file_path, '_blank')}
                                                title="View file"
                                              >
                                                <FileText className="h-4 w-4" />
                                              </Button>
                                              <Button 
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-100"
                                                onClick={() => handleDeleteAttachment(attachment.id, order.id)}
                                                title="Delete file"
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-6 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <p className="text-muted-foreground">No orders found for this project.</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setShowNewOrderModal(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Order
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      <NewOrderModal
        open={showNewOrderModal}
        onOpenChange={setShowNewOrderModal}
        projectId={projectId || ''}
        onSuccess={() => {
          // Refresh order list
          orderService.getByProject(projectId || '').then((data) => setOrders(data));
        }}
      />
    </div>
  );
};

export default ProjectOrders;
