
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { format, parseISO, isToday, isTomorrow, isPast, addDays } from 'date-fns';
import { Search, Package, Truck, Calendar as CalendarIcon, Filter, Clock, AlertTriangle, ExternalLink, FileText, Barcode, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProjectBarcodeDialog } from '@/components/ProjectBarcodeDialog';
import ProjectFilesPopup from '@/components/ProjectFilesPopup';
import { PartsListDialog } from '@/components/PartsListDialog';

type LogisticsOutOrder = Order & { 
  project_name: string;
  processing_steps?: OrderStep[];
};

type CalendarEvent = {
  date: string;
  type: 'start' | 'return';
  order: LogisticsOutOrder;
  step: OrderStep;
  title: string;
  description: string;
  expectedReturnDate?: string;
};

const LogisticsOut: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<LogisticsOutOrder[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const [showFilesDialog, setShowFilesDialog] = useState(false);
  const [showPartsDialog, setShowPartsDialog] = useState(false);
  const [selectedProject, setSelectedProject] = useState<{ id: string; name: string } | null>(null);

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
              
              // Fetch order processing steps and filter for external steps with start dates
              const allSteps = await orderService.getOrderSteps(order.id);
              processingSteps = allSteps.filter(step => 
                step.supplier && step.supplier.trim() !== '' && step.start_date
              );
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
        
        // Filter orders that have external processing steps
        const filteredOrders = ordersWithDetails.filter(order => 
          order.processing_steps && order.processing_steps.length > 0
        );
        
        setOrders(filteredOrders);
        generateCalendarEvents(filteredOrders);
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
      // Add external processing step events with start dates
      order.processing_steps?.forEach(step => {
        if (step.start_date && step.supplier) {
          // Add start date event
          const startDate = format(new Date(step.start_date), 'yyyy-MM-dd');
          events.push({
            date: startDate,
            type: 'start',
            order,
            step,
            title: `Start: ${step.name}`,
            description: `${order.project_name} - ${step.supplier}`
          });
          
          // Calculate and add expected return date if duration is provided
          if (step.expected_duration_days) {
            const returnDate = addDays(new Date(step.start_date), step.expected_duration_days);
            const returnDateStr = format(returnDate, 'yyyy-MM-dd');
            events.push({
              date: returnDateStr,
              type: 'return',
              order,
              step,
              title: `Return: ${step.name}`,
              description: `${order.project_name} - ${step.supplier}`,
              expectedReturnDate: returnDateStr
            });
          }
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
    if (event.type === 'start') {
      switch (priority) {
        case 'urgent': return 'bg-blue-600 text-white';
        case 'high': return 'bg-blue-500 text-white';
        case 'overdue': return 'bg-gray-500 text-white';
        default: return 'bg-blue-400 text-white';
      }
    } else {
      switch (priority) {
        case 'urgent': return 'bg-green-600 text-white';
        case 'high': return 'bg-green-500 text-white';
        case 'overdue': return 'bg-red-500 text-white';
        default: return 'bg-green-400 text-white';
      }
    }
  };

  const handleProjectNavigation = (projectId: string) => {
    navigate(`/nl/projects/${projectId}`);
  };

  const handleShowBarcode = (projectId: string, projectName: string) => {
    setSelectedProject({ id: projectId, name: projectName });
    setShowBarcodeDialog(true);
  };

  const handleShowFiles = (projectId: string, projectName: string) => {
    setSelectedProject({ id: projectId, name: projectName });
    setShowFilesDialog(true);
  };

  const handleShowParts = (projectId: string, projectName: string) => {
    setSelectedProject({ id: projectId, name: projectName });
    setShowPartsDialog(true);
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
              <p className="text-gray-600 mt-1">External processing & return tracking</p>
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
                  External Processing Timeline
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
                            {event.type === 'start' ? 'Start' : 'Return'}
                          </Badge>
                          {getEventPriority(event) === 'urgent' && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <h4 className="font-medium mb-1">{event.title}</h4>
                        <p className="text-sm opacity-90">{event.description}</p>
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
                          <div className="flex gap-1 mt-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleProjectNavigation(event.order.project_id)}
                              className="text-xs h-6 px-2"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleShowFiles(event.order.project_id, event.order.project_name)}
                              className="text-xs h-6 px-2"
                            >
                              <FileText className="h-3 w-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleShowBarcode(event.order.project_id, event.order.project_name)}
                              className="text-xs h-6 px-2"
                            >
                              <Barcode className="h-3 w-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleShowParts(event.order.project_id, event.order.project_name)}
                              className="text-xs h-6 px-2"
                            >
                              <List className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <CalendarIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p>No external processing events for this day</p>
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
                  Upcoming External Processing Events ({upcomingEvents.length})
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
                            {event.type === 'start' ? 'Start' : 'Return'}
                          </Badge>
                          <span className="text-xs font-medium">
                            {format(new Date(event.date), 'MMM d')}
                          </span>
                        </div>
                        <h4 className="font-medium text-sm mb-1 truncate">{event.title}</h4>
                        <p className="text-xs opacity-90 line-clamp-2">{event.description}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Truck className="h-3 w-3" />
                          <span className="text-xs truncate">{event.step.supplier}</span>
                        </div>
                        <div className="flex gap-1 mt-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleProjectNavigation(event.order.project_id)}
                            className="text-xs h-6 px-2 flex-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleShowFiles(event.order.project_id, event.order.project_name)}
                            className="text-xs h-6 px-2 flex-1"
                          >
                            <FileText className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleShowBarcode(event.order.project_id, event.order.project_name)}
                            className="text-xs h-6 px-2 flex-1"
                          >
                            <Barcode className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleShowParts(event.order.project_id, event.order.project_name)}
                            className="text-xs h-6 px-2 flex-1"
                          >
                            <List className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <Clock className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p>No upcoming external processing events</p>
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
                  External Processing Orders Summary
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
                        <div className="space-y-1 mb-3">
                          <div className="text-xs font-medium text-gray-700">External Steps:</div>
                          {order.processing_steps.slice(0, 2).map(step => (
                            <div key={step.id} className="flex items-center gap-2 text-xs">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                step.status === 'completed' ? 'bg-green-500' :
                                step.status === 'in_progress' ? 'bg-blue-500' :
                                step.status === 'delayed' ? 'bg-red-500' : 'bg-gray-400'
                              )} />
                              <span className="truncate">{step.name}</span>
                              <span className="text-gray-500">({step.supplier})</span>
                            </div>
                          ))}
                          {order.processing_steps.length > 2 && (
                            <div className="text-xs text-gray-500">
                              +{order.processing_steps.length - 2} more steps
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleProjectNavigation(order.project_id)}
                          className="text-xs h-7 px-2 flex-1"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Project
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleShowFiles(order.project_id, order.project_name)}
                          className="text-xs h-7 px-2 flex-1"
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          Files
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleShowBarcode(order.project_id, order.project_name)}
                          className="text-xs h-7 px-2 flex-1"
                        >
                          <Barcode className="h-3 w-3 mr-1" />
                          Code
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleShowParts(order.project_id, order.project_name)}
                          className="text-xs h-7 px-2 flex-1"
                        >
                          <List className="h-3 w-3 mr-1" />
                          Parts
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {selectedProject && (
        <>
          <ProjectBarcodeDialog
            isOpen={showBarcodeDialog}
            onClose={() => setShowBarcodeDialog(false)}
            projectId={selectedProject.id}
            projectName={selectedProject.name}
          />
          
          <ProjectFilesPopup
            isOpen={showFilesDialog}
            onClose={() => setShowFilesDialog(false)}
            projectId={selectedProject.id}
            projectName={selectedProject.name}
          />
          
          <PartsListDialog
            isOpen={showPartsDialog}
            onClose={() => setShowPartsDialog(false)}
            projectId={selectedProject.id}
          />
        </>
      )}
    </div>
  );
};

export default LogisticsOut;
