import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Clock, User, Calendar, MoreVertical, Play, Pause, Square, CheckSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import TaskTimer from '@/components/TaskTimer';
import Navbar from '@/components/Navbar';
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface ProjectOrder {
  id: string;
  project_id: string;
  order_number: string;
  description: string;
  created_at: string;
  updated_at: string;
  orderItems?: OrderItem[];
}

interface OrderItem {
  id: string;
  project_order_id: string;
  article_code: string;
  description: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

const ProjectOrders = () => {
  const [orders, setOrders] = useState<ProjectOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { currentEmployee } = useAuth();

  useEffect(() => {
    const fetchProjectOrders = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('project_orders')
          .select(`
            *,
            orderItems:project_order_items(*)
          `)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setOrders(data || []);
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
  }, [toast, currentEmployee]);

  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      <div className="ml-64 w-full p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Project Orders</h1>
            <p className="text-slate-600 mt-1">Manage project-specific orders and track order items</p>
          </div>

          <div className="space-y-6">
            {orders.map((order) => (
              <Card key={order.id}>
                <CardHeader>
                  <CardTitle>Order Number: {order.order_number}</CardTitle>
                  <CardDescription>
                    {order.description || 'No description provided'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Project ID</Label>
                        <Input type="text" value={order.project_id} readOnly />
                      </div>
                      <div>
                        <Label>Created At</Label>
                        <Input type="text" value={format(new Date(order.created_at), 'MMM dd, yyyy - HH:mm')} readOnly />
                      </div>
                    </div>
                    
                    {order.orderItems && order.orderItems.length > 0 && (
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
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8 text-center text-muted-foreground">
            {orders.length === 0 && !loading ? 'No project orders found.' : null}
            {loading ? 'Loading project orders...' : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectOrders;
