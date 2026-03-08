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
import { useLanguage } from '@/context/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';

interface UpcomingDeliveriesProps {
  orders: Order[];
  onDeliveryConfirmed: () => void;
}

export const UpcomingDeliveries: React.FC<UpcomingDeliveriesProps> = ({ 
  orders, 
  onDeliveryConfirmed 
}) => {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const getStatusColor = (status: string, hasTeamAssignment: boolean) => {
    if (status === 'pending') {
      return hasTeamAssignment ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
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
    if (status === 'pending') {
      return hasTeamAssignment ? t('ud_planned') : t('ud_to_plan');
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

  const OrderItems = ({ orderId, isExpanded }: { orderId: string; isExpanded: boolean }) => {
    const { data: orderItems = [], isLoading } = useQuery({
      queryKey: ['order-items', orderId],
      queryFn: () => orderService.getOrderItems(orderId),
      enabled: isExpanded
    });

    if (!isExpanded) return null;

    if (isLoading) {
      return (
        <div className="px-4 md:px-6 pb-4">
          <div className="text-sm text-muted-foreground">{t('lo_loading_items')}</div>
        </div>
      );
    }

    if (orderItems.length === 0) {
      return (
        <div className="px-4 md:px-6 pb-4">
          <div className="text-sm text-muted-foreground">{t('lo_no_items')}</div>
        </div>
      );
    }

    if (isMobile) {
      return (
        <div className="px-4 pb-4 space-y-3">
          {orderItems.map((item) => (
            <div key={item.id} className="rounded-lg border p-3 space-y-1 text-sm">
              <p className="font-medium">{item.description}</p>
              <p className="text-xs text-muted-foreground">{t('lo_article_code')}: {item.article_code}</p>
              <div className="flex justify-between text-muted-foreground">
                <span>{t('lo_ordered')}: {item.quantity}</span>
                <span className={item.delivered_quantity && item.delivered_quantity > 0 ? 'text-green-600 font-medium' : ''}>
                  {t('lo_delivered')}: {item.delivered_quantity || 0}
                </span>
              </div>
              {item.stock_location && (
                <p className="text-xs text-muted-foreground">{t('lo_location')}: {item.stock_location}</p>
              )}
              {item.ean && (
                <p className="text-xs text-muted-foreground font-mono">{t('lo_ean')}: {item.ean}</p>
              )}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="px-6 pb-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('lo_article_code')}</TableHead>
              <TableHead>{t('lo_description')}</TableHead>
              <TableHead className="text-center">{t('lo_ordered')}</TableHead>
              <TableHead className="text-center">{t('lo_delivered')}</TableHead>
              <TableHead>{t('lo_location')}</TableHead>
              <TableHead className="text-right">{t('lo_ean')}</TableHead>
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
                    <span className="text-muted-foreground">-</span>
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
          <div className="text-center text-muted-foreground">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground/60" />
            <h3 className="mt-2 text-sm font-medium text-foreground">{t('ud_no_upcoming')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t('ud_no_upcoming_desc')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedOrders = [...orders].sort((a, b) => 
    new Date(a.expected_delivery).getTime() - new Date(b.expected_delivery).getTime()
  );

  return (
    <>
      <Card className="w-full overflow-hidden">
        <CardHeader className="px-4 md:px-6">
          <CardTitle className="flex items-center gap-2 text-green-600 text-base md:text-lg">
            <Calendar className="h-5 w-5 shrink-0" />
            {(t('ud_upcoming_deliveries_title') || '').replace('{{count}}', String(orders.length))}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 md:px-6">
          <div className="space-y-4">
            {sortedOrders.map((order) => {
              const isExpanded = expandedOrders.has(order.id);
              const hasTeamAssignment = (order as any).project_team_assignments?.length > 0;
              
              return (
                <Card key={order.id} className="border-l-4 border-l-green-500 overflow-hidden">
                  <CardHeader className="px-4 md:px-6 pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <CardTitle className="text-sm md:text-base flex items-center gap-2 min-w-0">
                        <Package className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
                        <span className="truncate">
                          {(t('lo_order_from') || '').replace('{{supplier}}', order.supplier)}
                        </span>
                      </CardTitle>
                      <Badge className={`shrink-0 ${getStatusColor(order.status, hasTeamAssignment)}`}>
                        {getStatusText(order.status, hasTeamAssignment)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 md:px-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">{t('lo_project')}</p>
                          <p className="font-medium text-sm truncate">
                            {(order as any).project_name || order.project_id}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">{t('lo_order_date')}</p>
                          <p className="font-medium text-sm">{format(new Date(order.order_date), 'PPP')}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{t('lo_expected_delivery')}</p>
                        <p className="font-medium text-sm">
                          {format(new Date(order.expected_delivery), 'PPP')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 sm:justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleOrderExpansion(order.id)}
                          className="text-xs"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-3 w-3 mr-1" />
                              {t('lo_hide_items')}
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3 w-3 mr-1" />
                              {t('lo_show_items')}
                            </>
                          )}
                        </Button>
                        <Button 
                          onClick={() => setSelectedOrder(order)}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-xs"
                        >
                          {t('lo_confirm_delivery')}
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
