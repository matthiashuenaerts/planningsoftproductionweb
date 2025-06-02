
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Order } from '@/types/order';
import { DeliveryConfirmationModal } from './DeliveryConfirmationModal';
import { format, differenceInDays } from 'date-fns';
import { AlertTriangle, Package, Building2, Clock } from 'lucide-react';

interface BackorderDeliveriesProps {
  orders: Order[];
  onDeliveryConfirmed: () => void;
}

export const BackorderDeliveries: React.FC<BackorderDeliveriesProps> = ({ 
  orders, 
  onDeliveryConfirmed 
}) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'canceled': return 'bg-red-100 text-red-800';
      case 'delayed': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDaysOverdue = (expectedDelivery: string) => {
    const deliveryDate = new Date(expectedDelivery);
    const today = new Date();
    return differenceInDays(today, deliveryDate);
  };

  const getOverdueColor = (daysOverdue: number) => {
    if (daysOverdue <= 3) return 'text-orange-600';
    if (daysOverdue <= 7) return 'text-red-600';
    return 'text-red-800';
  };

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-gray-500">
            <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No backorders</h3>
            <p className="mt-1 text-sm text-gray-500">All deliveries are on track!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort by most overdue first
  const sortedOrders = [...orders].sort((a, b) => 
    getDaysOverdue(b.expected_delivery) - getDaysOverdue(a.expected_delivery)
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Overdue Deliveries ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sortedOrders.map((order) => {
              const daysOverdue = getDaysOverdue(order.expected_delivery);
              
              return (
                <Card key={order.id} className="border-l-4 border-l-red-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Order from {order.supplier}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                        <Badge variant="destructive">
                          {daysOverdue} days overdue
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Project ID</p>
                          <p className="font-medium">{order.project_id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Order Date</p>
                          <p className="font-medium">{format(new Date(order.order_date), 'PPP')}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Expected Delivery</p>
                        <p className={`font-medium ${getOverdueColor(daysOverdue)}`}>
                          {format(new Date(order.expected_delivery), 'PPP')}
                        </p>
                      </div>
                      <div className="flex items-center justify-end">
                        <Button 
                          onClick={() => setSelectedOrder(order)}
                          className="bg-green-600 hover:bg-green-700"
                          size="sm"
                        >
                          Confirm Delivery
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedOrder && (
        <DeliveryConfirmationModal
          order={selectedOrder}
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onConfirmed={onDeliveryConfirmed}
        />
      )}
    </>
  );
};
