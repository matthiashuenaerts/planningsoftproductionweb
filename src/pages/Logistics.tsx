
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { orderService } from '@/services/orderService';
import { TodaysDeliveries } from '@/components/logistics/TodaysDeliveries';
import { UpcomingDeliveries } from '@/components/logistics/UpcomingDeliveries';
import { BackorderDeliveries } from '@/components/logistics/BackorderDeliveries';
import { Truck, Calendar, AlertTriangle, Search, Scan, Clock, PackageCheck } from 'lucide-react';
import { EanBarcodeScanner } from '@/components/logistics/EanBarcodeScanner';
import { Button } from '@/components/ui/button';
import { BatchReceiptsScanner } from '@/components/logistics/BatchReceiptsScanner';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/context/AuthContext';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/context/TenantContext';

const Logistics = () => {
  const { t } = useLanguage();
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isStartingRegistration, setIsStartingRegistration] = useState(false);
  const isMobile = useIsMobile();
  const { tenant } = useTenant();
  
  const {
    data: rawOrders = [],
    isLoading,
    refetch
  } = useQuery({
    queryKey: ['all-orders', tenant?.id],
    queryFn: () => orderService.getAllOrders(tenant?.id)
  });

  // Enhance orders with project names
  const {
    data: orders = []
  } = useQuery({
    queryKey: ['all-orders-with-projects', rawOrders],
    queryFn: async () => {
      if (!rawOrders.length) return [];
      const ordersWithProjects = await Promise.all(rawOrders.map(async order => {
        try {
          // Get project name from project_id
          const {
            data: projectData,
            error
          } = await supabase.from('projects').select('name').eq('id', order.project_id).single();
          if (error) {
            console.error('Error fetching project for order:', order.id, error);
            return {
              ...order,
              project_name: order.project_id // Fallback to showing the ID
            };
          }
          return {
            ...order,
            project_name: projectData?.name || order.project_id
          };
        } catch (error) {
          console.error('Error processing order:', order.id, error);
          return {
            ...order,
            project_name: order.project_id
          };
        }
      }));
      return ordersWithProjects;
    },
    enabled: rawOrders.length > 0
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Filter function for search
  const filterOrders = (orderList) => {
    if (!searchTerm) return orderList;

    const normalize = (val: any) => (val ?? '')
      .toString()
      .replace(/\s|-/g, '')
      .toLowerCase();

    const query = normalize(searchTerm);

    return orderList.filter(order => {
      // Check article codes and EAN codes in order items (normalized)
      const hasMatchingItem = order.order_items?.some(item =>
        normalize(item.article_code).includes(query) ||
        normalize(item.ean).includes(query)
      ) || false;

      return (
        normalize(order.project_name).includes(query) ||
        normalize(order.supplier).includes(query) ||
        normalize(order.notes).includes(query) ||
        normalize(order.id).includes(query) ||
        hasMatchingItem
      );
    });
  };

  // Filter orders by delivery status
  const todaysDeliveries = filterOrders(orders.filter(order => {
    const deliveryDate = new Date(order.expected_delivery);
    deliveryDate.setHours(0, 0, 0, 0);
    return deliveryDate.getTime() === today.getTime() && order.status !== 'delivered' && order.status !== 'charged';
  }));
  
  const upcomingDeliveries = filterOrders(orders.filter(order => {
    const deliveryDate = new Date(order.expected_delivery);
    return deliveryDate >= tomorrow && order.status !== 'delivered' && order.status !== 'charged';
  }));
  
  const backorderDeliveries = filterOrders(orders.filter(order => {
    const deliveryDate = new Date(order.expected_delivery);
    return deliveryDate < today && order.status !== 'delivered' && order.status !== 'charged';
  }));

  const handleDeliveryConfirmed = () => {
    refetch();
  };

  const handleStartTimeRegistration = async () => {
    if (!currentEmployee) {
      toast({
        title: "Error",
        description: "No employee found",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsStartingRegistration(true);
      
      // First, try to find the logistics workstation (case-insensitive)
      let { data: workstation, error: workstationError } = await supabase
        .from('workstations')
        .select('id, name')
        .ilike('name', 'logist%')
        .maybeSingle();
      if (workstationError) throw workstationError;

      // If not found, create it
      if (!workstation) {
        const { data: createdWs, error: createWsError } = await supabase
          .from('workstations')
          .insert({ name: 'Logistics', description: 'Logistics workstation' })
          .select('id, name')
          .single();
        if (createWsError) throw createWsError;
        workstation = createdWs;
      }

      // Find or create the workstation task
      let { data: workstationTask, error: taskError } = await supabase
        .from('workstation_tasks')
        .select('id')
        .eq('workstation_id', workstation.id)
        .eq('task_name', 'timeregistration logistics')
        .maybeSingle();
      if (taskError) throw taskError;

      if (!workstationTask) {
        const { data: createdTask, error: createTaskError } = await supabase
          .from('workstation_tasks')
          .insert({ workstation_id: workstation.id, task_name: 'timeregistration logistics' })
          .select('id')
          .single();
        if (createTaskError) throw createTaskError;
        workstationTask = createdTask;
      }

      await timeRegistrationService.startWorkstationTask(currentEmployee.id, workstationTask.id);

      // Ensure TaskTimer updates immediately
      queryClient.invalidateQueries({ queryKey: ['activeTimeRegistration'] });
      
      toast({
        title: "Success",
        description: "Time registration started"
      });
    } catch (error: any) {
      console.error('Error starting time registration:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to start time registration",
        variant: "destructive"
      });
    } finally {
      setIsStartingRegistration(false);
    }
  };

  const handleEanDetected = (ean: string) => {
    setSearchTerm(ean);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        {!isMobile && (
          <div className="w-64 bg-sidebar fixed top-0 bottom-0">
            <Navbar />
          </div>
        )}
        {isMobile && <Navbar />}
        <div className={`flex-1 p-6 ${!isMobile ? 'ml-64' : 'pt-16'}`}>
          <div>{t("loading")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {!isMobile && (
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
      )}
      {isMobile && <Navbar />}
      <div className={`flex-1 max-w-none ${isMobile ? 'pt-16 px-3 pb-4' : 'ml-64 p-6'}`}>
        <div className={isMobile ? 'mb-4' : 'mb-8'}>
          <h1 className={`font-bold text-foreground ${isMobile ? 'text-xl' : 'text-3xl'}`}>{t("logistics_title")}</h1>
          {!isMobile && <p className="text-muted-foreground mt-2">{t("logistics_description")}</p>}
        </div>

        <div className={`grid grid-cols-3 ${isMobile ? 'gap-2 mb-4' : 'gap-6 mb-8'}`}>
          <Card className={isMobile ? 'shadow-sm' : ''}>
            <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${isMobile ? 'px-3 pt-3 pb-1' : 'pb-2'}`}>
              <CardTitle className={`font-medium ${isMobile ? 'text-[10px] leading-tight' : 'text-sm'}`}>{t("todays_deliveries")}</CardTitle>
              <Truck className={`text-muted-foreground shrink-0 ${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
            </CardHeader>
            <CardContent className={isMobile ? 'px-3 pb-3' : ''}>
              <div className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>{todaysDeliveries.length}</div>
              {!isMobile && <p className="text-xs text-muted-foreground">{t("orders_expected_today")}</p>}
            </CardContent>
          </Card>

          <Card className={isMobile ? 'shadow-sm' : ''}>
            <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${isMobile ? 'px-3 pt-3 pb-1' : 'pb-2'}`}>
              <CardTitle className={`font-medium ${isMobile ? 'text-[10px] leading-tight' : 'text-sm'}`}>{t("upcoming_deliveries")}</CardTitle>
              <Calendar className={`text-muted-foreground shrink-0 ${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
            </CardHeader>
            <CardContent className={isMobile ? 'px-3 pb-3' : ''}>
              <div className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>{upcomingDeliveries.length}</div>
              {!isMobile && <p className="text-xs text-muted-foreground">{t("future_deliveries")}</p>}
            </CardContent>
          </Card>

          <Card className={isMobile ? 'shadow-sm' : ''}>
            <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${isMobile ? 'px-3 pt-3 pb-1' : 'pb-2'}`}>
              <CardTitle className={`font-medium ${isMobile ? 'text-[10px] leading-tight' : 'text-sm'}`}>{t("backorder_deliveries")}</CardTitle>
              <AlertTriangle className={`text-muted-foreground shrink-0 ${isMobile ? 'h-3 w-3' : 'h-4 w-4'}`} />
            </CardHeader>
            <CardContent className={isMobile ? 'px-3 pb-3' : ''}>
              <div className={`font-bold ${isMobile ? 'text-lg' : 'text-2xl'}`}>{backorderDeliveries.length}</div>
              {!isMobile && <p className="text-xs text-muted-foreground">{t("overdue_deliveries")}</p>}
            </CardContent>
          </Card>
        </div>

        <div className={isMobile ? 'mb-3' : 'mb-6'}>
          <div className={`flex ${isMobile ? 'flex-col gap-2 mb-3' : 'flex-wrap gap-2 mb-6'}`}>
            <div className={`relative ${isMobile ? 'w-full' : 'flex-1 min-w-[200px]'}`}>
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Search by project, supplier, EAN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-10 ${isMobile ? 'h-9 text-sm' : ''}`}
              />
            </div>
            <div className={`flex gap-2 ${isMobile ? 'w-full' : ''}`}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsScannerOpen(true)}
                className={`flex items-center gap-1.5 ${isMobile ? 'flex-1 h-9 text-xs justify-center' : 'whitespace-nowrap'}`}
              >
                <Scan className={isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                {isMobile ? 'Scan' : t('br_scan_barcode')}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsBatchOpen(true)}
                className={`flex items-center gap-1.5 ${isMobile ? 'flex-1 h-9 text-xs justify-center' : 'whitespace-nowrap'}`}
              >
                <PackageCheck className={isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                {isMobile ? 'Batch' : t('br_batch_receipts')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleStartTimeRegistration}
                disabled={isStartingRegistration}
                className={`flex items-center gap-1.5 ${isMobile ? 'flex-1 h-9 text-xs justify-center' : 'whitespace-nowrap'}`}
              >
                <Clock className={isMobile ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                {isMobile ? <span className="sr-only">{t("start_time_registration")}</span> : t("start_time_registration")}
                {isMobile && 'Time'}
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="today" className={isMobile ? 'space-y-2' : 'space-y-4'}>
          <TabsList className={isMobile ? 'w-full grid grid-cols-3 h-9' : ''}>
            <TabsTrigger value="today" className={isMobile ? 'text-[11px] px-1' : ''}>{isMobile ? t("todays_deliveries") : t("todays_deliveries")}</TabsTrigger>
            <TabsTrigger value="upcoming" className={isMobile ? 'text-[11px] px-1' : ''}>{isMobile ? t("upcoming_deliveries") : t("upcoming_deliveries")}</TabsTrigger>
            <TabsTrigger value="backorders" className={isMobile ? 'text-[11px] px-1' : ''}>{isMobile ? t("backorder_deliveries") : t("backorder_deliveries")}</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="space-y-4">
            <TodaysDeliveries orders={todaysDeliveries} onDeliveryConfirmed={handleDeliveryConfirmed} />
          </TabsContent>

          <TabsContent value="upcoming" className="space-y-4">
            <UpcomingDeliveries orders={upcomingDeliveries} onDeliveryConfirmed={handleDeliveryConfirmed} />
          </TabsContent>

          <TabsContent value="backorders" className="space-y-4">
            <BackorderDeliveries orders={backorderDeliveries} onDeliveryConfirmed={handleDeliveryConfirmed} />
          </TabsContent>
        </Tabs>

        <EanBarcodeScanner
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onEanDetected={handleEanDetected}
        />

        <BatchReceiptsScanner
          isOpen={isBatchOpen}
          onClose={() => setIsBatchOpen(false)}
          onReceiptsConfirmed={handleDeliveryConfirmed}
        />
      </div>
    </div>
  );
};

export default Logistics;
