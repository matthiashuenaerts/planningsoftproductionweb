
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { orderService } from '@/services/orderService';
import { projectService } from '@/services/dataService';

interface ImportStockOrderModalProps {
  onClose: () => void;
  onImportSuccess: () => void;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.supplier || !formData.expectedDelivery) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // First, check if STOCK project exists, if not create it
      let stockProject;
      try {
        const projects = await projectService.getAll();
        stockProject = projects.find(p => p.name === 'STOCK');
        
        if (!stockProject) {
          // Create STOCK project
          stockProject = await projectService.create({
            name: 'STOCK',
            description: 'Stock orders not linked to specific projects',
            start_date: new Date().toISOString().split('T')[0],
            status: 'in_progress',
            client: 'Internal Stock',
            installation_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            progress: 0
          });
        }
      } catch (error) {
        console.error('Error handling STOCK project:', error);
        throw new Error('Failed to create or find STOCK project');
      }

      // Create the stock order
      await orderService.create({
        project_id: stockProject.id,
        supplier: formData.supplier,
        order_date: formData.orderDate,
        expected_delivery: formData.expectedDelivery,
        status: 'pending',
        order_type: 'standard',
        notes: formData.notes || null
      });

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
      <DialogContent className="sm:max-w-md">
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
            <Label htmlFor="notes">Notes</Label>
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
