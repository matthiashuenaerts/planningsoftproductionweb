import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  Search,
  FileText, 
  Paperclip,
  ArrowUpDown,
  Package,
  Filter,
  Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { orderService } from '@/services/orderService';
import { projectService } from '@/services/dataService';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Order, OrderItem, OrderAttachment } from '@/types/order';
import { format } from 'date-fns';
import OrderAttachmentUploader from '@/components/OrderAttachmentUploader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ImportStockOrderModal from '@/components/ImportStockOrderModal';
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

const Orders: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentEmployee } = useAuth();
  const { createLocalizedPath } = useLanguage();
  
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<(Order & { project_name: string })[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [orderAttachments, setOrderAttachments] = useState<Record<string, OrderAttachment[]>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('all');
  const [showImportStockModal, setShowImportStockModal] = useState(false);
  
  const isAdmin = currentEmployee?.role === 'admin';
  const canDeleteOrder = currentEmployee?.role && ['admin', 'manager', 'preparater', 'teamleader'].includes(currentEmployee.role);
  
  useEffect(() => {
    const loadOrders = async () => {
      try {
        setLoading(true);
        
        // Get all orders
        const allOrders = await orderService.getAllOrders();

        // Filter out semi-finished orders with no items (logistics out orders)
        const ordersToDisplay = allOrders.filter(order => {
          if (order.order_type === 'semi-finished') {
            return order.order_items_count && order.order_items_count > 0;
          }
          return true;
        });
        
        // Get project details for each order
        const ordersWithProjectNames = await Promise.all(
          ordersToDisplay.map(async (order) => {
            let projectName = "STOCK Order";
            
            // Only fetch project name if project_id exists
            if (order.project_id) {
              try {
                const project = await projectService.getById(order.project_id);
                if (project) {
                  projectName = project.name;
                }
              } catch (error) {
                console.error("Error fetching project name:", error);
                projectName = "Unknown Project";
              }
            }
            
            return {
              ...order,
              project_name: projectName
            };
          })
        );
        
        setOrders(ordersWithProjectNames);
      } catch (error: any) {
        toast({
          title: "Error",
          description: `Failed to load orders: ${error.message}`,
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadOrders();
  }, [toast]);
  
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
        const attachments = await orderService.getOrderAttachments(orderId);
        setOrderAttachments(prev => ({
          ...prev,
          [orderId]: attachments
        }));
      } catch (error: any) {
        toast({
          title: "Error",
          description: `Failed to load order details: ${error.message}`,
          variant: "destructive"
        });
      }
    }
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
  
  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      await orderService.updateOrderStatus(orderId, newStatus);
      
      // Update local state
      setOrders(prev => 
        prev.map(order => 
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );
      
      toast({
        title: "Success",
        description: `Order status updated to ${newStatus}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to update order status: ${error.message}`,
        variant: "destructive"
      });
    }
  };
  
  const handleViewProjectOrders = (projectId: string) => {
    // Only navigate if project_id exists
    if (projectId) {
      navigate(createLocalizedPath(`/projects/${projectId}/orders`));
    }
  };
  
  const handleSortToggle = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };
  
  const handleAttachmentUploadSuccess = async (orderId: string) => {
    try {
      const attachments = await orderService.getOrderAttachments(orderId);
      setOrderAttachments(prev => ({
        ...prev,
        [orderId]: attachments
      }));
      
      toast({
        title: "Success",
        description: "Attachment uploaded successfully",
      });
    } catch (error: any) {
      console.error("Error refreshing attachments:", error);
    }
  };
  
  const handleImportStockOrder = () => {
    setShowImportStockModal(true);
  };

  const handleStockOrderImported = () => {
    setShowImportStockModal(false);
    // Reload orders to show the new stock order
    const loadOrders = async () => {
      try {
        setLoading(true);
        
        // Get all orders
        const allOrders = await orderService.getAllOrders();

        // Filter out semi-finished orders with no items (logistics out orders)
        const ordersToDisplay = allOrders.filter(order => {
          if (order.order_type === 'semi-finished') {
            return order.order_items_count && order.order_items_count > 0;
          }
          return true;
        });
        
        // Get project details for each order
        const ordersWithProjectNames = await Promise.all(
          ordersToDisplay.map(async (order) => {
            let projectName = "STOCK Order";
            
            // Only fetch project name if project_id exists
            if (order.project_id) {
              try {
                const project = await projectService.getById(order.project_id);
                if (project) {
                  projectName = project.name;
                }
              } catch (error) {
                console.error("Error fetching project name:", error);
                projectName = "Unknown Project";
              }
            }
            
            return {
              ...order,
              project_name: projectName
            };
          })
        );
        
        setOrders(ordersWithProjectNames);
      } catch (error: any) {
        toast({
          title: "Error",
          description: `Failed to load orders: ${error.message}`,
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadOrders();
    
    toast({
      title: "Success",
      description: "Stock order imported successfully",
    });
  };
  
  const handleDeleteOrder = async (orderId: string) => {
    try {
      await orderService.delete(orderId);
      
      // Remove the order from local state
      setOrders(prev => prev.filter(order => order.id !== orderId));
      
      // Clear expanded order if it's the one being deleted
      if (expandedOrder === orderId) {
        setExpandedOrder(null);
      }
      
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
  };
  
  const filteredOrders = orders
    .filter(order => {
      // Search filter
      const matchesSearch = order.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.project_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Status filter
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      
      // Order type filter
      const matchesOrderType = orderTypeFilter === 'all' || order.order_type === orderTypeFilter;
      
      return matchesSearch && matchesStatus && matchesOrderType;
    })
    .sort((a, b) => {
      const dateA = new Date(a.expected_delivery).getTime();
      const dateB = new Date(b.expected_delivery).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
  
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
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
            <h1 className="text-2xl font-bold mb-4 md:mb-0">All Orders</h1>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search orders..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full"
                />
              </div>
              <Button onClick={handleImportStockOrder} variant="outline">
                <Package className="mr-2 h-4 w-4" />
                Import STOCK Order
              </Button>
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="delayed">Delayed</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={orderTypeFilter} onValueChange={setOrderTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="semi-finished">Semi-finished</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle>All Orders</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {filteredOrders.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Order Date</TableHead>
                        <TableHead>
                          <button 
                            className="flex items-center gap-1 hover:text-primary"
                            onClick={handleSortToggle}
                          >
                            Expected Delivery
                            <ArrowUpDown className="h-4 w-4" />
                          </button>
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.map((order) => (
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
                              {order.project_name}
                            </TableCell>
                            <TableCell onClick={() => toggleOrderExpansion(order.id)}>
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
                            <TableCell className="flex justify-end gap-2">
                              {order.project_id && (
                                <Button 
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewProjectOrders(order.project_id)}
                                >
                                  <FileText className="h-4 w-4" />
                                  <span className="sr-only">View Project Orders</span>
                                </Button>
                              )}
                              {canDeleteOrder && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <Trash2 className="h-4 w-4" />
                                      <span className="sr-only">Delete Order</span>
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Order</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete this order? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteOrder(order.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                              {isAdmin && (
                                <select 
                                  value={order.status}
                                  onChange={(e) => updateOrderStatus(order.id, e.target.value as Order['status'])}
                                  className="p-1 text-xs rounded border border-gray-300"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="delivered">Delivered</option>
                                  <option value="delayed">Delayed</option>
                                  <option value="canceled">Canceled</option>
                                </select>
                              )}
                            </TableCell>
                          </TableRow>
                          
                          {expandedOrder === order.id && (
                            <TableRow>
                              <TableCell colSpan={7} className="p-0">
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
                                            <TableHead>Article Code</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right">Quantity</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {orderItems[order.id].map((item) => (
                                            <TableRow key={item.id}>
                                              <TableCell>{item.article_code || 'N/A'}</TableCell>
                                              <TableCell>{item.description}</TableCell>
                                              <TableCell className="text-right">{item.quantity}</TableCell>
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
                                        compact
                                      />
                                    </div>
                                    {!orderAttachments[order.id] ? (
                                      <div className="flex justify-center p-4">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                                      </div>
                                    ) : orderAttachments[order.id]?.length === 0 ? (
                                      <div className="flex items-center justify-between">
                                        <p className="text-sm text-muted-foreground">No attachments for this order.</p>
                                        <OrderAttachmentUploader 
                                          orderId={order.id}
                                          onUploadSuccess={() => handleAttachmentUploadSuccess(order.id)}
                                        />
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        {orderAttachments[order.id].map((attachment) => (
                                          <div 
                                            key={attachment.id}
                                            className="flex items-center gap-2 p-2 bg-background rounded border"
                                          >
                                            <Paperclip className="h-4 w-4 text-muted-foreground" />
                                            <span className="flex-1 truncate">{attachment.file_name}</span>
                                            <Button 
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 w-8 p-0"
                                              onClick={() => window.open(attachment.file_path, '_blank')}
                                            >
                                              <FileText className="h-4 w-4" />
                                              <span className="sr-only">View file</span>
                                            </Button>
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
              ) : searchTerm || statusFilter !== 'all' || orderTypeFilter !== 'all' ? (
                <div className="p-6 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <p className="text-muted-foreground">No orders found matching the current filters.</p>
                </div>
              ) : (
                <div className="p-6 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <p className="text-muted-foreground">No orders found.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {showImportStockModal && (
        <ImportStockOrderModal 
          onClose={() => setShowImportStockModal(false)}
          onImportSuccess={handleStockOrderImported}
        />
      )}
    </div>
  );
};

export default Orders;
