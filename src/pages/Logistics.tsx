
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { orderService } from '@/services/orderService';
import { TodaysDeliveries } from '@/components/logistics/TodaysDeliveries';
import { UpcomingDeliveries } from '@/components/logistics/UpcomingDeliveries';
import { BackorderDeliveries } from '@/components/logistics/BackorderDeliveries';
import { Truck, Calendar, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { OrderItem } from '@/types/order';
import { format } from 'date-fns';

const Logistics = () => {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  
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
      } catch (error: any) {
        console.error("Failed to load order details:", error);
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

  if (isLoading) {
    return <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="ml-64 container mx-auto px-4 py-8">
          <div>Loading...</div>
        </div>
      </div>;
  }

  return <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="ml-64 w-full p-6">
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
            <TabsTrigger value="all">All Orders</TabsTrigger>
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

          <TabsContent value="all" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Orders</CardTitle>
                <CardDescription>View all orders with project names and details</CardDescription>
              </CardHeader>
              <CardContent>
                {orders.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]"></TableHead>
                          <TableHead>Project</TableHead>
                          <TableHead>Supplier</TableHead>
                          <TableHead>Order Date</TableHead>
                          <TableHead>Expected Delivery</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order) => (
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
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  order.status === 'pending' ? 'bg-blue-100 text-blue-800' :
                                  order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                                  order.status === 'canceled' ? 'bg-red-100 text-red-800' :
                                  order.status === 'delayed' ? 'bg-amber-100 text-amber-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {order.status}
                                </span>
                              </TableCell>
                            </TableRow>
                            
                            {expandedOrder === order.id && (
                              <TableRow>
                                <TableCell colSpan={6} className="p-0">
                                  <div className="bg-muted/30 p-4">
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
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right">Quantity</TableHead>
                                            <TableHead className="text-right">Unit Price</TableHead>
                                            <TableHead className="text-right">Total Price</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {orderItems[order.id].map((item) => (
                                            <TableRow key={item.id}>
                                              <TableCell>{item.description}</TableCell>
                                              <TableCell className="text-right">{item.quantity}</TableCell>
                                              <TableCell className="text-right">${item.unit_price}</TableCell>
                                              <TableCell className="text-right">${item.total_price}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    )}
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
                  <div className="p-6 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <p className="text-muted-foreground">No orders found.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>;
};

export default Logistics;
