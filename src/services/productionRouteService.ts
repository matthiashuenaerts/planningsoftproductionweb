import { supabase } from '@/integrations/supabase/client';

export interface ProductionRoute {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionRouteTask {
  id: string;
  route_id: string;
  standard_task_id: string;
  created_at: string;
}

export interface ProductionRouteWithTasks extends ProductionRoute {
  tasks: ProductionRouteTask[];
}

export const productionRouteService = {
  async getAll(): Promise<ProductionRoute[]> {
    const { data, error } = await supabase
      .from('production_routes')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async getById(id: string): Promise<ProductionRouteWithTasks | null> {
    const { data: route, error: routeError } = await supabase
      .from('production_routes')
      .select('*')
      .eq('id', id)
      .single();

    if (routeError) throw routeError;
    if (!route) return null;

    const { data: tasks, error: tasksError } = await supabase
      .from('production_route_tasks')
      .select('*')
      .eq('route_id', id);

    if (tasksError) throw tasksError;

    return {
      ...route,
      tasks: tasks || []
    };
  },

  async getRouteTasks(routeId: string): Promise<ProductionRouteTask[]> {
    const { data, error } = await supabase
      .from('production_route_tasks')
      .select('*')
      .eq('route_id', routeId);

    if (error) throw error;
    return data || [];
  },

  async create(name: string, description: string | null): Promise<ProductionRoute> {
    const { data, error } = await supabase
      .from('production_routes')
      .insert({ name, description })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, name: string, description: string | null): Promise<ProductionRoute> {
    const { data, error } = await supabase
      .from('production_routes')
      .update({ name, description })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('production_routes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async addTaskToRoute(routeId: string, standardTaskId: string): Promise<ProductionRouteTask> {
    const { data, error } = await supabase
      .from('production_route_tasks')
      .insert({ route_id: routeId, standard_task_id: standardTaskId })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async removeTaskFromRoute(routeId: string, standardTaskId: string): Promise<void> {
    const { error } = await supabase
      .from('production_route_tasks')
      .delete()
      .eq('route_id', routeId)
      .eq('standard_task_id', standardTaskId);

    if (error) throw error;
  },

  async setRouteTasks(routeId: string, standardTaskIds: string[]): Promise<void> {
    // First delete all existing tasks for this route
    const { error: deleteError } = await supabase
      .from('production_route_tasks')
      .delete()
      .eq('route_id', routeId);

    if (deleteError) throw deleteError;

    // Then insert new tasks
    if (standardTaskIds.length > 0) {
      const tasksToInsert = standardTaskIds.map(taskId => ({
        route_id: routeId,
        standard_task_id: taskId
      }));

      const { error: insertError } = await supabase
        .from('production_route_tasks')
        .insert(tasksToInsert);

      if (insertError) throw insertError;
    }
  }
};
