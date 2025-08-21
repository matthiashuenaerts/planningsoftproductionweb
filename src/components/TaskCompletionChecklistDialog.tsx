import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle, XCircle } from 'lucide-react';
import { standardTaskChecklistService, type StandardTaskChecklistItem, type TaskCompletionChecklistItem } from '@/services/standardTaskChecklistService';
import { useToast } from '@/hooks/use-toast';

interface TaskCompletionChecklistDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  standardTaskId: string;
  taskTitle: string;
  onComplete: () => void;
  onCancel: () => void;
}

export const TaskCompletionChecklistDialog: React.FC<TaskCompletionChecklistDialogProps> = ({
  isOpen,
  onOpenChange,
  taskId,
  standardTaskId,
  taskTitle,
  onComplete,
  onCancel
}) => {
  const [checklistItems, setChecklistItems] = useState<StandardTaskChecklistItem[]>([]);
  const [completionItems, setCompletionItems] = useState<TaskCompletionChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadChecklist();
    }
  }, [isOpen, taskId, standardTaskId]);

  const loadChecklist = async () => {
    try {
      setLoading(true);
      const result = await standardTaskChecklistService.getTaskCompletionChecklistWithItems(
        taskId,
        standardTaskId
      );
      setChecklistItems(result.checklistItems);
      setCompletionItems(result.completionItems);
    } catch (error) {
      console.error('Failed to load checklist:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load task checklist"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = async (completionItemId: string, checked: boolean) => {
    try {
      setSaving(true);
      const updatedItem = await standardTaskChecklistService.updateChecklistItemCompletion(
        completionItemId,
        checked,
        'current-user-id' // Replace with actual user ID
      );

      setCompletionItems(prev =>
        prev.map(item =>
          item.id === completionItemId ? updatedItem : item
        )
      );
    } catch (error) {
      console.error('Failed to update checklist item:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update checklist item"
      });
    } finally {
      setSaving(false);
    }
  };

  const canComplete = () => {
    const requiredItems = checklistItems.filter(item => item.is_required);
    const requiredCompletionItems = completionItems.filter(completion =>
      requiredItems.some(item => item.id === completion.checklist_item_id)
    );
    return requiredCompletionItems.every(item => item.is_checked);
  };

  const handleComplete = async () => {
    if (!canComplete()) {
      toast({
        variant: "destructive",
        title: "Incomplete Checklist",
        description: "Please complete all required checklist items before finishing the task."
      });
      return;
    }
    onComplete();
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loading Checklist...</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // If no checklist items, complete task immediately
  if (checklistItems.length === 0) {
    onComplete();
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Complete Task: {taskTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Please complete the following checklist before finishing this task:
          </p>

          <ScrollArea className="max-h-64">
            <div className="space-y-3">
              {checklistItems.map(item => {
                const completionItem = completionItems.find(
                  comp => comp.checklist_item_id === item.id
                );
                const isChecked = completionItem?.is_checked || false;

                return (
                  <div key={item.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        if (completionItem) {
                          handleCheckboxChange(completionItem.id, checked as boolean);
                        }
                      }}
                      disabled={saving}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${isChecked ? 'line-through text-muted-foreground' : ''}`}>
                        {item.item_text}
                      </p>
                      {item.is_required && (
                        <p className="text-xs text-muted-foreground mt-1">Required</p>
                      )}
                    </div>
                    {isChecked && (
                      <CheckCircle className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {!canComplete() && (
            <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-lg flex items-center gap-2">
              <XCircle className="h-4 w-4 text-warning flex-shrink-0" />
              <p className="text-xs text-warning">
                Complete all required items to finish the task
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button 
            onClick={handleComplete} 
            disabled={!canComplete() || saving}
          >
            {saving ? 'Saving...' : 'Complete Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};