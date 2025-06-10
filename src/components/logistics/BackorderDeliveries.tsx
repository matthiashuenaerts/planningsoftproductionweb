
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Package, AlertTriangle, FileText, Paperclip } from 'lucide-react';
import { DeliveryConfirmationModal } from './DeliveryConfirmationModal';
import { orderService } from '@/services/orderService';
import OrderAttachmentUploader from '@/components/OrderAttachmentUploader';
import { useToast } from '@/hooks/use-toast';

interface BackorderDeliveriesProps {
  orders: any[];
  onDeliveryConfirmed: () => void;
}

export const BackorderDeliveries: React.FC<BackorderDeliveriesProps> = ({ 
  orders, 
  onDeliveryConfirmed 
}) => {
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [orderAttachments, setOrderAttachments] = useState<{ [key: string]: any[] }>({});
  const { toast } = useToast();

  // Load attachments for an order
  const loadOrderAttachments = async (orderId: string) => {
    try {
      const attachments = await orderService.getOrderAttachments(orderId);
      setOrderAttachments(prev => ({ ...prev, [orderId]: attachments }));
    } catch (error) {
      console.error('Error loading attachments:', error);
    }
  };

  React.useEffect(() => {
    // Load attachments for all orders
    orders.forEach(order => {
      loadOrderAttachments(order.id);
    });
  }, [orders]);

  const handleConfirmDelivery = (order: any) => {
    setSelectedOrder(order);
    setShowConfirmModal(true);
  };

  const handleAttachmentUpload = (orderId: string) => {
    loadOrderAttachments(orderId);
    toast({
      title: "Success",
      description: "File uploaded successfully",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'delivered':
        return <Badge className="bg-green-100 text-green-800">Delivered</Badge>;
      case 'delayed':
        return <Badge className="bg-red-100 text-red-800">Delayed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">No backorder deliveries.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <Card key={order.id} className="border-red-200">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <Package className="h-5 w-5" />
                  {order.supplier}
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </CardTitle>
                <CardDescription>
                  Project: {order.project_name}
                </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-2">
                {getStatusBadge(order.status)}
                <Button 
                  onClick={() => handleConfirmDelivery(order)}
                  size="sm"
                  disabled={order.status === 'delivered'}
                  variant="destructive"
                >
                  {order.status === 'delivered' ? 'Delivered' : 'Confirm Delivery'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-red-600 font-medium">
                Overdue since: {format(new Date(order.expected_delivery), 'MMM dd, yyyy')}
              </div>
              
              {/* Order Attachments Section */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Delivery Documents
                  </h4>
                  <OrderAttachmentUploader 
                    orderId={order.id} 
                    onUploadSuccess={() => handleAttachmentUpload(order.id)}
                    compact={true}
                  />
                </div>
                
                {orderAttachments[order.id] && orderAttachments[order.id].length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {orderAttachments[order.id].map((attachment: any) => (
                      <div 
                        key={attachment.id} 
                        className="border rounded p-2 flex items-center justify-between bg-gray-50"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Paperclip className="h-4 w-4 text-gray-500" />
                          <span className="text-sm truncate">{attachment.file_name}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => window.open(attachment.file_path, '_blank')}
                        >
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No documents attached</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <DeliveryConfirmationModal
        order={selectedOrder}
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={onDeliveryConfirmed}
      />
    </div>
  );
};
