
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Order } from '@/types/order';
import { EnhancedDeliveryConfirmationModal } from './EnhancedDeliveryConfirmationModal';
import { format } from 'date-fns';
import { Calendar, Package, Building2, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { orderService } from '@/services/orderService';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface UpcomingDeliveriesProps {
  orders: Order[];
  onDeliveryConfirmed: () => void;
}

export const UpcomingDeliveries: React.FC<UpcomingDeliveriesProps> = ({ 
  orders, 
  onDeliveryConfirmed 
}) => {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const getStatusColor = (status: string, hasTeamAssignment: boolean) => {
    // Check if project is assigned to installation team to determine badge
    if (status === 'pending') {
      if (hasTeamAssignment) {
        return 'bg-green-100 text-green-800'; // Planned
      } else {
        return 'bg-yellow-100 text-yellow-800'; // To Plan
      }
    }
    
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'partially_delivered': return 'bg-blue-100 text-blue-800';
      case 'canceled': return 'bg-red-100 text-red-800';
      case 'delayed': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string, hasTeamAssignment: boolean) => {
    // Check if project is assigned to installation team to determine text
    if (status === 'pending') {
      return hasTeamAssignment ? 'Planned' : 'To Plan';
    }
    return status;
  };

  const toggleOrderExpansion = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  // Query for order items when order is expanded
  const OrderItems = ({ orderId, isExpanded }: { orderId: string; isExpanded: boolean }) => {
    const { data: orderItems = [], isLoading } = useQuery({
      queryKey: ['order-items', orderId],
      queryFn: () => orderService.getOrderItems(orderId),
      enabled: isExpanded
    });

    if (!isExpanded) return null;

    if (isLoading) {
      return (
        <div className="px-6 pb-4">
          <div className="text-sm text-gray-500">Loading order items...</div>
        </div>
      );
    }

    if (orderItems.length === 0) {
      return (
        <div className="px-6 pb-4">
          <div className="text-sm text-gray-500">No items found for this order.</div>
        </div>
      );
    }

    return (
      <div className="px-6 pb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Article Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-center">Ordered</TableHead>
              <TableHead className="text-center">Delivered</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">EAN</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.article_code}</TableCell>
                <TableCell>{item.description}</TableCell>
                <TableCell className="text-center">{item.quantity}</TableCell>
                <TableCell className="text-center">
                  <span className={item.delivered_quantity && item.delivered_quantity > 0 ? 'text-green-600 font-medium' : ''}>
                    {item.delivered_quantity || 0}
                  </span>
                </TableCell>
                <TableCell>{item.stock_location || '-'}</TableCell>
                <TableCell className="text-right">
                  {item.ean ? (
                    <span className="font-mono text-xs">{item.ean}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-gray-500">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No upcoming deliveries</h3>
            <p className="mt-1 text-sm text-gray-500">No orders scheduled for future delivery.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort by delivery date
  const sortedOrders = [...orders].sort((a, b) => 
    new Date(a.expected_delivery).getTime() - new Date(b.expected_delivery).getTime()
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <Calendar className="h-5 w-5" />
            Upcoming Deliveries ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sortedOrders.map((order) => {
              const isExpanded = expandedOrders.has(order.id);
              // Check if the project has a team assignment to determine badge
              const hasTeamAssignment = (order as any).project_team_assignments && 
                                      (order as any).project_team_assignments.length > 0;
              
              return (
                <Card key={order.id} className="border-l-4 border-l-green-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Order from {order.supplier}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(order.status, hasTeamAssignment)}>
                          {getStatusText(order.status, hasTeamAssignment)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-500">Project</p>
                          <p className="font-medium">
                            {(order as any).project_name || order.project_id}
                          </p>
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
                        <p className="font-medium">
                          {format(new Date(order.expected_delivery), 'PPP')}
                        </p>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleOrderExpansion(order.id)}
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-4 w-4 mr-1" />
                              Hide Items
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4 mr-1" />
                              Show Items
                            </>
                          )}
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
                  </CardContent>
                  <OrderItems orderId={order.id} isExpanded={isExpanded} />
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedOrder && (
        <EnhancedDeliveryConfirmationModal
          order={selectedOrder}
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onConfirmed={onDeliveryConfirmed}
        />
      )}
    </>
  );
};
