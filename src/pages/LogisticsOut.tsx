
import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { orderService } from '@/services/orderService';
import { projectService } from '@/services/dataService';
import { Order } from '@/types/order';
import { Calendar } from "@/components/ui/calendar";
import { format } from 'date-fns';
import { useLanguage } from '@/context/LanguageContext';

type LogisticsOutOrder = Order & { project_name: string };

const LogisticsOut: React.FC = () => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<LogisticsOutOrder[]>([]);
  const [semiFinishedSteps, setSemiFinishedSteps] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    const loadLogisticsOutData = async () => {
      try {
        setLoading(true);
        
        // Load logistics out orders
        const logisticsOutOrders = await orderService.getLogisticsOutOrders();
        
        // Load semi-finished product processing steps
        const semiFinishedOrders = await orderService.getSemiFinishedOrders();
        const stepsData = [];
        
        for (const order of semiFinishedOrders) {
          try {
            const steps = await orderService.getOrderSteps(order.id);
            const project = await projectService.getById(order.project_id);
            
            for (const step of steps) {
              stepsData.push({
                ...step,
                project_name: project?.name || "Unknown Project",
                order_supplier: order.supplier,
                order_id: order.id
              });
            }
          } catch (error) {
            console.error(`Error fetching steps for order ${order.id}:`, error);
          }
        }
        
        setSemiFinishedSteps(stepsData);
        
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
          title: t('error'),
          description: `${t('failed_to_load_logistics_out')}: ${error.message}`,
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadLogisticsOutData();
  }, [toast, t]);

  // Combine orders and semi-finished steps by date
  const allEventsByDate = [...orders, ...semiFinishedSteps].reduce((acc, item) => {
    let date;
    if ('expected_delivery' in item) {
      date = new Date(item.expected_delivery);
    } else if ('end_date' in item && item.end_date) {
      date = new Date(item.end_date);
    } else if ('start_date' in item && item.start_date) {
      date = new Date(item.start_date);
    } else {
      return acc;
    }
    
    const dateKey = format(date, 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(item);
    return acc;
  }, {} as Record<string, any[]>);
  
  const eventDays = Object.keys(allEventsByDate).map(dateStr => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  });
  
  const selectedDayEvents = selectedDate ? allEventsByDate[format(selectedDate, 'yyyy-MM-dd')] : [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingEvents = [...orders, ...semiFinishedSteps]
    .filter(item => {
      let eventDate;
      if ('expected_delivery' in item) {
        eventDate = new Date(item.expected_delivery);
      } else if ('end_date' in item && item.end_date) {
        eventDate = new Date(item.end_date);
      } else if ('start_date' in item && item.start_date) {
        eventDate = new Date(item.start_date);
      } else {
        return false;
      }
      
      eventDate.setHours(0, 0, 0, 0);
      return eventDate >= today;
    })
    .sort((a, b) => {
      const dateA = 'expected_delivery' in a ? new Date(a.expected_delivery) : 
                   ('end_date' in a && a.end_date) ? new Date(a.end_date) : new Date(a.start_date);
      const dateB = 'expected_delivery' in b ? new Date(b.expected_delivery) : 
                   ('end_date' in b && b.end_date) ? new Date(b.end_date) : new Date(b.start_date);
      return dateA.getTime() - dateB.getTime();
    });

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
          <h1 className="text-2xl font-bold mb-6">{t('logistics_out')}</h1>
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
                  weekStartsOn={1}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>
                  {t('details_for_date', { date: selectedDate ? format(selectedDate, 'MMMM d, yyyy') : '...' })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDayEvents && selectedDayEvents.length > 0 ? (
                  <ul className="space-y-2">
                    {selectedDayEvents.map((event, index) => (
                      <li key={`${event.id}-${index}`} className="p-2 border rounded-md">
                        <p><strong>{t('project')}:</strong> {event.project_name}</p>
                        {'supplier' in event ? (
                          <p><strong>{t('supplier')}:</strong> {event.supplier}</p>
                        ) : (
                          <>
                            <p><strong>{t('step')}:</strong> {event.name}</p>
                            <p><strong>{t('supplier')}:</strong> {event.order_supplier}</p>
                            <p><strong>{t('status')}:</strong> {event.status}</p>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">{t('no_logistics_events_for_day')}</p>
                )}
              </CardContent>
            </Card>
          </div>
          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('upcoming_deadlines')}</CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingEvents.length > 0 ? (
                  <ul className="space-y-4">
                    {upcomingEvents.map((event, index) => (
                      <li key={`${event.id}-${index}`} className="p-3 border rounded-md">
                        <p><strong>{t('project')}:</strong> {event.project_name}</p>
                        {'supplier' in event ? (
                          <>
                            <p><strong>{t('supplier')}:</strong> {event.supplier}</p>
                            <p><strong>{t('expected_delivery')}:</strong> {format(new Date(event.expected_delivery), 'MMMM d, yyyy')}</p>
                          </>
                        ) : (
                          <>
                            <p><strong>{t('step')}:</strong> {event.name}</p>
                            <p><strong>{t('supplier')}:</strong> {event.order_supplier}</p>
                            <p><strong>{t('status')}:</strong> {event.status}</p>
                            <p><strong>{t('date')}:</strong> {format(new Date(event.end_date || event.start_date), 'MMMM d, yyyy')}</p>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">{t('no_upcoming_deadlines')}</p>
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
