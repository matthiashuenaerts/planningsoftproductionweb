
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Order, OrderItem } from '@/types/order';
import { DeliveryConfirmationModal } from './DeliveryConfirmationModal';
import { orderService } from '@/services/orderService';
import { format, differenceInDays } from 'date-fns';
import { AlertTriangle, Package, Building2, Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface BackorderDeliveriesProps {
  orders: Order[];
  onDeliveryConfirmed: () => void;
}

export const BackorderDeliveries: React.FC<BackorderDeliveriesProps> = ({ 
  orders, 
  onDeliveryConfirmed 
}) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});

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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Project</p>
                          <p className="font-medium">{(order as any).project_name || order.project_id}</p>
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
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          onClick={() => toggleOrderExpansion(order.id)}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          {expandedOrder === order.id ? 
                            <><ChevronUp className="h-4 w-4" /> Hide Items</> : 
                            <><ChevronDown className="h-4 w-4" /> Show Items</>
                          }
                        </Button>
                        <Button 
                          onClick={() => setSelectedOrder(order)}
                          className="bg-green-600 hover:bg-green-700"
                          size="sm"
                        >
                          Confirm Delivery
                        </Button>
                      </div>
                    </div>

                    {expandedOrder === order.id && (
                      <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                        <h4 className="font-medium mb-3">Order Items</h4>
                        {!orderItems[order.id] ? (
                          <div className="flex justify-center p-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                          </div>
                        ) : orderItems[order.id].length === 0 ? (
                          <p className="text-sm text-muted-foreground">No items in this order.</p>
                        ) : (
                          <div className="rounded-md border">
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
                          </div>
                        )}
                      </div>
                    )}
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
