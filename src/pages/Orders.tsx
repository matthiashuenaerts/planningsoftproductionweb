import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronDown, 
  ChevronUp, 
  Search,
  FileText, 
  Paperclip,
  ArrowUpDown,
  Package,
  Filter,
  Trash2,
  Camera,
  ChevronLeft,
  ChevronRight,
  ExternalLink
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
import { EnhancedDeliveryConfirmationModal } from '@/components/logistics/EnhancedDeliveryConfirmationModal';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTenant } from '@/context/TenantContext';
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

const ORDERS_PER_PAGE = 25;

// Mobile order card component
const MobileOrderCard = ({
  order,
  isExpanded,
  onToggle,
  onConfirmDelivery,
  onViewProjectOrders,
  onDeleteOrder,
  onUpdateStatus,
  isAdminOrTeamleader,
  canDeleteOrder,
  orderItems,
  orderAttachments,
  onAttachmentUploadSuccess,
  getStatusBadge,
  formatDate,
  createLocalizedPath,
}: any) => {
  const navigate = useNavigate();

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="p-4 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0 mr-2">
            <p className="font-semibold text-sm truncate">{order.project_name}</p>
            <p className="text-xs text-muted-foreground truncate">{order.supplier}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {getStatusBadge(order.status)}
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>Ordered: {formatDate(order.order_date)}</span>
          <span>Due: {formatDate(order.expected_delivery)}</span>
        </div>
      </div>

      {/* Action buttons row */}
      <div className="flex border-t divide-x">
        {order.status === 'pending' && (
          <button
            className="flex-1 py-2 text-xs text-green-600 hover:bg-muted/50 flex items-center justify-center gap-1"
            onClick={(e) => { e.stopPropagation(); onConfirmDelivery(order); }}
          >
            <Camera className="h-3 w-3" /> Confirm
          </button>
        )}
        {order.project_id && (
          <button
            className="flex-1 py-2 text-xs text-primary hover:bg-muted/50 flex items-center justify-center gap-1"
            onClick={(e) => { e.stopPropagation(); onViewProjectOrders(order.project_id); }}
          >
            <FileText className="h-3 w-3" /> Project
          </button>
        )}
        <button
          className="flex-1 py-2 text-xs text-primary hover:bg-muted/50 flex items-center justify-center gap-1"
          onClick={(e) => { e.stopPropagation(); navigate(createLocalizedPath(`/projects/${order.project_id}`)); }}
        >
          <ExternalLink className="h-3 w-3" /> Details
        </button>
        {isAdminOrTeamleader && (
          <div className="flex-1 flex items-center justify-center">
            <select
              value={order.status}
              onChange={(e) => { e.stopPropagation(); onUpdateStatus(order.id, e.target.value); }}
              className="text-xs border-0 bg-transparent w-full text-center py-2"
            >
              <option value="pending">Pending</option>
              <option value="delivered">Delivered</option>
              <option value="delayed">Delayed</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t p-4 bg-muted/30 space-y-4">
          <div>
            <h4 className="font-medium text-sm mb-2">Order Items</h4>
            {!orderItems ? (
              <div className="flex justify-center p-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
              </div>
            ) : orderItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items in this order.</p>
            ) : (
              <div className="space-y-2">
                {orderItems.map((item: OrderItem) => (
                  <div key={item.id} className="flex justify-between text-sm p-2 bg-background rounded border">
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-xs text-muted-foreground">{item.article_code || 'N/A'}</span>
                      <p className="truncate">{item.description}</p>
                    </div>
                    <span className="font-medium ml-2 flex-shrink-0">×{item.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium text-sm">Attachments</h4>
              <OrderAttachmentUploader
                orderId={order.id}
                onUploadSuccess={() => onAttachmentUploadSuccess(order.id)}
                compact
              />
            </div>
            {orderAttachments?.length > 0 && (
              <div className="space-y-1">
                {orderAttachments.map((att: OrderAttachment) => (
                  <div key={att.id} className="flex items-center gap-2 p-2 bg-background rounded border text-sm">
                    <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate flex-1">{att.file_name}</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => window.open(att.file_path, '_blank')}>
                      <FileText className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

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
  const [selectedOrderForDelivery, setSelectedOrderForDelivery] = useState<Order | null>(null);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const isMobile = useIsMobile();
  const { tenant } = useTenant();
  
  const isAdminOrTeamleader = currentEmployee?.role === 'admin' || currentEmployee?.role === 'teamleader';
  const canDeleteOrder = currentEmployee?.role && ['admin', 'manager', 'preparater', 'teamleader'].includes(currentEmployee.role);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const allOrders = await orderService.getAllOrders(tenant?.id);
      const ordersToDisplay = allOrders.filter(order => {
        if (order.order_type === 'semi-finished') {
          return order.order_items_count && order.order_items_count > 0;
        }
        return true;
      });
      
      const ordersWithProjectNames = await Promise.all(
        ordersToDisplay.map(async (order) => {
          let projectName = "STOCK Order";
          if (order.project_id) {
            try {
              const project = await projectService.getById(order.project_id);
              if (project) projectName = project.name;
            } catch { projectName = "Unknown Project"; }
          }
          return { ...order, project_name: projectName };
        })
      );
      setOrders(ordersWithProjectNames);
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to load orders: ${error.message}`, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, [toast]);
  
  const toggleOrderExpansion = async (orderId: string) => {
    if (expandedOrder === orderId) { setExpandedOrder(null); return; }
    setExpandedOrder(orderId);
    if (!orderItems[orderId]) {
      try {
        const items = await orderService.getOrderItems(orderId);
        setOrderItems(prev => ({ ...prev, [orderId]: items }));
        const attachments = await orderService.getOrderAttachments(orderId);
        setOrderAttachments(prev => ({ ...prev, [orderId]: attachments }));
      } catch (error: any) {
        toast({ title: "Error", description: `Failed to load order details: ${error.message}`, variant: "destructive" });
      }
    }
  };
  
  const formatDate = (dateString: string) => {
    try { return format(new Date(dateString), 'MMM d, yyyy'); }
    catch { return 'Invalid date'; }
  };
  
  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 text-xs">Pending</Badge>;
      case 'delivered': return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-xs">Delivered</Badge>;
      case 'canceled': return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 text-xs">Canceled</Badge>;
      case 'delayed': return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-xs">Delayed</Badge>;
      default: return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };
  
  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      await orderService.updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(order => order.id === orderId ? { ...order, status: newStatus } : order));
      toast({ title: "Success", description: `Order status updated to ${newStatus}` });
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to update order status: ${error.message}`, variant: "destructive" });
    }
  };
  
  const handleViewProjectOrders = (projectId: string) => {
    if (projectId) navigate(createLocalizedPath(`/projects/${projectId}/orders`));
  };
  
  const handleSortToggle = () => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  
  const handleAttachmentUploadSuccess = async (orderId: string) => {
    try {
      const attachments = await orderService.getOrderAttachments(orderId);
      setOrderAttachments(prev => ({ ...prev, [orderId]: attachments }));
      toast({ title: "Success", description: "Attachment uploaded successfully" });
    } catch (error: any) { console.error("Error refreshing attachments:", error); }
  };
  
  const handleImportStockOrder = () => setShowImportStockModal(true);

  const handleStockOrderImported = () => {
    setShowImportStockModal(false);
    loadOrders();
    toast({ title: "Success", description: "Stock order imported successfully" });
  };
  
  const handleDeleteOrder = async (orderId: string) => {
    try {
      await orderService.delete(orderId);
      setOrders(prev => prev.filter(order => order.id !== orderId));
      if (expandedOrder === orderId) setExpandedOrder(null);
      toast({ title: "Success", description: "Order deleted successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to delete order: ${error.message}`, variant: "destructive" });
    }
  };

  const handleConfirmDelivery = (order: Order) => {
    setSelectedOrderForDelivery(order);
    setShowDeliveryModal(true);
  };

  const handleDeliveryConfirmed = () => {
    loadOrders();
    setShowDeliveryModal(false);
    setSelectedOrderForDelivery(null);
  };
  
  const filteredOrders = useMemo(() => orders
    .filter(order => {
      const matchesSearch = order.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.project_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesOrderType = orderTypeFilter === 'all' || order.order_type === orderTypeFilter;
      return matchesSearch && matchesStatus && matchesOrderType;
    })
    .sort((a, b) => {
      const dateA = new Date(a.expected_delivery).getTime();
      const dateB = new Date(b.expected_delivery).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    }), [orders, searchTerm, statusFilter, orderTypeFilter, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ORDERS_PER_PAGE;
    return filteredOrders.slice(start, start + ORDERS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, orderTypeFilter, sortOrder]);

  if (loading) {
    return (
      <div className="flex min-h-screen">
        {!isMobile && <div className="w-64 bg-sidebar fixed top-0 bottom-0"><Navbar /></div>}
        {isMobile && <Navbar />}
        <div className={`w-full p-6 flex justify-center items-center ${!isMobile ? 'ml-64' : 'pt-16'}`}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  const PaginationControls = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between pt-4">
        <p className="text-sm text-muted-foreground">
          {((currentPage - 1) * ORDERS_PER_PAGE) + 1}–{Math.min(currentPage * ORDERS_PER_PAGE, filteredOrders.length)} of {filteredOrders.length}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{currentPage} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };
  
  return (
    <div className="flex min-h-screen">
      {!isMobile && <div className="w-64 bg-sidebar fixed top-0 bottom-0"><Navbar /></div>}
      {isMobile && <Navbar />}
      <div className={`w-full ${isMobile ? 'p-3 pt-16' : 'p-6 ml-64'} overflow-x-hidden`}>
        <div className="w-full max-w-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3">
            <h1 className="text-xl md:text-2xl font-bold">All Orders</h1>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search orders..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full"
                />
              </div>
              <Button onClick={handleImportStockOrder} variant="outline" size={isMobile ? "sm" : "default"}>
                <Package className="mr-2 h-4 w-4" />
                Import STOCK Order
              </Button>
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 md:w-40 h-9">
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
              <SelectTrigger className="w-32 md:w-40 h-9">
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
                <CardTitle className="text-base md:text-lg">All Orders</CardTitle>
                <span className="text-sm text-muted-foreground">{filteredOrders.length} orders</span>
              </div>
            </CardHeader>
            <CardContent className="px-2 md:px-6">
              {paginatedOrders.length > 0 ? (
                <>
                  {/* Desktop table view */}
                  {!isMobile ? (
                    <div className="rounded-md border w-full overflow-x-auto">
                      <Table className="w-full table-fixed">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40px]"></TableHead>
                            <TableHead className="w-[25%]">Project</TableHead>
                            <TableHead className="w-[18%]">Supplier</TableHead>
                            <TableHead className="w-[12%]">Order Date</TableHead>
                            <TableHead className="w-[14%]">
                              <button className="flex items-center gap-1 hover:text-primary" onClick={handleSortToggle}>
                                Expected Delivery
                                <ArrowUpDown className="h-4 w-4" />
                              </button>
                            </TableHead>
                            <TableHead className="w-[10%]">Status</TableHead>
                            <TableHead className="w-[21%] text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedOrders.map((order) => (
                            <React.Fragment key={order.id}>
                              <TableRow className="cursor-pointer hover:bg-muted/50">
                                <TableCell className="p-1">
                                  <Button variant="ghost" size="icon" onClick={() => toggleOrderExpansion(order.id)} className="h-8 w-8">
                                    {expandedOrder === order.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </Button>
                                </TableCell>
                                <TableCell className="font-medium truncate" onClick={() => toggleOrderExpansion(order.id)}>
                                  {order.project_name}
                                </TableCell>
                                <TableCell className="truncate" onClick={() => toggleOrderExpansion(order.id)}>
                                  {order.supplier}
                                </TableCell>
                                <TableCell className="text-sm" onClick={() => toggleOrderExpansion(order.id)}>
                                  {formatDate(order.order_date)}
                                </TableCell>
                                <TableCell className="text-sm" onClick={() => toggleOrderExpansion(order.id)}>
                                  {formatDate(order.expected_delivery)}
                                </TableCell>
                                <TableCell onClick={() => toggleOrderExpansion(order.id)}>
                                  {getStatusBadge(order.status)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex justify-end gap-1 flex-wrap">
                                    {order.status === 'pending' && (
                                      <Button variant="ghost" size="sm" onClick={() => handleConfirmDelivery(order)} className="text-green-600 hover:text-green-700 h-8 px-2">
                                        <Camera className="h-4 w-4" />
                                        <span className="sr-only">Confirm Delivery</span>
                                      </Button>
                                    )}
                                    {order.project_id && (
                                      <Button variant="ghost" size="sm" onClick={() => handleViewProjectOrders(order.project_id)} className="h-8 px-2">
                                        <FileText className="h-4 w-4" />
                                        <span className="sr-only">View Project Orders</span>
                                      </Button>
                                    )}
                                    {canDeleteOrder && (
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="sm" className="h-8 px-2">
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
                                            <AlertDialogAction onClick={() => handleDeleteOrder(order.id)} className="bg-red-600 hover:bg-red-700">
                                              Delete
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    )}
                                    {isAdminOrTeamleader && (
                                      <select 
                                        value={order.status}
                                        onChange={(e) => updateOrderStatus(order.id, e.target.value as Order['status'])}
                                        className="p-1 text-xs rounded border border-border bg-background h-8"
                                      >
                                        <option value="pending">Pending</option>
                                        <option value="delivered">Delivered</option>
                                        <option value="delayed">Delayed</option>
                                        <option value="canceled">Canceled</option>
                                      </select>
                                    )}
                                  </div>
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
                                              <div key={attachment.id} className="flex items-center gap-2 p-2 bg-background rounded border">
                                                <Paperclip className="h-4 w-4 text-muted-foreground" />
                                                <span className="flex-1 truncate">{attachment.file_name}</span>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => window.open(attachment.file_path, '_blank')}>
                                                  <FileText className="h-4 w-4" />
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
                  ) : (
                    /* Mobile card view */
                    <div className="space-y-3">
                      {paginatedOrders.map((order) => (
                        <MobileOrderCard
                          key={order.id}
                          order={order}
                          isExpanded={expandedOrder === order.id}
                          onToggle={() => toggleOrderExpansion(order.id)}
                          onConfirmDelivery={handleConfirmDelivery}
                          onViewProjectOrders={handleViewProjectOrders}
                          onDeleteOrder={handleDeleteOrder}
                          onUpdateStatus={updateOrderStatus}
                          isAdminOrTeamleader={isAdminOrTeamleader}
                          canDeleteOrder={canDeleteOrder}
                          orderItems={orderItems[order.id]}
                          orderAttachments={orderAttachments[order.id]}
                          onAttachmentUploadSuccess={handleAttachmentUploadSuccess}
                          getStatusBadge={getStatusBadge}
                          formatDate={formatDate}
                          createLocalizedPath={createLocalizedPath}
                        />
                      ))}
                    </div>
                  )}
                  <PaginationControls />
                </>
              ) : searchTerm || statusFilter !== 'all' || orderTypeFilter !== 'all' ? (
                <div className="p-6 text-center bg-muted/30 rounded-lg border border-dashed border-border">
                  <p className="text-muted-foreground">No orders found matching the current filters.</p>
                </div>
              ) : (
                <div className="p-6 text-center bg-muted/30 rounded-lg border border-dashed border-border">
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

      {selectedOrderForDelivery && (
        <EnhancedDeliveryConfirmationModal
          order={selectedOrderForDelivery}
          isOpen={showDeliveryModal}
          onClose={() => { setShowDeliveryModal(false); setSelectedOrderForDelivery(null); }}
          onConfirmed={handleDeliveryConfirmed}
        />
      )}
    </div>
  );
};

export default Orders;
