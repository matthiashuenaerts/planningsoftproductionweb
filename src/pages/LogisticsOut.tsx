
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
import { OrderPartsListEditor } from '@/components/OrderPartsListEditor';
import { useLanguage } from '@/context/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDrawerLayout } from '@/hooks/useDrawerLayout';

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
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const drawerLayout = useDrawerLayout();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<LogisticsOutOrder[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [showBarcodeDialog, setShowBarcodeDialog] = useState(false);
  const [showFilesDialog, setShowFilesDialog] = useState(false);
  const [showPartsDialog, setShowPartsDialog] = useState(false);
  const [showOrderPartsDialog, setShowOrderPartsDialog] = useState(false);
  const [selectedProject, setSelectedProject] = useState<{ id: string; name: string } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<{ id: string; name: string } | null>(null);

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
        
        const filteredOrders = ordersWithDetails.filter(order => 
          order.processing_steps && order.processing_steps.length > 0
        );
        
        setOrders(filteredOrders);
        generateCalendarEvents(filteredOrders);
      } catch (error: any) {
        toast({
          title: t("error"),
          description: `${t("failed_to_load_projects", { message: error.message })}`,
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadLogisticsOutOrders();
  }, [toast, t]);

  const generateCalendarEvents = (orders: LogisticsOutOrder[]) => {
    const events: CalendarEvent[] = [];
    
    orders.forEach(order => {
      order.processing_steps?.forEach(step => {
        if (step.start_date && step.supplier) {
          const startDate = format(new Date(step.start_date), 'yyyy-MM-dd');
          events.push({
            date: startDate,
            type: 'start',
            order,
            step,
            title: `${t("start_event")}: ${step.name}`,
            description: `${order.project_name} - ${step.supplier}`
          });
          
          if (step.expected_duration_days) {
            const returnDate = addDays(new Date(step.start_date), step.expected_duration_days);
            const returnDateStr = format(returnDate, 'yyyy-MM-dd');
            events.push({
              date: returnDateStr,
              type: 'return',
              order,
              step,
              title: `${t("return_event")}: ${step.name}`,
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

  const eventCountByDate = calendarEvents.reduce((acc, event) => {
    acc[event.date] = (acc[event.date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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
        case 'overdue': return 'bg-muted text-muted-foreground';
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

  const handleShowOrderParts = (orderId: string, orderName: string) => {
    setSelectedOrder({ id: orderId, name: orderName });
    setShowOrderPartsDialog(true);
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
      <div className="flex min-h-screen bg-background">
        {!drawerLayout && (
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
      )}
        {drawerLayout && <Navbar />}
        <div className={`w-full p-4 md:p-6 flex justify-center items-center ${!drawerLayout ? 'ml-64' : 'pt-16'}`}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {!drawerLayout && (
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
      )}
      {drawerLayout && <Navbar />}
      <div className={`flex-1 min-w-0 overflow-x-hidden ${drawerLayout ? 'pt-16 px-3 pb-4' : 'ml-64 p-4 md:p-6'}`}>
        {/* Header */}
        <div className={`flex flex-col gap-2 ${isMobile ? 'mb-4' : 'sm:flex-row sm:items-center sm:justify-between gap-3 mb-6'}`}>
          <div className="min-w-0">
            <h1 className={`font-bold text-foreground ${isMobile ? 'text-xl' : 'text-2xl md:text-3xl'}`}>{t("logistics_out_title")}</h1>
            {!isMobile && <p className="text-muted-foreground mt-1 text-sm">{t("logistics_out_description")}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className={`${isMobile ? 'text-[10px] px-2 py-0.5' : 'px-3 py-1 text-xs'}`}>
              {t("orders_count", { count: filteredOrders.length.toString() })}
            </Badge>
            <Badge variant="outline" className={`${isMobile ? 'text-[10px] px-2 py-0.5' : 'px-3 py-1 text-xs'}`}>
              {t("events_count", { count: calendarEvents.length.toString() })}
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <Card className={isMobile ? 'mb-3' : 'mb-6'}>
          <CardContent className={isMobile ? 'p-2.5' : 'p-3 md:p-4'}>
            <div className={`flex ${isMobile ? 'flex-col gap-2' : 'flex-col sm:flex-row gap-3'}`}>
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder={t("search_projects_suppliers")}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`pl-10 ${isMobile ? 'h-9 text-sm' : ''}`}
                  />
                </div>
              </div>
              <div className={isMobile ? 'w-full' : 'sm:w-48'}>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className={isMobile ? 'h-9 text-xs' : ''}>
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder={t("filter_status")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("all_status")}</SelectItem>
                    <SelectItem value="pending">{t("pending")}</SelectItem>
                    <SelectItem value="delivered">{t("delivered")}</SelectItem>
                    <SelectItem value="delayed">{t("status_delayed")}</SelectItem>
                    <SelectItem value="canceled">{t("status_canceled")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calendar + Day Details */}
        <div className={`grid gap-3 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3 md:gap-6'}`}>
          <Card className={`${isMobile ? '' : 'lg:col-span-2'} overflow-hidden`}>
            <CardHeader className={isMobile ? 'px-2 py-2' : 'px-3 md:px-6'}>
              <CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-sm' : 'text-base md:text-lg'}`}>
                <CalendarIcon className={`shrink-0 ${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                {t("external_processing_timeline")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-hidden">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="p-2 md:p-3 w-full"
                modifiers={{ event: eventDays }}
                modifiersClassNames={{
                  event: 'bg-sky-100 text-sky-800 rounded-md font-bold relative',
                }}
                components={{
                  DayContent: ({ date }) => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const eventCount = eventCountByDate[dateStr];
                    return (
                      <div className="relative w-full h-full flex items-center justify-center">
                        <span>{date.getDate()}</span>
                        {eventCount && (
                          <div className="absolute -top-1 -right-1 bg-sky-600 text-white text-xs rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                            {eventCount}
                          </div>
                        )}
                      </div>
                    );
                  }
                }}
                weekStartsOn={1}
              />
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className={isMobile ? 'px-3 py-2' : 'px-3 md:px-6'}>
              <CardTitle className={`flex flex-wrap items-center gap-1.5 ${isMobile ? 'text-sm' : 'text-base md:text-lg'}`}>
                <Package className={`shrink-0 ${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                <span className="truncate">
                  {selectedDate ? format(selectedDate, isMobile ? 'MMM d, yyyy' : 'MMMM d, yyyy') : t("select_date")}
                </span>
                {selectedDayEvents.length > 0 && (
                  <Badge variant="secondary" className={isMobile ? 'text-[10px] px-1.5' : ''}>
                    {selectedDayEvents.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className={isMobile ? 'px-3 pb-3' : 'px-3 md:px-6'}>
              {selectedDayEvents.length > 0 ? (
                <div className="space-y-3">
                  {selectedDayEvents.map((event, index) => (
                    <div
                      key={`${event.order.id}-${index}`}
                      className={cn("p-3 rounded-lg border", getEventColor(event))}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant="outline" className="mb-1 bg-background/90 text-foreground border-background">
                          {event.type === 'start' ? t("start_event") : t("return_event")}
                        </Badge>
                        {getEventPriority(event) === 'urgent' && (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <h4 className="font-medium mb-1 text-sm">{event.title}</h4>
                      <p className="text-xs opacity-90">{event.description}</p>
                      <div className="mt-2 pt-2 border-t border-current/20">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <Badge 
                            variant={event.step.status === 'completed' ? 'default' : 'secondary'}
                            className="text-xs bg-background/90 text-foreground"
                          >
                            {event.step.status}
                          </Badge>
                          {event.step.expected_duration_days && (
                            <span className="text-xs opacity-75">
                              {t("days_duration", { days: event.step.expected_duration_days.toString() })}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          <Button size="sm" variant="outline"
                            onClick={() => handleProjectNavigation(event.order.project_id)}
                            className="text-xs h-6 px-2 bg-background/90 text-foreground border-background hover:bg-background">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline"
                            onClick={() => handleShowFiles(event.order.project_id, event.order.project_name)}
                            className="text-xs h-6 px-2 bg-background/90 text-foreground border-background hover:bg-background">
                            <FileText className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline"
                            onClick={() => handleShowBarcode(event.order.project_id, event.order.project_name)}
                            className="text-xs h-6 px-2 bg-background/90 text-foreground border-background hover:bg-background">
                            <Barcode className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline"
                            onClick={() => handleShowOrderParts(event.order.id, `${event.order.project_name} - ${event.order.supplier}`)}
                            className="text-xs h-6 px-2 bg-background/90 text-foreground border-background hover:bg-background">
                            <List className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <CalendarIcon className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
                  <p className="text-sm">{t("no_external_processing_events")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Events */}
        <div className={isMobile ? 'mt-3' : 'mt-6'}>
          <Card>
            <CardHeader className={isMobile ? 'px-3 py-2' : 'px-3 md:px-6'}>
              <CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-sm' : 'text-base md:text-lg'}`}>
                <Clock className={`shrink-0 ${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                {t("upcoming_external_processing_events", { count: upcomingEvents.length.toString() })}
              </CardTitle>
            </CardHeader>
            <CardContent className={isMobile ? 'px-3 pb-3' : 'px-3 md:px-6'}>
              {upcomingEvents.length > 0 ? (
                <div className={`grid gap-2 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 md:gap-4'}`}>
                  {upcomingEvents.map((event, index) => (
                    <div
                      key={`${event.order.id}-${index}`}
                      className={cn("p-3 md:p-4 rounded-lg border", getEventColor(event))}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-xs bg-background/90 text-foreground border-background">
                          {event.type === 'start' ? t("start_event") : t("return_event")}
                        </Badge>
                        <span className="text-xs font-medium">
                          {format(new Date(event.date), 'MMM d')}
                        </span>
                      </div>
                      <h4 className="font-medium text-sm mb-1 truncate">{event.title}</h4>
                      <p className="text-xs opacity-90 line-clamp-2">{event.description}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Truck className="h-3 w-3 shrink-0" />
                        <span className="text-xs truncate">{event.step.supplier}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Button size="sm" variant="outline"
                          onClick={() => handleProjectNavigation(event.order.project_id)}
                          className="text-xs h-6 px-2 flex-1 bg-background/90 text-foreground border-background hover:bg-background">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline"
                          onClick={() => handleShowFiles(event.order.project_id, event.order.project_name)}
                          className="text-xs h-6 px-2 flex-1 bg-background/90 text-foreground border-background hover:bg-background">
                          <FileText className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline"
                          onClick={() => handleShowBarcode(event.order.project_id, event.order.project_name)}
                          className="text-xs h-6 px-2 flex-1 bg-background/90 text-foreground border-background hover:bg-background">
                          <Barcode className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline"
                          onClick={() => handleShowParts(event.order.project_id, event.order.project_name)}
                          className="text-xs h-6 px-2 flex-1 bg-background/90 text-foreground border-background hover:bg-background">
                          <List className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Clock className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
                  <p className="text-sm">{t("no_upcoming_external_processing_events")}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Orders Summary */}
        <div className={isMobile ? 'mt-3' : 'mt-6'}>
          <Card>
            <CardHeader className={isMobile ? 'px-3 py-2' : 'px-3 md:px-6'}>
              <CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-sm' : 'text-base md:text-lg'}`}>
                <Package className={`shrink-0 ${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                {t("external_processing_orders_summary")}
              </CardTitle>
            </CardHeader>
            <CardContent className={isMobile ? 'px-3 pb-3' : 'px-3 md:px-6'}>
              <div className={`grid gap-2 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 md:gap-4'}`}>
                {filteredOrders.map(order => (
                  <div key={order.id} className="p-3 md:p-4 border rounded-lg bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'}>
                        {order.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(order.expected_delivery), 'MMM d')}
                      </span>
                    </div>
                    <h4 className="font-medium mb-1 truncate text-sm">{order.project_name}</h4>
                    <p className="text-sm text-muted-foreground mb-2 truncate">{order.supplier}</p>
                    {order.processing_steps && order.processing_steps.length > 0 && (
                      <div className="space-y-1 mb-3">
                        <div className="text-xs font-medium text-muted-foreground">{t("external_steps")}</div>
                        {order.processing_steps.slice(0, 2).map(step => (
                          <div key={step.id} className="flex items-center gap-2 text-xs min-w-0">
                            <div className={cn(
                              "w-2 h-2 rounded-full shrink-0",
                              step.status === 'completed' ? 'bg-green-500' :
                              step.status === 'in_progress' ? 'bg-blue-500' :
                              step.status === 'delayed' ? 'bg-red-500' : 'bg-muted-foreground/40'
                            )} />
                            <span className="truncate">{step.name}</span>
                            <span className="text-muted-foreground shrink-0">({step.supplier})</span>
                          </div>
                        ))}
                        {order.processing_steps.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            {t("more_steps", { count: (order.processing_steps.length - 2).toString() })}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="outline"
                        onClick={() => handleProjectNavigation(order.project_id)}
                        className="text-xs h-7 px-2 flex-1 min-w-0">
                        <ExternalLink className="h-3 w-3 mr-1 shrink-0" />
                        <span className="truncate">{t("project_button")}</span>
                      </Button>
                      <Button size="sm" variant="outline"
                        onClick={() => handleShowFiles(order.project_id, order.project_name)}
                        className="text-xs h-7 px-2 flex-1 min-w-0">
                        <FileText className="h-3 w-3 mr-1 shrink-0" />
                        <span className="truncate">{t("files_button")}</span>
                      </Button>
                      <Button size="sm" variant="outline"
                        onClick={() => handleShowBarcode(order.project_id, order.project_name)}
                        className="text-xs h-7 px-2 flex-1 min-w-0">
                        <Barcode className="h-3 w-3 mr-1 shrink-0" />
                        <span className="truncate">{t("code_button")}</span>
                      </Button>
                      <Button size="sm" variant="outline"
                        onClick={() => handleShowParts(order.project_id, order.project_name)}
                        className="text-xs h-7 px-2 flex-1 min-w-0">
                        <List className="h-3 w-3 mr-1 shrink-0" />
                        <span className="truncate">{t("parts_button")}</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
