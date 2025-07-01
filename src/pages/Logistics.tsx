
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { orderService } from '@/services/orderService';
import { TodaysDeliveries } from '@/components/logistics/TodaysDeliveries';
import { UpcomingDeliveries } from '@/components/logistics/UpcomingDeliveries';
import { BackorderDeliveries } from '@/components/logistics/BackorderDeliveries';
import { Truck, Calendar, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';

const Logistics = () => {
  const { t } = useLanguage();
  
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

  // Filter orders by delivery status
  const todaysDeliveries = orders.filter(order => {
    const deliveryDate = new Date(order.expected_delivery);
    deliveryDate.setHours(0, 0, 0, 0);
    return deliveryDate.getTime() === today.getTime() && order.status !== 'delivered';
  });
  
  const upcomingDeliveries = orders.filter(order => {
    const deliveryDate = new Date(order.expected_delivery);
    return deliveryDate >= tomorrow && order.status !== 'delivered';
  });
  
  const backorderDeliveries = orders.filter(order => {
    const deliveryDate = new Date(order.expected_delivery);
    return deliveryDate < today && order.status !== 'delivered';
  });

  const handleDeliveryConfirmed = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div>{t("loading")}</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-none">
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
      </div>
    </AppLayout>
  );
};

export default Logistics;
