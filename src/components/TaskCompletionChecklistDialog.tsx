import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { checklistService, ChecklistItem } from '@/services/checklistService';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle } from 'lucide-react';

interface TaskCompletionChecklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  standardTaskId: string;
  taskName: string;
  onComplete: () => void;
}

const TaskCompletionChecklistDialog: React.FC<TaskCompletionChecklistDialogProps> = ({
  open,
  onOpenChange,
  standardTaskId,
  taskName,
  onComplete
}) => {
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && standardTaskId) {
      loadChecklistItems();
    }
  }, [open, standardTaskId]);

  const loadChecklistItems = async () => {
    try {
      setLoading(true);
      const items = await checklistService.getChecklistItems(standardTaskId);
      setChecklistItems(items);
      
      // Reset checked items
      const initialChecked: Record<string, boolean> = {};
      items.forEach(item => {
        initialChecked[item.id] = false;
      });
      setCheckedItems(initialChecked);
    } catch (error) {
      console.error('Error loading checklist items:', error);
      toast({
        title: 'Error',
        description: 'Failed to load checklist items',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleItemCheck = (itemId: string, checked: boolean) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemId]: checked
    }));
  };

  const canComplete = () => {
    // Check if all required items are checked
    return checklistItems
      .filter(item => item.is_required)
      .every(item => checkedItems[item.id] === true);
  };

  const handleComplete = () => {
    if (canComplete()) {
      onComplete();
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="flex justify-center items-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Complete Task: {taskName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-muted-foreground">
            Please complete the following checklist before marking this task as complete:
          </p>

          <div className="space-y-3">
            {checklistItems.map((item) => (
              <div key={item.id} className="flex items-start space-x-3">
                <Checkbox
                  id={item.id}
                  checked={checkedItems[item.id] || false}
                  onCheckedChange={(checked) => handleItemCheck(item.id, checked as boolean)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label 
                    htmlFor={item.id} 
                    className="text-sm cursor-pointer leading-relaxed"
                  >
                    {item.item_text}
                    {item.is_required && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </label>
                  {item.is_required && (
                    <p className="text-xs text-muted-foreground mt-1">Required</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {checklistItems.length === 0 && (
            <p className="text-muted-foreground text-center py-4">
              No checklist items configured for this task.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleComplete} 
            disabled={!canComplete()}
            className="min-w-24"
          >
            Complete Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TaskCompletionChecklistDialog;