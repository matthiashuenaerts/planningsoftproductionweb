import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Order } from '@/types/order';
import { EnhancedDeliveryConfirmationModal } from './EnhancedDeliveryConfirmationModal';
import { format } from 'date-fns';
import { Truck, Package, Building2, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { orderService } from '@/services/orderService';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLanguage } from '@/context/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';

interface TodaysDeliveriesProps {
  orders: Order[];
  onDeliveryConfirmed: () => void;
}

export const TodaysDeliveries: React.FC<TodaysDeliveriesProps> = ({ 
  orders, 
  onDeliveryConfirmed 
}) => {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'canceled': return 'bg-red-100 text-red-800';
      case 'delayed': return 'bg-orange-100 text-orange-800';
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
                <span>{t('lo_delivered')}: {item.delivered_quantity || 0}</span>
              </div>
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
              <TableHead>{t('lo_description')}</TableHead>
              <TableHead className="text-right">{t('lo_ordered')}</TableHead>
              <TableHead className="text-right">{t('lo_delivered')}</TableHead>
              <TableHead className="text-right">{t('lo_article_code')}</TableHead>
              <TableHead className="text-right">{t('lo_ean')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.description}</TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell className="text-right">{item.delivered_quantity || 0}</TableCell>
                <TableCell className="text-right">{item.article_code}</TableCell>
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
            <Truck className="mx-auto h-12 w-12 text-muted-foreground/60" />
            <h3 className="mt-2 text-sm font-medium text-foreground">{t('td_no_deliveries')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t('td_no_deliveries_desc')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full overflow-hidden">
        <CardHeader className={isMobile ? 'px-3 py-2.5' : 'px-4 md:px-6'}>
          <CardTitle className={`flex items-center gap-2 text-blue-600 ${isMobile ? 'text-sm' : 'text-base md:text-lg'}`}>
            <Truck className={`shrink-0 ${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
            {(t('td_todays_deliveries_title') || '').replace('{{count}}', String(orders.length))}
          </CardTitle>
        </CardHeader>
        <CardContent className={isMobile ? 'px-3 pb-3' : 'px-4 md:px-6'}>
          <div className={isMobile ? 'space-y-2' : 'space-y-4'}>
            {orders.map((order) => {
              const isExpanded = expandedOrders.has(order.id);
              
              if (isMobile) {
                return (
                  <Card key={order.id} className="border-l-4 border-l-blue-500 overflow-hidden">
                    <div className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate">
                            {order.supplier}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {(order as any).project_name || order.project_id}
                          </p>
                        </div>
                        <Badge className={`shrink-0 text-[10px] px-1.5 py-0 ${getStatusColor(order.status)}`}>
                          {order.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>📅 {format(new Date(order.expected_delivery), 'dd MMM yyyy')}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleOrderExpansion(order.id)}
                          className="flex-1 h-7 text-[10px] px-2"
                        >
                          {isExpanded ? <ChevronUp className="h-3 w-3 mr-0.5" /> : <ChevronDown className="h-3 w-3 mr-0.5" />}
                          {isExpanded ? t('lo_hide_items') : t('lo_show_items')}
                        </Button>
                        <Button 
                          onClick={() => setSelectedOrder(order)}
                          size="sm"
                          className="flex-1 h-7 text-[10px] px-2 bg-green-600 hover:bg-green-700"
                        >
                          {t('lo_confirm_delivery')}
                        </Button>
                      </div>
                    </div>
                    <OrderItems orderId={order.id} isExpanded={isExpanded} />
                  </Card>
                );
              }

              return (
                <Card key={order.id} className="border-l-4 border-l-blue-500 overflow-hidden">
                  <CardHeader className="px-4 md:px-6 pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <CardTitle className="text-sm md:text-base flex items-center gap-2 min-w-0">
                        <Package className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
                        <span className="truncate">
                          {(t('lo_order_from') || '').replace('{{supplier}}', order.supplier)}
                        </span>
                      </CardTitle>
                      <Badge className={`shrink-0 ${getStatusColor(order.status)}`}>
                        {order.status}
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
