
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rushOrderService } from '@/services/rushOrderService';
import { RushOrder } from '@/types/rushOrder';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, File as FileIcon, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import EditRushOrderForm from './EditRushOrderForm';
import { useLanguage } from '@/context/LanguageContext';

interface RushOrderListProps {
  statusFilter?: "pending" | "in_progress" | "completed" | "all";
}

const RushOrderList: React.FC<RushOrderListProps> = ({ statusFilter = "all" }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { currentEmployee } = useAuth();
  const queryClient = useQueryClient();
  const { t, createLocalizedPath } = useLanguage();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<RushOrder | null>(null);
  
  const isAdmin = currentEmployee?.role === 'admin';
  
  const { data: rushOrders, isLoading, error, refetch } = useQuery({
    queryKey: ['rushOrders', statusFilter],
    queryFn: () => rushOrderService.getAllRushOrders(),
  });

  const deleteMutation = useMutation({
    mutationFn: rushOrderService.deleteRushOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rushOrders'] });
      setIsDeleteDialogOpen(false);
      setSelectedOrder(null);
    },
  });

  const handleDelete = () => {
    if (selectedOrder) {
      deleteMutation.mutate(selectedOrder.id);
    }
  };
  
  const handleEditSuccess = () => {
    setIsEditDialogOpen(false);
    setSelectedOrder(null);
  };
  
  const isImage = (url: string | undefined): boolean => {
    if (!url) return false;
    return /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(url);
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">{t('status_pending')}</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">{t('status_in_progress')}</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">{t('status_completed')}</Badge>;
      default:
        return <Badge variant="outline">{t('status_unknown')}</Badge>;
    }
  };

  const filteredOrders = rushOrders?.filter(order => 
    statusFilter === "all" ? true : order.status === statusFilter
  );
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="shadow-sm">
            <CardHeader className="pb-4">
              <Skeleton className="h-6 w-2/3" />
              <div className="flex justify-between">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/6" />
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-16 w-full" />
            </CardContent>
            <CardFooter>
              <div className="w-full flex justify-between">
                <Skeleton className="h-10 w-20" />
                <Skeleton className="h-10 w-32" />
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }
  
  if (error) {
    return (
      <Card className="bg-red-50 border-red-200">
        <CardHeader>
          <CardTitle>{t('error_loading_rush_orders')}</CardTitle>
          <CardDescription>{t('error_loading_rush_orders_description')}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button onClick={() => refetch()}>{t('try_again')}</Button>
        </CardFooter>
      </Card>
    );
  }
  
  if (!filteredOrders || filteredOrders.length === 0) {
    return (
      <Card className="bg-gray-50 border-gray-200 text-center py-8">
        <CardContent>
          <p className="text-gray-500">{t('no_rush_orders_found')}</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-4">
      {filteredOrders.map((order: RushOrder) => (
        <Card key={order.id} className="shadow-sm transition-shadow hover:shadow-md">
          <CardHeader className="pb-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center">
                <CardTitle>{order.title}</CardTitle>
                {(order.unread_messages_count && order.unread_messages_count > 0) && (
                  <Badge className="ml-2 bg-red-500 text-white border-0">
                    <MessageCircle className="h-3 w-3 mr-1" />
                    {order.unread_messages_count}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(order.status)}
                {isAdmin && (
                   <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setSelectedOrder(order); setIsEditDialogOpen(true); }}>
                        <Edit className="mr-2 h-4 w-4" />
                        <span>{t('edit')}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => { setSelectedOrder(order); setIsDeleteDialogOpen(true); }}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span>{t('delete')}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
            <CardDescription className="flex justify-between">
              <span>{t('created')}: {format(parseISO(order.created_at), 'MMM d, yyyy')}</span>
              <span className="font-medium text-red-600">
                {t('deadline')}: {format(parseISO(order.deadline), 'MMM d, yyyy')}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 line-clamp-2">{order.description}</p>
            
            {order.image_url && (
              <div className="mt-4">
                {isImage(order.image_url) ? (
                  <img 
                    src={order.image_url} 
                    alt={order.title} 
                    className="h-40 w-full object-cover rounded-md"
                  />
                ) : (
                  <div className="h-40 w-full rounded-md bg-gray-100 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                        <FileIcon className="mx-auto h-12 w-12" />
                        <p className="text-sm mt-2">Document Attached</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">{t('tasks')}</p>
                <p className="text-sm font-medium">{t('tasks_assigned', { count: (order.tasks?.length || 0).toString() })}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">{t('assigned_to')}</p>
                <p className="text-sm font-medium">{t('team_members_assigned', { count: (order.assignments?.length || 0).toString() })}</p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <div className="w-full flex justify-between">
              <Badge variant="outline" className={`
                ${order.priority === 'critical' ? 'bg-red-100 text-red-800 border-red-300' : 'bg-orange-100 text-orange-800 border-orange-300'}
              `}>
                {order.priority === 'critical' ? t('priority_critical') : t('priority_high')}
              </Badge>
              <Button 
                variant="outline"
                onClick={() => navigate(createLocalizedPath(`/rush-orders/${order.id}`))}
              >
                {t('view_details')}
              </Button>
            </div>
          </CardFooter>
        </Card>
      ))}

      {/* Edit Dialog */}
      {selectedOrder && (
        <Dialog open={isEditDialogOpen} onOpenChange={(open) => { if (!open) setSelectedOrder(null); setIsEditDialogOpen(open); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>{t('edit_rush_order')}</DialogTitle>
              <DialogDescription>
                {t('edit_rush_order_description')}
              </DialogDescription>
            </DialogHeader>
            <EditRushOrderForm onSuccess={handleEditSuccess} rushOrder={selectedOrder} />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_rush_order_confirm_description', { title: selectedOrder?.title || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedOrder(null)}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t('deleting') : t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RushOrderList;

