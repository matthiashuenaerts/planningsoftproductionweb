
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { orderService } from '@/services/orderService';
import { X, Plus } from 'lucide-react';

interface NewOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess: () => void;
}

const NewOrderModal: React.FC<NewOrderModalProps> = ({
  open,
  onOpenChange,
  projectId,
  onSuccess
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [orderItems, setOrderItems] = useState([
    { description: '', quantity: 1, articleCode: '' }
  ]);

  const addItem = () => {
    setOrderItems([...orderItems, { description: '', quantity: 1, articleCode: '' }]);
  };

  const removeItem = (index: number) => {
    if (orderItems.length > 1) {
      setOrderItems(orderItems.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...orderItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setOrderItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supplier || !expectedDelivery) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }
    
    if (orderItems.some(item => !item.description || item.quantity < 1 || !item.articleCode)) {
      toast({
        title: "Error",
        description: "Please fill in all item details correctly",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // Create the order
      const order = await orderService.createOrder({
        project_id: projectId,
        supplier,
        order_date: new Date().toISOString(),
        expected_delivery: new Date(expectedDelivery).toISOString(),
        status: 'pending',
      });
      
      // Create the order items
      const orderItemsData = orderItems.map(item => ({
        order_id: order.id,
        description: item.description,
        quantity: item.quantity,
        article_code: item.articleCode
      }));
      
      await orderService.createOrderItems(orderItemsData);
      
      toast({
        title: "Success",
        description: "Order created successfully",
      });
      
      // Reset the form
      setSupplier('');
      setExpectedDelivery('');
      setOrderItems([
        { description: '', quantity: 1, articleCode: '' }
      ]);
      
      // Close the modal and refresh the parent component
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to create order: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add New Order</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Input 
                id="supplier" 
                value={supplier} 
                onChange={(e) => setSupplier(e.target.value)} 
                placeholder="Enter supplier name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="expected-delivery">Expected Delivery</Label>
              <Input 
                id="expected-delivery" 
                type="date" 
                value={expectedDelivery} 
                onChange={(e) => setExpectedDelivery(e.target.value)} 
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Order Items</Label>
              <Button 
                type="button" 
                size="sm" 
                variant="outline" 
                onClick={addItem}
                className="h-8"
              >
                <Plus className="h-4 w-4 mr-1" /> Add Item
              </Button>
            </div>
            
            {orderItems.map((item, index) => (
              <div 
                key={index} 
                className="grid grid-cols-[1fr_80px_120px_30px] gap-2 items-start"
              >
                <div>
                  <Input 
                    placeholder="Item description" 
                    value={item.description} 
                    onChange={(e) => updateItem(index, 'description', e.target.value)} 
                    required
                  />
                </div>
                
                <div>
                  <Input 
                    type="number" 
                    min="1" 
                    placeholder="Qty"
                    value={item.quantity} 
                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)} 
                    required
                  />
                </div>
                
                <div>
                  <Input 
                    placeholder="Article code"
                    value={item.articleCode} 
                    onChange={(e) => updateItem(index, 'articleCode', e.target.value)} 
                    required
                  />
                </div>
                
                <div className="flex justify-center">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeItem(index)}
                    className="h-8 w-8"
                    disabled={orderItems.length <= 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewOrderModal;
