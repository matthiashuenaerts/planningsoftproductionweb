
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Order } from '@/types/order';
import { DeliveryConfirmationModal } from './DeliveryConfirmationModal';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, startOfWeek, endOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, Package } from 'lucide-react';

interface UpcomingDeliveriesProps {
  orders: Order[];
  onDeliveryConfirmed?: () => void;
}

export const UpcomingDeliveries: React.FC<UpcomingDeliveriesProps> = ({ 
  orders, 
  onDeliveryConfirmed 
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd
  });

  const getOrdersForDate = (date: Date) => {
    return orders.filter(order => 
      isSameDay(new Date(order.expected_delivery), date)
    );
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'canceled': return 'bg-red-100 text-red-800';
      case 'delayed': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleDeliveryConfirmed = () => {
    setSelectedOrder(null);
    if (onDeliveryConfirmed) {
      onDeliveryConfirmed();
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Calendar Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Delivery Calendar
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateMonth('prev')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-lg font-semibold min-w-[200px] text-center">
                  {format(currentDate, 'MMMM yyyy')}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateMonth('next')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {/* Day headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                  {day}
                </div>
              ))}
              
              {/* Calendar days */}
              {calendarDays.map((day, index) => {
                const dayOrders = getOrdersForDate(day);
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const isDayToday = isToday(day);
                
                return (
                  <div
                    key={index}
                    className={`
                      min-h-[100px] p-2 border rounded-lg
                      ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                      ${isDayToday ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
                    `}
                  >
                    <div className={`
                      text-sm font-medium mb-1
                      ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                      ${isDayToday ? 'text-blue-600' : ''}
                    `}>
                      {format(day, 'd')}
                    </div>
                    
                    {dayOrders.length > 0 && (
                      <div className="space-y-1">
                        {dayOrders.slice(0, 2).map((order) => (
                          <div
                            key={order.id}
                            className="text-xs p-1 bg-blue-100 text-blue-800 rounded truncate"
                            title={`${order.supplier} - ${(order as any).project_name || order.project_id}`}
                          >
                            {order.supplier}
                          </div>
                        ))}
                        {dayOrders.length > 2 && (
                          <div className="text-xs text-gray-500">
                            +{dayOrders.length - 2} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Orders List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Upcoming Orders List
            </CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No upcoming deliveries scheduled
              </div>
            ) : (
              <div className="space-y-4">
                {orders.slice(0, 10).map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{order.supplier}</h3>
                        <Badge className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">
                        Project: {(order as any).project_name || order.project_id}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-medium">{format(new Date(order.expected_delivery), 'PPP')}</p>
                        <p className="text-sm text-gray-500">{format(new Date(order.expected_delivery), 'EEEE')}</p>
                      </div>
                      <Button 
                        onClick={() => setSelectedOrder(order)}
                        className="bg-green-600 hover:bg-green-700"
                        size="sm"
                      >
                        Mark as Delivered
                      </Button>
                    </div>
                  </div>
                ))}
                {orders.length > 10 && (
                  <div className="text-center text-gray-500 text-sm">
                    And {orders.length - 10} more orders...
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedOrder && (
        <DeliveryConfirmationModal
          order={selectedOrder}
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onConfirmed={handleDeliveryConfirmed}
        />
      )}
    </>
  );
};
