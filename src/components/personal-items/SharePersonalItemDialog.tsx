
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Users, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { PersonalItem } from '@/pages/NotesAndTasks';
import { useQuery } from '@tanstack/react-query';

interface SharePersonalItemDialogProps {
  item: PersonalItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Employee {
  id: string;
  name: string;
}

const SharePersonalItemDialog: React.FC<SharePersonalItemDialogProps> = ({
  item,
  open,
  onOpenChange,
  onSuccess
}) => {
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [canEdit, setCanEdit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-for-sharing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name')
        .neq('id', currentEmployee?.id)
        .order('name');

      if (error) throw error;
      return data as Employee[];
    },
    enabled: open && !!currentEmployee?.id,
  });

  const handleShare = async () => {
    if (!selectedEmployeeId) return;

    setIsSubmitting(true);
    try {
      // Check if already shared with this user
      const { data: existingShare } = await supabase
        .from('personal_item_shares')
        .select('id')
        .eq('personal_item_id', item.id)
        .eq('shared_with_user_id', selectedEmployeeId)
        .single();

      if (existingShare) {
        toast({
          title: "Already shared",
          description: "This item is already shared with this user",
          variant: "destructive",
        });
        return;
      }

      // Create the share
      const { error: shareError } = await supabase
        .from('personal_item_shares')
        .insert({
          personal_item_id: item.id,
          shared_with_user_id: selectedEmployeeId,
          shared_by_user_id: currentEmployee?.id,
          can_edit: canEdit,
        });

      if (shareError) throw shareError;

      // Update the item's is_shared flag
      const { error: updateError } = await supabase
        .from('personal_items')
        .update({ is_shared: true })
        .eq('id', item.id);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Item shared successfully",
      });

      setSelectedEmployeeId('');
      setCanEdit(false);
      onSuccess();
    } catch (error) {
      console.error('Error sharing item:', error);
      toast({
        title: "Error",
        description: "Failed to share item",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    try {
      const { error } = await supabase
        .from('personal_item_shares')
        .delete()
        .eq('id', shareId);

      if (error) throw error;

      // Check if there are any remaining shares
      const { data: remainingShares, error: checkError } = await supabase
        .from('personal_item_shares')
        .select('id')
        .eq('personal_item_id', item.id);

      if (checkError) throw checkError;

      // If no more shares, update is_shared flag
      if (remainingShares.length === 0) {
        const { error: updateError } = await supabase
          .from('personal_items')
          .update({ is_shared: false })
          .eq('id', item.id);

        if (updateError) throw updateError;
      }

      toast({
        title: "Success",
        description: "Share removed successfully",
      });

      onSuccess();
    } catch (error) {
      console.error('Error removing share:', error);
      toast({
        title: "Error",
        description: "Failed to remove share",
        variant: "destructive",
      });
    }
  };

  const availableEmployees = employees.filter(emp => 
    !item.shares?.some(share => share.shared_with_user_id === emp.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Share "{item.title}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current shares */}
          {item.shares && item.shares.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Currently shared with:</Label>
              <div className="space-y-2">
                {item.shares.map((share) => (
                  <div key={share.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{share.employee_name}</span>
                      {share.can_edit && (
                        <Badge variant="secondary" className="text-xs">
                          Can edit
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveShare(share.id)}
                      className="p-1 h-6 w-6 text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add new share */}
          {availableEmployees.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Share with:</Label>
              
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  {availableEmployees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="can-edit"
                  checked={canEdit}
                  onCheckedChange={(checked) => setCanEdit(checked as boolean)}
                />
                <Label htmlFor="can-edit" className="text-sm">
                  Allow editing
                </Label>
              </div>

              <Button
                onClick={handleShare}
                disabled={!selectedEmployeeId || isSubmitting}
                className="w-full"
              >
                {isSubmitting ? 'Sharing...' : 'Share'}
              </Button>
            </div>
          )}

          {availableEmployees.length === 0 && (!item.shares || item.shares.length === 0) && (
            <p className="text-sm text-gray-500 text-center py-4">
              No employees available to share with
            </p>
          )}

          {availableEmployees.length === 0 && item.shares && item.shares.length > 0 && (
            <p className="text-sm text-gray-500 text-center py-2">
              Item is shared with all available employees
            </p>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SharePersonalItemDialog;
