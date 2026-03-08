import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  t,
}: any) => {
  const navigate = useNavigate();

  return (
    <div className="border rounded-lg bg-card overflow-hidden shadow-sm">
      <div className="p-3 cursor-pointer active:bg-muted/30 transition-colors" onClick={onToggle}>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[13px] truncate leading-tight">{order.project_name}</p>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{order.supplier}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {getStatusBadge(order.status)}
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
        </div>
        <div className="flex gap-3 text-[10px] text-muted-foreground">
          <span>{t('ord_ordered')}: {formatDate(order.order_date)}</span>
          <span>{t('ord_due')}: {formatDate(order.expected_delivery)}</span>
        </div>
      </div>

      <div className="flex border-t divide-x bg-muted/20">
        {order.status === 'pending' && (
          <button
            className="flex-1 py-2 text-[11px] text-green-600 hover:bg-muted/50 active:bg-muted flex items-center justify-center gap-1 font-medium"
            onClick={(e) => { e.stopPropagation(); onConfirmDelivery(order); }}
          >
            <Camera className="h-3 w-3" /> {t('ord_confirm')}
          </button>
        )}
        {order.project_id && (
          <button
            className="flex-1 py-2 text-[11px] text-primary hover:bg-muted/50 active:bg-muted flex items-center justify-center gap-1 font-medium"
            onClick={(e) => { e.stopPropagation(); onViewProjectOrders(order.project_id); }}
          >
            <FileText className="h-3 w-3" /> {t('ord_project')}
          </button>
        )}
        <button
          className="flex-1 py-2 text-[11px] text-primary hover:bg-muted/50 active:bg-muted flex items-center justify-center gap-1 font-medium"
          onClick={(e) => { e.stopPropagation(); navigate(createLocalizedPath(`/projects/${order.project_id}`)); }}
        >
          <ExternalLink className="h-3 w-3" /> {t('ord_details')}
        </button>
        {isAdminOrTeamleader && (
          <div className="flex-1 flex items-center justify-center">
            <select
              value={order.status}
              onChange={(e) => { e.stopPropagation(); onUpdateStatus(order.id, e.target.value); }}
              className="text-[11px] border-0 bg-transparent w-full text-center py-2 font-medium"
            >
              <option value="pending">{t('ord_pending')}</option>
              <option value="delivered">{t('ord_delivered')}</option>
              <option value="delayed">{t('ord_delayed')}</option>
              <option value="canceled">{t('ord_canceled')}</option>
            </select>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="border-t p-4 bg-muted/30 space-y-4">
          <div>
            <h4 className="font-medium text-sm mb-2">{t('ord_order_items')}</h4>
            {!orderItems ? (
              <div className="flex justify-center p-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
              </div>
            ) : orderItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('ord_no_items')}</p>
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
              <h4 className="font-medium text-sm">{t('ord_attachments')}</h4>
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
  const { t, createLocalizedPath } = useLanguage();
  
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
  const [visibleCount, setVisibleCount] = useState(ORDERS_PER_PAGE);
  const isMobile = useIsMobile();
  const { tenant } = useTenant();
  const sentinelRef = useRef<HTMLDivElement>(null);
  
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
          let projectName = t('ord_stock_order');
          if (order.project_id) {
            try {
              const project = await projectService.getById(order.project_id);
              if (project) projectName = project.name;
            } catch { projectName = t('ord_unknown_project'); }
          }
          return { ...order, project_name: projectName };
        })
      );
      setOrders(ordersWithProjectNames);
    } catch (error: any) {
      toast({ title: t('itc_error'), description: `Failed to load orders: ${error.message}`, variant: "destructive" });
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
        toast({ title: t('itc_error'), description: `Failed to load order details: ${error.message}`, variant: "destructive" });
      }
    }
  };
  
  const formatDate = (dateString: string) => {
    try { return format(new Date(dateString), 'MMM d, yyyy'); }
    catch { return 'Invalid date'; }
  };
  
  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 text-xs">{t('ord_pending')}</Badge>;
      case 'delivered': return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-xs">{t('ord_delivered')}</Badge>;
      case 'canceled': return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 text-xs">{t('ord_canceled')}</Badge>;
      case 'delayed': return <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-xs">{t('ord_delayed')}</Badge>;
      default: return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };
  
  const updateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      await orderService.updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(order => order.id === orderId ? { ...order, status: newStatus } : order));
      toast({ title: "Success", description: `Order status updated to ${newStatus}` });
    } catch (error: any) {
      toast({ title: t('itc_error'), description: `Failed to update order status: ${error.message}`, variant: "destructive" });
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
      toast({ title: t('itc_error'), description: `Failed to delete order: ${error.message}`, variant: "destructive" });
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

  // Infinite scroll: show only visibleCount items
  const displayedOrders = useMemo(() => filteredOrders.slice(0, visibleCount), [filteredOrders, visibleCount]);
  const hasMore = visibleCount < filteredOrders.length;

  // Reset visible count when filters change
  useEffect(() => { setVisibleCount(ORDERS_PER_PAGE); }, [searchTerm, statusFilter, orderTypeFilter, sortOrder]);

  // IntersectionObserver for infinite scroll
  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + ORDERS_PER_PAGE, filteredOrders.length));
  }, [filteredOrders.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

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
  
  return (
    <div className="flex min-h-screen">
      {!isMobile && <div className="w-64 bg-sidebar fixed top-0 bottom-0"><Navbar /></div>}
      {isMobile && <Navbar />}
      <div className={`w-full ${isMobile ? 'p-3 pt-16' : 'p-6 ml-64'} overflow-x-hidden`}>
        <div className="w-full max-w-full">
          <div className={`flex flex-col gap-2 mb-4 ${isMobile ? '' : 'md:flex-row md:items-center md:justify-between md:gap-3'}`}>
            <h1 className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>{t('ord_all_orders')}</h1>
            <div className={`flex gap-2 ${isMobile ? 'flex-col' : 'flex-row'}`}>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder={t('ord_search_placeholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`pl-9 w-full ${isMobile ? 'h-9 text-sm' : ''}`}
                />
              </div>
              <Button onClick={handleImportStockOrder} variant="outline" size={isMobile ? "sm" : "default"} className={isMobile ? "h-9 text-xs" : ""}>
                <Package className={`mr-1.5 ${isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
                {isMobile ? 'STOCK Import' : t('ord_import_stock')}
              </Button>
            </div>
          </div>
          
          {/* Filters */}
          <div className={`flex flex-wrap gap-2 mb-3 ${isMobile ? 'items-stretch' : 'items-center gap-3 mb-4'}`}>
            {!isMobile && (
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{t('ord_filters')}</span>
              </div>
            )}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className={`h-8 ${isMobile ? 'flex-1 min-w-0 text-xs' : 'w-40 h-9'}`}>
                <SelectValue placeholder={t('ord_all_status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('ord_all_status')}</SelectItem>
                <SelectItem value="pending">{t('ord_pending')}</SelectItem>
                <SelectItem value="delivered">{t('ord_delivered')}</SelectItem>
                <SelectItem value="delayed">{t('ord_delayed')}</SelectItem>
                <SelectItem value="canceled">{t('ord_canceled')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={orderTypeFilter} onValueChange={setOrderTypeFilter}>
              <SelectTrigger className={`h-8 ${isMobile ? 'flex-1 min-w-0 text-xs' : 'w-40 h-9'}`}>
                <SelectValue placeholder={t('ord_all_types')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('ord_all_types')}</SelectItem>
                <SelectItem value="standard">{t('ord_standard')}</SelectItem>
                <SelectItem value="semi-finished">{t('ord_semi_finished')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base md:text-lg">{t('ord_all_orders')}</CardTitle>
                <span className="text-sm text-muted-foreground">{t('ord_orders_count', { count: String(filteredOrders.length) })}</span>
              </div>
            </CardHeader>
            <CardContent className="px-2 md:px-6">
              {displayedOrders.length > 0 ? (
                <>
                  {/* Desktop table view */}
                  {!isMobile ? (
                    <div className="rounded-md border w-full overflow-x-auto">
                      <Table className="w-full table-fixed">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40px]"></TableHead>
                            <TableHead className="w-[25%]">{t('ord_project')}</TableHead>
                            <TableHead className="w-[18%]">{t('ord_supplier')}</TableHead>
                            <TableHead className="w-[12%]">{t('ord_order_date')}</TableHead>
                            <TableHead className="w-[14%]">
                              <button className="flex items-center gap-1 hover:text-primary" onClick={handleSortToggle}>
                                {t('ord_expected_delivery')}
                                <ArrowUpDown className="h-4 w-4" />
                              </button>
                            </TableHead>
                            <TableHead className="w-[10%]">{t('ord_status')}</TableHead>
                            <TableHead className="w-[21%] text-right">{t('ord_actions')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayedOrders.map((order) => (
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
                                        <span className="sr-only">{t('ord_confirm_delivery')}</span>
                                      </Button>
                                    )}
                                    {order.project_id && (
                                      <Button variant="ghost" size="sm" onClick={() => handleViewProjectOrders(order.project_id)} className="h-8 px-2">
                                        <FileText className="h-4 w-4" />
                                        <span className="sr-only">{t('ord_view_project_orders')}</span>
                                      </Button>
                                    )}
                                    {canDeleteOrder && (
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="sm" className="h-8 px-2">
                                            <Trash2 className="h-4 w-4" />
                                            <span className="sr-only">{t('ord_delete_order')}</span>
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>{t('ord_delete_order')}</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              {t('ord_delete_order_confirm')}
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteOrder(order.id)} className="bg-red-600 hover:bg-red-700">
                                              {t('ord_delete')}
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
                                        <option value="pending">{t('ord_pending')}</option>
                                        <option value="delivered">{t('ord_delivered')}</option>
                                        <option value="delayed">{t('ord_delayed')}</option>
                                        <option value="canceled">{t('ord_canceled')}</option>
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
                                        <h4 className="font-medium mb-2">{t('ord_order_items')}</h4>
                                        {!orderItems[order.id] ? (
                                          <div className="flex justify-center p-4">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                                          </div>
                                        ) : orderItems[order.id].length === 0 ? (
                                          <p className="text-sm text-muted-foreground">{t('ord_no_items')}</p>
                                        ) : (
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead>{t('ord_article_code')}</TableHead>
                                                <TableHead>{t('ord_description')}</TableHead>
                                                <TableHead className="text-right">{t('ord_quantity')}</TableHead>
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
                                          <h4 className="font-medium">{t('ord_attachments')}</h4>
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
                                            <p className="text-sm text-muted-foreground">{t('ord_no_attachments')}</p>
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
                      {displayedOrders.map((order) => (
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
                          t={t}
                        />
                      ))}
                    </div>
                  )}

                  {/* Infinite scroll sentinel */}
                  <div ref={sentinelRef} className="h-4" />
                  {hasMore && (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  )}
                </>
              ) : searchTerm || statusFilter !== 'all' || orderTypeFilter !== 'all' ? (
                <div className="p-6 text-center bg-muted/30 rounded-lg border border-dashed border-border">
                  <p className="text-muted-foreground">{t('ord_no_orders_filters')}</p>
                </div>
              ) : (
                <div className="p-6 text-center bg-muted/30 rounded-lg border border-dashed border-border">
                  <p className="text-muted-foreground">{t('ord_no_orders')}</p>
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
