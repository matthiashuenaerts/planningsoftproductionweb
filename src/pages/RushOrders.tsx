import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import NewRushOrderForm from '@/components/rush-orders/NewRushOrderForm';
import RushOrderList from '@/components/rush-orders/RushOrderList';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { rushOrderService } from '@/services/rushOrderService';
import { useLanguage } from '@/context/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTenant } from '@/context/TenantContext';

const RushOrders = () => {
  const { currentEmployee } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const { tenant } = useTenant();
  
  const canCreateRushOrder = !!currentEmployee;
  
  const handleCreateSuccess = () => {
    setIsCreateDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ['rushOrders'] });
  };

  const { data: allRushOrders } = useQuery({
    queryKey: ['rushOrders', 'all', tenant?.id],
    queryFn: () => rushOrderService.getAllRushOrders(tenant?.id),
    refetchInterval: 15000,
  });

  const pendingCount = allRushOrders?.filter(order => order.status === 'pending').length || 0;
  const inProgressCount = allRushOrders?.filter(order => order.status === 'in_progress').length || 0;
  const completedCount = allRushOrders?.filter(order => order.status === 'completed').length || 0;
  
  return (
    <div className="flex min-h-screen bg-background">
      {!isMobile && (
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
      )}
      {isMobile && <Navbar />}
      <div className={`flex-1 min-w-0 overflow-x-hidden ${isMobile ? 'pt-16 px-4 pb-4' : 'ml-64 p-4 md:p-6'}`}>
        <div className={`flex items-center justify-between gap-2 ${isMobile ? 'mb-4' : 'mb-6'}`}>
          <h1 className={`font-bold text-foreground min-w-0 truncate ${isMobile ? 'text-xl' : 'text-2xl md:text-3xl'}`}>{t('rush_orders')}</h1>
          
          {canCreateRushOrder && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-red-600 hover:bg-red-700 shrink-0" size={isMobile ? "sm" : "sm"}>
                  <Plus className={`${isMobile ? 'h-4 w-4' : 'mr-1.5 h-4 w-4'}`} />
                  {!isMobile && t('new_rush_order')}
                </Button>
              </DialogTrigger>
              <DialogContent className={`max-h-[90vh] overflow-auto overflow-x-hidden ${isMobile ? 'max-w-[calc(100vw-1.5rem)] w-[calc(100vw-1.5rem)] p-3' : 'max-w-4xl'}`}>
                <DialogHeader className={isMobile ? 'space-y-1' : ''}>
                  <DialogTitle className={isMobile ? 'text-base' : ''}>{t('create_new_rush_order')}</DialogTitle>
                  <DialogDescription className={isMobile ? 'text-xs' : ''}>
                    {t('create_new_rush_order_desc')}
                  </DialogDescription>
                </DialogHeader>
                <NewRushOrderForm onSuccess={handleCreateSuccess} />
              </DialogContent>
            </Dialog>
          )}
        </div>
        
        <Tabs defaultValue="pending" className={isMobile ? 'mb-4' : 'mb-6'}>
          <TabsList className={isMobile ? 'w-full grid grid-cols-3 h-11' : 'flex-wrap h-auto'}>
            <TabsTrigger value="pending" className={isMobile ? 'text-xs px-2 py-2' : 'text-xs sm:text-sm'}>
              {t('pending')} ({pendingCount})
            </TabsTrigger>
            <TabsTrigger value="in_progress" className={isMobile ? 'text-xs px-2 py-2' : 'text-xs sm:text-sm'}>
              {t('in_progress')} ({inProgressCount})
            </TabsTrigger>
            <TabsTrigger value="completed" className={isMobile ? 'text-xs px-2 py-2' : 'text-xs sm:text-sm'}>
              {t('completed')} ({completedCount})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className={isMobile ? 'mt-3' : 'mt-4 md:mt-6'}>
            <RushOrderList statusFilter="pending" />
          </TabsContent>
          <TabsContent value="in_progress" className={isMobile ? 'mt-3' : 'mt-4 md:mt-6'}>
            <RushOrderList statusFilter="in_progress" />
          </TabsContent>
          <TabsContent value="completed" className={isMobile ? 'mt-3' : 'mt-4 md:mt-6'}>
            <RushOrderList statusFilter="completed" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default RushOrders;
