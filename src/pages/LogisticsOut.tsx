
import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { orderService } from '@/services/orderService';
import { projectService } from '@/services/dataService';
import { Order, OrderStep } from '@/types/order';
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns';
import { Search, Package, Truck, Calendar as CalendarIcon, Filter, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type LogisticsOutOrder = Order & { 
  project_name: string;
  processing_steps?: OrderStep[];
};

type CalendarEvent = {
  date: string;
  type: 'delivery' | 'step';
  order: LogisticsOutOrder;
  step?: OrderStep;
  title: string;
  description: string;
};

const LogisticsOut: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<LogisticsOutOrder[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    const loadLogisticsOutOrders = async () => {
      try {
        setLoading(true);
        const logisticsOutOrders = await orderService.getLogisticsOutOrders();
        
        const ordersWithDetails = await Promise.all(
          logisticsOutOrders.map(async (order) => {
            let projectName = "Unknown Project";
            let processingSteps: OrderStep[] = [];
            
            try {
              const project = await projectService.getById(order.project_id);
              if (project) {
                projectName = project.name;
              }
              
              // Fetch order processing steps
              processingSteps = await orderService.getOrderSteps(order.id);
            } catch (error) {
              console.error(`Error fetching details for order ${order.id}:`, error);
            }
            
            return {
              ...order,
              project_name: projectName,
              processing_steps: processingSteps,
            };
          })
        );
        
        setOrders(ordersWithDetails);
        generateCalendarEvents(ordersWithDetails);
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

  const generateCalendarEvents = (orders: LogisticsOutOrder[]) => {
    const events: CalendarEvent[] = [];
    
    orders.forEach(order => {
      // Add delivery event
      events.push({
        date: format(new Date(order.expected_delivery), 'yyyy-MM-dd'),
        type: 'delivery',
        order,
        title: `Delivery: ${order.project_name}`,
        description: `Expected delivery from ${order.supplier}`
      });
      
      // Add processing step events
      order.processing_steps?.forEach(step => {
        if (step.start_date) {
          events.push({
            date: format(new Date(step.start_date), 'yyyy-MM-dd'),
            type: 'step',
            order,
            step,
            title: `${step.name}`,
            description: `${order.project_name} - ${step.supplier || 'Internal'}`
          });
        }
        if (step.end_date) {
          events.push({
            date: format(new Date(step.end_date), 'yyyy-MM-dd'),
            type: 'step',
            order,
            step,
            title: `${step.name} Complete`,
            description: `${order.project_name} - ${step.supplier || 'Internal'}`
          });
        }
      });
    });
    
    setCalendarEvents(events);
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.supplier.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const eventDays = [...new Set(calendarEvents.map(event => event.date))].map(dateStr => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  });
  
  const selectedDayEvents = selectedDate ? 
    calendarEvents.filter(event => event.date === format(selectedDate, 'yyyy-MM-dd')) : [];

  const getEventPriority = (event: CalendarEvent) => {
    const date = new Date(event.date);
    if (isToday(date)) return 'urgent';
    if (isTomorrow(date)) return 'high';
    if (isPast(date)) return 'overdue';
    return 'normal';
  };

  const getEventColor = (event: CalendarEvent) => {
    const priority = getEventPriority(event);
    if (event.type === 'delivery') {
      switch (priority) {
        case 'urgent': return 'bg-red-500 text-white';
        case 'high': return 'bg-orange-500 text-white';
        case 'overdue': return 'bg-gray-500 text-white';
        default: return 'bg-blue-500 text-white';
      }
    } else {
      switch (priority) {
        case 'urgent': return 'bg-red-100 text-red-800 border-red-300';
        case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
        case 'overdue': return 'bg-gray-100 text-gray-800 border-gray-300';
        default: return 'bg-green-100 text-green-800 border-green-300';
      }
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingEvents = calendarEvents
    .filter(event => {
      const eventDate = new Date(event.date);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate >= today;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 10);

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
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Logistics Out</h1>
              <p className="text-gray-600 mt-1">Semi-finished product processing & delivery tracking</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="px-3 py-1">
                {filteredOrders.length} Orders
              </Badge>
              <Badge variant="outline" className="px-3 py-1">
                {calendarEvents.length} Events
              </Badge>
            </div>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search projects, suppliers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="md:w-48">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="delayed">Delayed</SelectItem>
                      <SelectItem value="canceled">Canceled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Calendar */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Processing Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="p-3"
                  modifiers={{ event: eventDays }}
                  modifiersClassNames={{
                    event: 'bg-sky-100 text-sky-800 rounded-md font-bold relative',
                  }}
                  weekStartsOn={1}
                />
              </CardContent>
            </Card>

            {/* Selected Day Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a date'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDayEvents && selectedDayEvents.length > 0 ? (
                  <div className="space-y-3">
                    {selectedDayEvents.map((event, index) => (
                      <div
                        key={`${event.order.id}-${index}`}
                        className={cn(
                          "p-3 rounded-lg border",
                          getEventColor(event)
                        )}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <Badge variant="outline" className="mb-1">
                            {event.type === 'delivery' ? 'Delivery' : 'Processing'}
                          </Badge>
                          {getEventPriority(event) === 'urgent' && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <h4 className="font-medium mb-1">{event.title}</h4>
                        <p className="text-sm opacity-90">{event.description}</p>
                        {event.step && (
                          <div className="mt-2 pt-2 border-t border-current/20">
                            <div className="flex items-center gap-2 text-xs">
                              <Badge 
                                variant={event.step.status === 'completed' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {event.step.status}
                              </Badge>
                              {event.step.expected_duration_days && (
                                <span className="text-xs opacity-75">
                                  {event.step.expected_duration_days} days
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <CalendarIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p>No events scheduled for this day</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Upcoming Events */}
          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Upcoming Events ({upcomingEvents.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingEvents.length > 0 ? (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {upcomingEvents.map((event, index) => (
                      <div
                        key={`${event.order.id}-${index}`}
                        className={cn(
                          "p-4 rounded-lg border",
                          getEventColor(event)
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="text-xs">
                            {event.type === 'delivery' ? 'Delivery' : 'Process'}
                          </Badge>
                          <span className="text-xs font-medium">
                            {format(new Date(event.date), 'MMM d')}
                          </span>
                        </div>
                        <h4 className="font-medium text-sm mb-1 truncate">{event.title}</h4>
                        <p className="text-xs opacity-90 line-clamp-2">{event.description}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Truck className="h-3 w-3" />
                          <span className="text-xs truncate">{event.order.supplier}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <Clock className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p>No upcoming events found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Orders Summary */}
          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Semi-Finished Orders Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredOrders.map(order => (
                    <div key={order.id} className="p-4 border rounded-lg bg-white">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                          {order.status}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {format(new Date(order.expected_delivery), 'MMM d')}
                        </span>
                      </div>
                      <h4 className="font-medium mb-1 truncate">{order.project_name}</h4>
                      <p className="text-sm text-gray-600 mb-2">{order.supplier}</p>
                      {order.processing_steps && order.processing_steps.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-gray-700">Processing Steps:</div>
                          {order.processing_steps.slice(0, 2).map(step => (
                            <div key={step.id} className="flex items-center gap-2 text-xs">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                step.status === 'completed' ? 'bg-green-500' :
                                step.status === 'in_progress' ? 'bg-blue-500' :
                                step.status === 'delayed' ? 'bg-red-500' : 'bg-gray-400'
                              )} />
                              <span className="truncate">{step.name}</span>
                            </div>
                          ))}
                          {order.processing_steps.length > 2 && (
                            <div className="text-xs text-gray-500">
                              +{order.processing_steps.length - 2} more steps
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogisticsOut;
