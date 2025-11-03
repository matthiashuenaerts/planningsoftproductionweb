
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { orderService } from '@/services/orderService';
import { TodaysDeliveries } from '@/components/logistics/TodaysDeliveries';
import { UpcomingDeliveries } from '@/components/logistics/UpcomingDeliveries';
import { BackorderDeliveries } from '@/components/logistics/BackorderDeliveries';
import { Truck, Calendar, AlertTriangle, Search, Scan, Clock } from 'lucide-react';
import { EanBarcodeScanner } from '@/components/logistics/EanBarcodeScanner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/context/AuthContext';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { useToast } from '@/hooks/use-toast';

const Logistics = () => {
  const { t } = useLanguage();
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isStartingRegistration, setIsStartingRegistration] = useState(false);
  const isMobile = useIsMobile();
  
  const {
    data: rawOrders = [],
    isLoading,
    refetch
  } = useQuery({
    queryKey: ['all-orders'],
    queryFn: () => orderService.getAllOrders()
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
    return deliveryDate.getTime() === today.getTime() && (searchTerm ? true : (order.status !== 'delivered' && order.status !== 'charged'));
  }));
  
  const upcomingDeliveries = filterOrders(orders.filter(order => {
    const deliveryDate = new Date(order.expected_delivery);
    return deliveryDate >= tomorrow && (searchTerm ? true : (order.status !== 'delivered' && order.status !== 'charged'));
  }));
  
  const backorderDeliveries = filterOrders(orders.filter(order => {
    const deliveryDate = new Date(order.expected_delivery);
    return deliveryDate < today && (searchTerm ? true : (order.status !== 'delivered' && order.status !== 'charged'));
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
      
      // First, find the logistics workstation by name
      const { data: workstation, error: workstationError } = await supabase
        .from('workstations')
        .select('id')
        .eq('name', 'Logistics')
        .maybeSingle();
      
      if (workstationError) throw workstationError;
      
      if (!workstation) {
        toast({
          title: "Error",
          description: "Logistics workstation not found",
          variant: "destructive"
        });
        return;
      }

      // Then find the workstation task
      const { data: workstationTask, error: taskError } = await supabase
        .from('workstation_tasks')
        .select('id')
        .eq('workstation_id', workstation.id)
        .eq('task_name', 'timeregistration logistics')
        .maybeSingle();
      
      if (taskError) throw taskError;
      
      if (!workstationTask) {
        toast({
          title: "Error",
          description: "Logistics time registration task not found",
          variant: "destructive"
        });
        return;
      }

      await timeRegistrationService.startWorkstationTask(currentEmployee.id, workstationTask.id);
      
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
        <div className={`flex-1 p-6 ${!isMobile ? 'ml-64' : ''}`}>
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
      <div className={`flex-1 p-6 max-w-none ${!isMobile ? 'ml-64' : ''}`}>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t("logistics_title")}</h1>
          <p className="text-gray-600 mt-2">{t("logistics_description")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("todays_deliveries")}</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todaysDeliveries.length}</div>
              <p className="text-xs text-muted-foreground">
                {t("orders_expected_today")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("upcoming_deliveries")}</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{upcomingDeliveries.length}</div>
              <p className="text-xs text-muted-foreground">
                {t("future_deliveries")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("backorder_deliveries")}</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{backorderDeliveries.length}</div>
              <p className="text-xs text-muted-foreground">
                {t("overdue_deliveries")}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6">
          <div className="flex gap-2 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Search by project, supplier, article code, EAN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center gap-2"
            >
              <Scan className="h-4 w-4" />
              Scan Barcode
            </Button>
            <Button
              onClick={handleStartTimeRegistration}
              disabled={isStartingRegistration}
              className="flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              {t("start_time_registration")}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="today" className="space-y-4">
          <TabsList>
            <TabsTrigger value="today">{t("todays_deliveries")}</TabsTrigger>
            <TabsTrigger value="upcoming">{t("upcoming_deliveries")}</TabsTrigger>
            <TabsTrigger value="backorders">{t("backorder_deliveries")}</TabsTrigger>
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
      </div>
    </div>
  );
};

export default Logistics;
