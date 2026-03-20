import { supabase } from '@/integrations/supabase/client';

/**
 * Recalculates task due_dates for a project based on the installation date
 * and each task's standard_task day_counter.
 * 
 * Formula: due_date = installation_date - day_counter
 */
export async function recalculateTaskDueDates(projectId: string, installationDate: string): Promise<void> {
  // Get phases for the project
  const { data: phases, error: phasesError } = await supabase
    .from('phases')
    .select('id')
    .eq('project_id', projectId);

  if (phasesError || !phases || phases.length === 0) {
    console.log('No phases found for project', projectId);
    return;
  }

  const phaseIds = phases.map(p => p.id);

  const { data: projectTasks, error: projectTasksError } = await supabase
    .from('tasks')
    .select('id, standard_task_id')
    .in('phase_id', phaseIds)
    .not('standard_task_id', 'is', null);

  if (projectTasksError || !projectTasks || projectTasks.length === 0) {
    console.log('No tasks with standard_task_id found for project', projectId);
    return;
  }

  const standardTaskIds = [...new Set(projectTasks.map(t => t.standard_task_id).filter(Boolean))] as string[];

  const { data: standardTasks, error: stError } = await supabase
    .from('standard_tasks')
    .select('id, day_counter')
    .in('id', standardTaskIds);

  if (stError || !standardTasks) {
    console.error('Error fetching standard tasks:', stError);
    return;
  }

  const dayCounterMap = new Map(standardTasks.map(st => [st.id, st.day_counter || 0]));
  const installDate = new Date(installationDate + 'T00:00:00');

  const updates = projectTasks.map(task => {
    const dayCounter = dayCounterMap.get(task.standard_task_id!) || 0;
    const dueDate = new Date(installDate);
    dueDate.setDate(dueDate.getDate() - dayCounter);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    return supabase
      .from('tasks')
      .update({ due_date: dueDateStr, updated_at: new Date().toISOString() })
      .eq('id', task.id);
  });

  const results = await Promise.all(updates);
  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    console.error('Some task due_date updates failed:', errors.map(e => e.error));
  } else {
    console.log(`Updated ${updates.length} task due_dates for project ${projectId}`);
  }
}