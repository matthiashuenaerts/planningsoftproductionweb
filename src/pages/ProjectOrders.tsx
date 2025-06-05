import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { projectService, Project } from '@/services/dataService';
import { orderService } from '@/services/orderService';
import { Order, OrderItem } from '@/types/order';
import { Plus, ArrowLeft, MoreVertical, Trash2, Package, ChevronDown, ChevronRight } from 'lucide-react';
import NewOrderModal from '@/components/NewOrderModal';
import OrderAttachmentUploader from '@/components/OrderAttachmentUploader';

const ProjectOrders = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentEmployee } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);

  const isAdmin = currentEmployee?.role === 'admin';

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const [projectData, ordersData] = await Promise.all([
        projectService.getById(id),
        orderService.getByProjectId(id)
      ]);
      
      setProject(projectData);
      setOrders(ordersData);
      
      // Load order items for each order
      const itemsData: Record<string, OrderItem[]> = {};
      for (const order of ordersData) {
        try {
          const items = await orderService.getOrderItems(order.id);
          itemsData[order.id] = items;
        } catch (error) {
          console.error(`Failed to load items for order ${order.id}:`, error);
          itemsData[order.id] = [];
        }
      }
      setOrderItems(itemsData);
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to load project orders: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'canceled': return 'bg-red-100 text-red-800';
      case 'delayed': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      await orderService.updateStatus(orderId, newStatus as any);
      toast({
        title: "Success",
        description: "Order status updated successfully"
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to update order status: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;
    
    try {
      await orderService.deleteOrder(orderToDelete);
      toast({
        title: "Success",
        description: "Order deleted successfully"
      });
      setOrders(prev => prev.filter(o => o.id !== orderToDelete));
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to delete order: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setOrderToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
        <div className="ml-64 flex-1 p-6 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      
      <div className="ml-64 flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate(`/projects/${id}`)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Project
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Project Orders</h1>
              {project && (
                <p className="text-muted-foreground mt-1">
                  {project.name} - {project.client}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              <span className="font-medium">{orders.length} Orders</span>
            </div>
            
            {isAdmin && (
              <Button onClick={() => setIsNewOrderModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Order
              </Button>
            )}
          </div>

          {orders.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Package className="mx-auto h-16 w-16 text-gray-400" />
                <h3 className="mt-4 text-lg font-medium">No orders found</h3>
                <p className="mt-2 text-gray-600">
                  This project doesn't have any orders yet.
                </p>
                {isAdmin && (
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setIsNewOrderModalOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Order
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Orders</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Order Date</TableHead>
                      <TableHead>Expected Delivery</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Items</TableHead>
                      {isAdmin && <TableHead className="w-16">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <React.Fragment key={order.id}>
                        <TableRow>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleOrderExpansion(order.id)}
                            >
                              {expandedOrders[order.id] ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium">{order.supplier}</TableCell>
                          <TableCell>
                            {new Date(order.order_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {new Date(order.expected_delivery).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {isAdmin ? (
                              <Select 
                                value={order.status} 
                                onValueChange={(value) => handleStatusUpdate(order.id, value)}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="delivered">Delivered</SelectItem>
                                  <SelectItem value="canceled">Canceled</SelectItem>
                                  <SelectItem value="delayed">Delayed</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge className={getStatusColor(order.status)} variant="secondary">
                                {order.status}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {orderItems[order.id]?.length || 0} items
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem 
                                    className="text-red-600"
                                    onClick={() => setOrderToDelete(order.id)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Order
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          )}
                        </TableRow>
                        
                        {expandedOrders[order.id] && orderItems[order.id] && (
                          <TableRow>
                            <TableCell colSpan={isAdmin ? 7 : 6} className="bg-gray-50 p-4">
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm">Order Items:</h4>
                                <div className="grid gap-2">
                                  {orderItems[order.id].map((item) => (
                                    <div key={item.id} className="flex justify-between items-center p-2 bg-white rounded border text-sm">
                                      <div className="flex-1">
                                        <span className="font-medium">{item.description}</span>
                                        {item.article_code && (
                                          <span className="text-gray-500 ml-2">({item.article_code})</span>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <span>Qty: {item.quantity}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                
                                {isAdmin && (
                                  <div className="mt-4">
                                    <OrderAttachmentUploader orderId={order.id} />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <NewOrderModal
        open={isNewOrderModalOpen}
        onOpenChange={setIsNewOrderModalOpen}
        projectId={id || ''}
        onSuccess={loadData}
      />

      <AlertDialog open={!!orderToDelete} onOpenChange={(open) => !open && setOrderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this order? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOrder} className="bg-red-600 hover:bg-red-700">
              Delete Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProjectOrders;
