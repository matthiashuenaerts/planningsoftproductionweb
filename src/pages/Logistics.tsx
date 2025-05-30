
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { orderService } from '@/services/orderService';
import { TodaysDeliveries } from '@/components/logistics/TodaysDeliveries';
import { UpcomingDeliveries } from '@/components/logistics/UpcomingDeliveries';
import { BackorderDeliveries } from '@/components/logistics/BackorderDeliveries';
import { Truck, Calendar, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Logistics = () => {
  const { data: rawOrders = [], isLoading, refetch } = useQuery({
    queryKey: ['all-orders'],
    queryFn: () => orderService.getAllOrders(),
  });

  // Enhance orders with project names
  const { data: orders = [] } = useQuery({
    queryKey: ['all-orders-with-projects', rawOrders],
    queryFn: async () => {
      if (!rawOrders.length) return [];
      
      const ordersWithProjects = await Promise.all(
        rawOrders.map(async (order) => {
          try {
            // Get project name from project_id
            const { data: projectData, error } = await supabase
              .from('projects')
              .select('name')
              .eq('id', order.project_id)
              .single();
            
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
        })
      );
      
      return ordersWithProjects;
    },
    enabled: rawOrders.length > 0,
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
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="ml-64 container mx-auto px-4 py-8">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="ml-64 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Logistics</h1>
          <p className="text-gray-600 mt-2">Manage deliveries and order logistics</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Deliveries</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{todaysDeliveries.length}</div>
              <p className="text-xs text-muted-foreground">
                Orders expected today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{upcomingDeliveries.length}</div>
              <p className="text-xs text-muted-foreground">
                Future deliveries
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Backorders</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{backorderDeliveries.length}</div>
              <p className="text-xs text-muted-foreground">
                Overdue deliveries
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="today" className="space-y-4">
          <TabsList>
            <TabsTrigger value="today">Today's Deliveries</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming Deliveries</TabsTrigger>
            <TabsTrigger value="backorders">Backorders</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="space-y-4">
            <TodaysDeliveries 
              orders={todaysDeliveries} 
              onDeliveryConfirmed={handleDeliveryConfirmed}
            />
          </TabsContent>

          <TabsContent value="upcoming" className="space-y-4">
            <UpcomingDeliveries 
              orders={upcomingDeliveries}
              onDeliveryConfirmed={handleDeliveryConfirmed}
            />
          </TabsContent>

          <TabsContent value="backorders" className="space-y-4">
            <BackorderDeliveries 
              orders={backorderDeliveries}
              onDeliveryConfirmed={handleDeliveryConfirmed}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Logistics;
