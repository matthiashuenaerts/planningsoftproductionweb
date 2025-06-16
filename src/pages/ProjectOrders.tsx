import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus, Calendar, FileText, Package, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Navbar from '@/components/Navbar';
import NewOrderModal from '@/components/NewOrderModal';
import OrderEditModal from '@/components/OrderEditModal';
import OrderPopup from '@/components/OrderPopup';
import { orderService } from '@/services/orderService';
import { projectService } from '@/services/dataService';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useLanguage } from '@/context/LanguageContext';

const ProjectOrders: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast, createLocalizedPath } = useLanguage();
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const { data: project, isLoading: isProjectLoading, error: projectError } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectService.getById(projectId!),
  });

  const { data: orders, isLoading: isOrdersLoading, error: ordersError, refetch } = useQuery({
    queryKey: ['orders', projectId],
    queryFn: () => orderService.getProjectOrders(projectId!),
  });

  const handleBackToProject = () => {
    navigate(createLocalizedPath(`/projects/${projectId}`));
  };

  const handleOpenNewOrderModal = () => {
    setShowNewOrderModal(true);
  };

  const handleCloseNewOrderModal = () => {
    setShowNewOrderModal(false);
    refetch();
  };

  const handleEditOrder = (order: any) => {
    setEditingOrder(order);
  };

  const handleCloseEditOrderModal = () => {
    setEditingOrder(null);
    refetch();
  };

  const handleViewOrder = (order: any) => {
    setSelectedOrder(order);
  };

  const handleCloseOrderPopup = () => {
    setSelectedOrder(null);
  };

  if (isProjectLoading || isOrdersLoading) {
    return <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
        <div className="ml-64 w-full p-6 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </div>;
  }

  if (projectError) {
    toast({
      title: "Error",
      description: `Failed to load project: ${projectError.message}`,
      variant: "destructive"
    });
    return <div>Error loading project</div>;
  }

  if (ordersError) {
    toast({
      title: "Error",
      description: `Failed to load orders: ${ordersError.message}`,
      variant: "destructive"
    });
    return <div>Error loading orders</div>;
  }

  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      <div className="ml-64 w-full p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="outline" onClick={handleBackToProject}>
              <ArrowLeft className="mr-2 h-4 w-4" /> {t('back_to_projects')}
            </Button>
            <h1 className="text-2xl font-bold">{t('orders')} - {project?.name}</h1>
          </div>
          
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{t('orders_and_accessories')}</h2>
            <Dialog open={showNewOrderModal} onOpenChange={setShowNewOrderModal}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700 text-white">
                  <Plus className="mr-2 h-4 w-4" /> {t('new_order')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
                <DialogHeader>
                  <DialogTitle>{t('create_new_order')}</DialogTitle>
                  <DialogDescription>
                    {t('enter_order_details')}
                  </DialogDescription>
                </DialogHeader>
                <NewOrderModal projectId={projectId!} onClose={handleCloseNewOrderModal} />
              </DialogContent>
            </Dialog>
          </div>
          
          <Tabs defaultValue="open" className="space-y-4">
            <TabsList>
              <TabsTrigger value="open">{t('open_orders')} ({orders?.length})</TabsTrigger>
              <TabsTrigger value="to_order">{t('to_order')}</TabsTrigger>
              <TabsTrigger value="in_stock">{t('in_stock')}</TabsTrigger>
            </TabsList>
            <TabsContent value="open">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {orders?.map(order => (
                  <Card key={order.id} className="shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleViewOrder(order)}>
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold">{order.supplier}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {t('order_date')}: {format(new Date(order.order_date), 'MMM d, yyyy')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t('expected_delivery')}: {format(new Date(order.expected_delivery), 'MMM d, yyyy')}
                      </p>
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary">{order.order_items_count} {t('items')}</Badge>
                        <Badge variant="outline">{order.order_type}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="to_order">
              <p>{t('no_orders_to_order')}</p>
            </TabsContent>
            <TabsContent value="in_stock">
              <p>{t('no_items_in_stock')}</p>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Order Popup */}
      {selectedOrder && (
        <OrderPopup order={selectedOrder} onClose={handleCloseOrderPopup} onEdit={handleEditOrder} />
      )}

      {/* Order Edit Modal */}
      {editingOrder && (
        <OrderEditModal order={editingOrder} onClose={handleCloseEditOrderModal} />
      )}
    </div>
  );
};

export default ProjectOrders;
