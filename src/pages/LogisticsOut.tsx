
import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { orderService } from '@/services/orderService';
import { projectService } from '@/services/dataService';
import { Order } from '@/types/order';
import { Calendar } from "@/components/ui/calendar";
import { format } from 'date-fns';

type LogisticsOutOrder = Order & { project_name: string };

const LogisticsOut: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<LogisticsOutOrder[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    const loadLogisticsOutOrders = async () => {
      try {
        setLoading(true);
        const logisticsOutOrders = await orderService.getLogisticsOutOrders();
        
        const ordersWithProjectNames = await Promise.all(
          logisticsOutOrders.map(async (order) => {
            let projectName = "Unknown Project";
            try {
              const project = await projectService.getById(order.project_id);
              if (project) {
                projectName = project.name;
              }
            } catch (error) {
              console.error(`Error fetching project name for order ${order.id}:`, error);
            }
            return {
              ...order,
              project_name: projectName,
            };
          })
        );
        
        setOrders(ordersWithProjectNames);
      } catch (error: any) {
        toast({
          title: "Error",
          description: `Failed to load logistics out orders: ${error.message}`,
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadLogisticsOutOrders();
  }, [toast]);

  const ordersByDate = orders.reduce((acc, order) => {
    const date = new Date(order.expected_delivery);
    const dateKey = format(date, 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(order);
    return acc;
  }, {} as Record<string, LogisticsOutOrder[]>);
  
  const eventDays = Object.keys(ordersByDate).map(dateStr => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  });
  
  const selectedDayOrders = selectedDate ? ordersByDate[format(selectedDate, 'yyyy-MM-dd')] : [];

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
            <Navbar />
        </div>
        <div className="ml-64 w-full p-6 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
       <div className="w-64 bg-sidebar fixed top-0 bottom-0">
         <Navbar />
       </div>
      <div className="ml-64 w-full p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Logistics Out</h1>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="p-3"
                  modifiers={{ event: eventDays }}
                  modifiersClassNames={{
                    event: 'bg-sky-100 text-sky-800 rounded-md font-bold',
                  }}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  Details for {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : '...'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDayOrders && selectedDayOrders.length > 0 ? (
                  <ul className="space-y-2">
                    {selectedDayOrders.map(order => (
                      <li key={order.id} className="p-2 border rounded-md">
                        <p><strong>Project:</strong> {order.project_name}</p>
                        <p><strong>Supplier:</strong> {order.supplier}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No logistics out orders for this day.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogisticsOut;
