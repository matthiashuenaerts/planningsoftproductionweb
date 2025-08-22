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
    const { data, error } = await supabase
      .from('standard_task_checklists')
      .select('*')
      .eq('standard_task_id', standardTaskId)
      .order('display_order', { ascending: true });
    
    if (error) throw error;
    return data as ChecklistItem[] || [];
  },

  async addChecklistItem(standardTaskId: string, itemText: string, isRequired: boolean = true): Promise<ChecklistItem> {
    // Get the next display order
    const { data: existingItems } = await supabase
      .from('standard_task_checklists')
      .select('display_order')
      .eq('standard_task_id', standardTaskId)
      .order('display_order', { ascending: false })
      .limit(1);
    
    const nextOrder = existingItems && existingItems.length > 0 ? existingItems[0].display_order + 1 : 0;
    
    const { data, error } = await supabase
      .from('standard_task_checklists')
      .insert({
        standard_task_id: standardTaskId,
        item_text: itemText,
        is_required: isRequired,
        display_order: nextOrder
      })
      .select()
      .single();
    
    if (error) throw error;
    return data as ChecklistItem;
  },

  async updateChecklistItem(id: string, itemText: string, isRequired: boolean): Promise<ChecklistItem> {
    const { data, error } = await supabase
      .from('standard_task_checklists')
      .update({
        item_text: itemText,
        is_required: isRequired,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as ChecklistItem;
  },

  async deleteChecklistItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('standard_task_checklists')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async reorderChecklistItems(standardTaskId: string, orderedIds: string[]): Promise<void> {
    const updates = orderedIds.map((id, index) => ({
      id,
      display_order: index,
      updated_at: new Date().toISOString()
    }));

    for (const update of updates) {
      const { error } = await supabase
        .from('standard_task_checklists')
        .update({ display_order: update.display_order, updated_at: update.updated_at })
        .eq('id', update.id);
      
      if (error) throw error;
    }
  }
};