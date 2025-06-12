
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Order } from '@/types/order';
import { DeliveryConfirmationModal } from './DeliveryConfirmationModal';
import { format } from 'date-fns';
import { Calendar, Package, Building2, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { orderService } from '@/services/orderService';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';

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

  // Query for team assignments to determine installation status
  const { data: teamAssignments = [] } = useQuery({
    queryKey: ['team-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_team_assignments')
        .select('project_id, team');
      
      if (error) throw error;
      return data || [];
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'canceled': return 'bg-red-100 text-red-800';
      case 'delayed': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getInstallationStatus = (projectId: string) => {
    const hasTeamAssignment = teamAssignments.some(assignment => assignment.project_id === projectId);
    return hasTeamAssignment ? 'planned' : 'to plan';
  };

  const getInstallationStatusColor = (status: string) => {
    switch (status) {
      case 'planned': return 'bg-blue-100 text-blue-800';
      case 'to plan': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Article Code</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.description}</TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell className="text-right">{item.article_code}</TableCell>
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
              const installationStatus = getInstallationStatus(order.project_id);
              
              return (
                <Card key={order.id} className="border-l-4 border-l-green-500">
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
                        <Badge className={getInstallationStatusColor(installationStatus)}>
                          {installationStatus}
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
