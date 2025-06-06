import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, ArrowLeft, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import Navbar from '@/components/Navbar';
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from 'react-router-dom';

interface Order {
  id: string;
  project_id: string;
  supplier: string;
  order_date: string;
  expected_delivery: string;
  status: 'pending' | 'delivered' | 'canceled' | 'delayed';
  created_at: string;
  updated_at: string;
  orderItems?: OrderItem[];
}

interface OrderItem {
  id: string;
  order_id: string;
  description: string;
  quantity: number;
  article_code: string | null;
  unit_price: number | null;
  total_price: number | null;
  created_at: string;
  updated_at: string;
}

const ProjectOrders = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { currentEmployee } = useAuth();

  useEffect(() => {
    const fetchProjectOrders = async () => {
      try {
        setLoading(true);
        
        if (!projectId) {
          throw new Error('Project ID is required');
        }

        // Fetch orders for the specific project
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false });
        
        if (ordersError) throw ordersError;

        // Fetch order items for each order
        const ordersWithItems = await Promise.all(
          (ordersData || []).map(async (order) => {
            const { data: itemsData, error: itemsError } = await supabase
              .from('order_items')
              .select('*')
              .eq('order_id', order.id);
            
            if (itemsError) {
              console.error('Error fetching order items:', itemsError);
              return { 
                ...order, 
                status: order.status as 'pending' | 'delivered' | 'canceled' | 'delayed',
                orderItems: [] 
              };
            }
            
            return { 
              ...order, 
              status: order.status as 'pending' | 'delivered' | 'canceled' | 'delayed',
              orderItems: itemsData || [] 
            };
          })
        );

        setOrders(ordersWithItems);
      } catch (error: any) {
        console.error('Error fetching project orders:', error);
        toast({
          title: 'Error',
          description: `Failed to load project orders: ${error.message}`,
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProjectOrders();
  }, [projectId, toast, currentEmployee]);

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Pending</Badge>;
      case 'delivered':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Delivered</Badge>;
      case 'canceled':
        return <Badge className="bg-red-100 text-red-800 border-red-300">Canceled</Badge>;
      case 'delayed':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-300">Delayed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      <div className="ml-64 w-full p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <Button 
              variant="outline" 
              onClick={() => navigate(`/projects/${projectId}`)}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Project
            </Button>
            
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-6 w-6" />
              <h1 className="text-3xl font-bold">Project Orders</h1>
            </div>
            <p className="text-slate-600">Orders for this project</p>
          </div>

          <div className="space-y-6">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : orders.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">No orders found for this project.</p>
                </CardContent>
              </Card>
            ) : (
              orders.map((order) => (
                <Card key={order.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>Order from {order.supplier}</CardTitle>
                        <CardDescription>
                          Ordered on {format(new Date(order.order_date), 'MMM dd, yyyy')}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(order.status)}
                        <div className="text-sm text-muted-foreground">
                          Expected: {format(new Date(order.expected_delivery), 'MMM dd, yyyy')}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {order.orderItems && order.orderItems.length > 0 ? (
                      <div>
                        <h4 className="text-md font-semibold mb-2">Order Items</h4>
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Article Code</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Quantity</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {order.orderItems.map((item) => (
                                <TableRow key={item.id}>
                                  <TableCell className="font-medium">
                                    {item.article_code || 'N/A'}
                                  </TableCell>
                                  <TableCell>{item.description}</TableCell>
                                  <TableCell className="text-right">{item.quantity}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No items found for this order.</p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectOrders;
