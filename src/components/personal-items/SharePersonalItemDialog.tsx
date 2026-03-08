
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Users, X, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
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
  const { t } = useLanguage();
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
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

  useEffect(() => {
    if (open) { setSelectedEmployeeIds([]); setCanEdit(false); }
  }, [open]);

  const handleEmployeeToggle = (employeeId: string) => {
    setSelectedEmployeeIds(prev => 
      prev.includes(employeeId) ? prev.filter(id => id !== employeeId) : [...prev, employeeId]
    );
  };

  const createNotifications = async (employeeIds: string[], itemTitle: string, sharerName: string) => {
    const notifications = employeeIds.map(employeeId => ({
      user_id: employeeId,
      message: `${sharerName} shared "${itemTitle}" with you`,
      read: false
    }));
    const { error } = await supabase.from('notifications').insert(notifications);
    if (error) throw error;
  };

  const handleShareWithSelected = async () => {
    if (selectedEmployeeIds.length === 0) return;
    setIsSubmitting(true);
    try {
      const { data: existingShares } = await supabase
        .from('personal_item_shares')
        .select('shared_with_user_id')
        .eq('personal_item_id', item.id)
        .in('shared_with_user_id', selectedEmployeeIds);

      const alreadySharedWith = existingShares?.map(share => share.shared_with_user_id) || [];
      const newEmployeeIds = selectedEmployeeIds.filter(id => !alreadySharedWith.includes(id));

      if (newEmployeeIds.length === 0) {
        toast({ title: t('nt_already_shared'), description: t('nt_already_shared_desc'), variant: "destructive" });
        return;
      }

      const shareInserts = newEmployeeIds.map(employeeId => ({
        personal_item_id: item.id,
        shared_with_user_id: employeeId,
        shared_by_user_id: currentEmployee?.id,
        can_edit: canEdit,
      }));

      const { error: shareError } = await supabase.from('personal_item_shares').insert(shareInserts);
      if (shareError) throw shareError;

      const { error: updateError } = await supabase.from('personal_items').update({ is_shared: true }).eq('id', item.id);
      if (updateError) throw updateError;

      await createNotifications(newEmployeeIds, item.title, currentEmployee?.name || 'Someone');

      toast({
        title: t('success') || "Success",
        description: (t('nt_shared_success') || 'Item shared with {{count}} user(s)').replace('{{count}}', String(newEmployeeIds.length)),
      });

      setSelectedEmployeeIds([]);
      setCanEdit(false);
      onSuccess();
    } catch (error) {
      console.error('Error sharing item:', error);
      toast({ title: t('error') || "Error", description: t('nt_share_failed'), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    try {
      const { error } = await supabase.from('personal_item_shares').delete().eq('id', shareId);
      if (error) throw error;

      const { data: remainingShares, error: checkError } = await supabase
        .from('personal_item_shares').select('id').eq('personal_item_id', item.id);
      if (checkError) throw checkError;

      if (remainingShares.length === 0) {
        const { error: updateError } = await supabase.from('personal_items').update({ is_shared: false }).eq('id', item.id);
        if (updateError) throw updateError;
      }

      toast({ title: t('success') || "Success", description: t('nt_share_removed') });
      onSuccess();
    } catch (error) {
      console.error('Error removing share:', error);
      toast({ title: t('error') || "Error", description: t('nt_share_remove_failed'), variant: "destructive" });
    }
  };

  const availableEmployees = employees.filter(emp => 
    !item.shares?.some(share => share.shared_with_user_id === emp.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('nt_share_title')} "{item.title}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {item.shares && item.shares.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('nt_currently_shared')}</Label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {item.shares.map((share) => (
                  <div key={share.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{share.employee_name}</span>
                      {share.can_edit && (
                        <Badge variant="secondary" className="text-xs">{t('nt_can_edit')}</Badge>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveShare(share.id)} className="p-1 h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {availableEmployees.length > 0 && (
            <div className="space-y-4 border-t pt-4">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {t('nt_share_additional')}
              </Label>
              
              <div className="space-y-3">
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                  {availableEmployees.map((employee) => (
                    <div key={employee.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`employee-${employee.id}`}
                        checked={selectedEmployeeIds.includes(employee.id)}
                        onCheckedChange={() => handleEmployeeToggle(employee.id)}
                      />
                      <Label htmlFor={`employee-${employee.id}`} className="text-sm font-normal cursor-pointer flex-1">
                        {employee.name}
                      </Label>
                    </div>
                  ))}
                </div>

                {selectedEmployeeIds.length > 0 && (
                  <div className="text-sm text-gray-600">
                    {(t('nt_users_selected') || '{{count}} user(s) selected').replace('{{count}}', String(selectedEmployeeIds.length))}
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox id="can-edit" checked={canEdit} onCheckedChange={(checked) => setCanEdit(checked as boolean)} />
                  <Label htmlFor="can-edit" className="text-sm">{t('nt_allow_editing')}</Label>
                </div>

                <Button onClick={handleShareWithSelected} disabled={selectedEmployeeIds.length === 0 || isSubmitting} className="w-full">
                  {isSubmitting 
                    ? t('nt_sharing')
                    : (t('nt_share_with_users') || 'Share with {{count}} User(s)').replace('{{count}}', String(selectedEmployeeIds.length))
                  }
                </Button>
              </div>
            </div>
          )}

          {availableEmployees.length === 0 && (!item.shares || item.shares.length === 0) && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">{t('nt_no_employees')}</p>
            </div>
          )}

          {availableEmployees.length === 0 && item.shares && item.shares.length > 0 && (
            <div className="text-center py-4 border-t">
              <p className="text-sm text-gray-500">{t('nt_shared_with_all')}</p>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('nt_done')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SharePersonalItemDialog;
