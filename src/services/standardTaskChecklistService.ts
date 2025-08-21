import { supabase } from '@/integrations/supabase/client';

export interface StandardTaskChecklistItem {
  id: string;
  standard_task_id: string;
  item_text: string;
  display_order: number;
  is_required: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaskCompletionChecklistItem {
  id: string;
  task_id: string;
  checklist_item_id: string;
  is_checked: boolean;
  checked_by?: string;
  checked_at?: string;
  created_at: string;
  updated_at: string;
}

export const standardTaskChecklistService = {
  // Get checklist items for a standard task
  async getChecklistItems(standardTaskId: string): Promise<StandardTaskChecklistItem[]> {
    const { data, error } = await supabase
      .from('standard_task_checklists')
      .select('*')
      .eq('standard_task_id', standardTaskId)
      .order('display_order');

    if (error) throw error;
    return data || [];
  },

  // Create a new checklist item
  async createChecklistItem(
    standardTaskId: string,
    itemText: string,
    displayOrder: number = 0,
    isRequired: boolean = true
  ): Promise<StandardTaskChecklistItem> {
    const { data, error } = await supabase
      .from('standard_task_checklists')
      .insert({
        standard_task_id: standardTaskId,
        item_text: itemText,
        display_order: displayOrder,
        is_required: isRequired
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update a checklist item
  async updateChecklistItem(
    id: string,
    updates: Partial<Pick<StandardTaskChecklistItem, 'item_text' | 'display_order' | 'is_required'>>
  ): Promise<StandardTaskChecklistItem> {
    const { data, error } = await supabase
      .from('standard_task_checklists')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete a checklist item
  async deleteChecklistItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('standard_task_checklists')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Get task completion checklist state
  async getTaskCompletionChecklist(taskId: string): Promise<TaskCompletionChecklistItem[]> {
    const { data, error } = await supabase
      .from('task_completion_checklists')
      .select('*')
      .eq('task_id', taskId);

    if (error) throw error;
    return data || [];
  },

  // Initialize task completion checklist
  async initializeTaskCompletionChecklist(
    taskId: string,
    checklistItems: StandardTaskChecklistItem[]
  ): Promise<TaskCompletionChecklistItem[]> {
    const completionItems = checklistItems.map(item => ({
      task_id: taskId,
      checklist_item_id: item.id,
      is_checked: false
    }));

    const { data, error } = await supabase
      .from('task_completion_checklists')
      .insert(completionItems)
      .select();

    if (error) throw error;
    return data || [];
  },

  // Update checklist item completion status
  async updateChecklistItemCompletion(
    taskCompletionItemId: string,
    isChecked: boolean,
    checkedBy?: string
  ): Promise<TaskCompletionChecklistItem> {
    const updates: any = {
      is_checked: isChecked,
      checked_by: isChecked ? checkedBy : null,
      checked_at: isChecked ? new Date().toISOString() : null
    };

    const { data, error } = await supabase
      .from('task_completion_checklists')
      .update(updates)
      .eq('id', taskCompletionItemId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Check if all required checklist items are completed
  async areAllRequiredItemsCompleted(taskId: string): Promise<boolean> {
    // Get all completion items with their corresponding checklist items
    const { data, error } = await supabase
      .from('task_completion_checklists')
      .select(`
        *,
        checklist_item:standard_task_checklists(is_required)
      `)
      .eq('task_id', taskId);

    if (error) throw error;
    if (!data || data.length === 0) return true; // No checklist means no requirements

    // Check if all required items are checked
    const requiredItems = data.filter(item => 
      item.checklist_item && (item.checklist_item as any).is_required
    );

    return requiredItems.every(item => item.is_checked);
  },

  // Get checklist items for task completion (with completion status)
  async getTaskCompletionChecklistWithItems(taskId: string, standardTaskId: string) {
    // First get the standard checklist items
    const checklistItems = await this.getChecklistItems(standardTaskId);
    
    if (checklistItems.length === 0) {
      return { checklistItems: [], completionItems: [] };
    }

    // Get existing completion items
    let completionItems = await this.getTaskCompletionChecklist(taskId);

    // If no completion items exist, initialize them
    if (completionItems.length === 0) {
      completionItems = await this.initializeTaskCompletionChecklist(taskId, checklistItems);
    }

    return { checklistItems, completionItems };
  }
};