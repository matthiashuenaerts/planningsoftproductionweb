import { supabase } from "@/integrations/supabase/client";

export interface ChecklistItem {
  id: string;
  standard_task_id: string;
  item_text: string;
  is_required: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export const checklistService = {
  async getChecklistItems(standardTaskId: string): Promise<ChecklistItem[]> {
    try {
      const { data, error } = await supabase
        .from('standard_task_checklists' as any)
        .select('*')
        .eq('standard_task_id', standardTaskId)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return (data as any[])?.map(item => ({
        id: item.id,
        standard_task_id: item.standard_task_id,
        item_text: item.item_text,
        is_required: item.is_required,
        display_order: item.display_order,
        created_at: item.created_at,
        updated_at: item.updated_at
      })) || [];
    } catch (error) {
      console.error('Error fetching checklist items:', error);
      return [];
    }
  },

  async addChecklistItem(standardTaskId: string, itemText: string, isRequired: boolean = true): Promise<ChecklistItem> {
    try {
      // Get the next display order
      const { data: existingItems } = await supabase
        .from('standard_task_checklists' as any)
        .select('display_order')
        .eq('standard_task_id', standardTaskId)
        .order('display_order', { ascending: false })
        .limit(1);
      
      const nextOrder = existingItems && existingItems.length > 0 ? (existingItems[0] as any).display_order + 1 : 0;
      
      const { data, error } = await supabase
        .from('standard_task_checklists' as any)
        .insert({
          standard_task_id: standardTaskId,
          item_text: itemText,
          is_required: isRequired,
          display_order: nextOrder
        })
        .select()
        .single();
      
      if (error) throw error;
      const item = data as any;
      return {
        id: item.id,
        standard_task_id: item.standard_task_id,
        item_text: item.item_text,
        is_required: item.is_required,
        display_order: item.display_order,
        created_at: item.created_at,
        updated_at: item.updated_at
      };
    } catch (error) {
      console.error('Error adding checklist item:', error);
      throw error;
    }
  },

  async updateChecklistItem(id: string, itemText: string, isRequired: boolean): Promise<ChecklistItem> {
    try {
      const { data, error } = await supabase
        .from('standard_task_checklists' as any)
        .update({
          item_text: itemText,
          is_required: isRequired,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      const item = data as any;
      return {
        id: item.id,
        standard_task_id: item.standard_task_id,
        item_text: item.item_text,
        is_required: item.is_required,
        display_order: item.display_order,
        created_at: item.created_at,
        updated_at: item.updated_at
      };
    } catch (error) {
      console.error('Error updating checklist item:', error);
      throw error;
    }
  },

  async deleteChecklistItem(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('standard_task_checklists' as any)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting checklist item:', error);
      throw error;
    }
  },

  async reorderChecklistItems(standardTaskId: string, orderedIds: string[]): Promise<void> {
    try {
      const updates = orderedIds.map((id, index) => ({
        id,
        display_order: index,
        updated_at: new Date().toISOString()
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('standard_task_checklists' as any)
          .update({ display_order: update.display_order, updated_at: update.updated_at })
          .eq('id', update.id);
        
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error reordering checklist items:', error);
      throw error;
    }
  }
};