import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { orderService } from '@/services/orderService';
import { Plus, Trash2 } from 'lucide-react';

interface ImportStockOrderModalProps {
  onClose: () => void;
  onImportSuccess: () => void;
}

interface OrderItem {
  description: string;
  quantity: number;
  article_code: string;
  notes?: string;
}

const ImportStockOrderModal: React.FC<ImportStockOrderModalProps> = ({ onClose, onImportSuccess }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    supplier: '',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDelivery: '',
    notes: ''
  });
  const [orderItems, setOrderItems] = useState<OrderItem[]>([
    { description: '', quantity: 1, article_code: '', notes: '' }
  ]);

  const addOrderItem = () => {
    setOrderItems([...orderItems, { description: '', quantity: 1, article_code: '', notes: '' }]);
  };

  const removeOrderItem = (index: number) => {
    if (orderItems.length > 1) {
      setOrderItems(orderItems.filter((_, i) => i !== index));
    }
  };

  const updateOrderItem = (index: number, field: keyof OrderItem, value: string | number) => {
    const updated = orderItems.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    );
    setOrderItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.supplier.trim()) {
      toast({
        title: "Error",
        description: "Please fill in the supplier name",
        variant: "destructive"
      });
      return;
    }

    if (!formData.expectedDelivery) {
      toast({
        title: "Error",
        description: "Please fill in the expected delivery date",
        variant: "destructive"
      });
      return;
    }

    // Validate that at least one order item has a description
    const validItems = orderItems.filter(item => item.description.trim());
    if (validItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one order item with a description",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Create the stock order with the provided supplier and no project_id
      const newOrder = await orderService.create({
        project_id: null, // No project linking
        supplier: formData.supplier,
        order_date: formData.orderDate,
        expected_delivery: formData.expectedDelivery,
        status: 'pending',
        order_type: 'standard',
        notes: formData.notes || null
      });

      // Add order items
      for (const item of validItems) {
        await orderService.createOrderItem({
          order_id: newOrder.id,
          description: item.description,
          quantity: item.quantity,
          article_code: item.article_code || '',
          notes: item.notes || null
        });
      }

      onImportSuccess();
    } catch (error: any) {
      console.error('Error importing stock order:', error);
      toast({
        title: "Error",
        description: `Failed to import stock order: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import STOCK Order</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="supplier">Supplier *</Label>
            <Input
              id="supplier"
              value={formData.supplier}
              onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
              placeholder="Enter supplier name"
              required
            />
            <p className="text-sm text-muted-foreground mt-1">This order will be marked as a STOCK order without project linking</p>
          </div>
          
          <div>
            <Label htmlFor="orderDate">Order Date</Label>
            <Input
              id="orderDate"
              type="date"
              value={formData.orderDate}
              onChange={(e) => setFormData(prev => ({ ...prev, orderDate: e.target.value }))}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="expectedDelivery">Expected Delivery *</Label>
            <Input
              id="expectedDelivery"
              type="date"
              value={formData.expectedDelivery}
              onChange={(e) => setFormData(prev => ({ ...prev, expectedDelivery: e.target.value }))}
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Order Items *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addOrderItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {orderItems.map((item, index) => (
                <div key={index} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Item {index + 1}</span>
                    {orderItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOrderItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor={`description-${index}`}>Description *</Label>
                      <Input
                        id={`description-${index}`}
                        value={item.description}
                        onChange={(e) => updateOrderItem(index, 'description', e.target.value)}
                        placeholder="Item description"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor={`article-code-${index}`}>Article Code</Label>
                      <Input
                        id={`article-code-${index}`}
                        value={item.article_code}
                        onChange={(e) => updateOrderItem(index, 'article_code', e.target.value)}
                        placeholder="Article code"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor={`quantity-${index}`}>Quantity *</Label>
                      <Input
                        id={`quantity-${index}`}
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateOrderItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor={`notes-${index}`}>Notes</Label>
                      <Input
                        id={`notes-${index}`}
                        value={item.notes || ''}
                        onChange={(e) => updateOrderItem(index, 'notes', e.target.value)}
                        placeholder="Optional notes"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <Label htmlFor="notes">Order Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Optional notes about this order"
              rows={3}
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Importing...' : 'Import Order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ImportStockOrderModal;
