import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { taskService, Task } from '@/services/dataService';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { useAuth } from '@/context/AuthContext';
import TaskList from '@/components/TaskList';
import Navbar from '@/components/Navbar';
import { useToast } from '@/hooks/use-toast';

interface ExtendedTask extends Task {
  timeRemaining?: string;
  isOvertime?: boolean;
  assignee_name?: string;
}

const PersonalTasks = () => {
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTasks, setActiveTasks] = useState<ExtendedTask[]>([]);

  const { data: tasks, isLoading, error } = useQuery({
    queryKey: ['personalTasks', currentEmployee?.id],
    queryFn: () => taskService.getTasksForEmployee(currentEmployee?.id || ''),
    enabled: !!currentEmployee?.id,
    refetchInterval: 30000,
  });

  const { data: activeRegistration } = useQuery({
    queryKey: ['activeRegistration', currentEmployee?.id],
    queryFn: () => timeRegistrationService.getActiveRegistration(currentEmployee?.id || ''),
    enabled: !!currentEmployee?.id,
    refetchInterval: 1000,
  });

  useEffect(() => {
    if (tasks && activeRegistration) {
      const updatedTasks = tasks.map(task => {
        if (task.id === activeRegistration.task_id && task.status === 'IN_PROGRESS' && task.duration) {
          const startTime = new Date(activeRegistration.start_time);
          const now = new Date();
          const elapsedMinutes = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
          const remainingMinutes = Math.max(0, task.duration - elapsedMinutes);
          const isOvertime = elapsedMinutes > task.duration;
          
          const hours = Math.floor(Math.abs(remainingMinutes) / 60);
          const minutes = Math.abs(remainingMinutes) % 60;
          const timeString = `${hours}:${minutes.toString().padStart(2, '0')}`;
          
          return {
            ...task,
            timeRemaining: timeString,
            isOvertime: isOvertime
          };
        }
        return task;
      });
      setActiveTasks(updatedTasks);
    } else if (tasks) {
      setActiveTasks(tasks);
    }
  }, [tasks, activeRegistration]);

  const handleTaskStatusChange = async (taskId: string, status: "TODO" | "IN_PROGRESS" | "COMPLETED" | "HOLD") => {
    if (!currentEmployee) return;

    try {
      if (status === 'IN_PROGRESS') {
        // Start time registration
        await timeRegistrationService.startTask(currentEmployee.id, taskId);
        toast({
          title: "Task Started",
          description: "Time tracking has begun for this task.",
        });
      } else if (status === 'COMPLETED') {
        // Complete the task and stop time registration
        await timeRegistrationService.completeTask(taskId);
        toast({
          title: "Task Completed",
          description: "Task has been marked as completed and time tracking stopped.",
        });
      } else if (status === 'TODO') {
        // Stop active registration if going back to TODO
        if (activeRegistration && activeRegistration.task_id === taskId) {
          await timeRegistrationService.stopTask(activeRegistration.id);
          toast({
            title: "Task Stopped",
            description: "Time tracking has been stopped for this task.",
          });
        }
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['personalTasks'] });
      queryClient.invalidateQueries({ queryKey: ['activeRegistration'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update task status",
        variant: "destructive"
      });
    }
  };

  if (currentEmployee?.role === 'workstation') {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-4xl mx-auto p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Personal tasks not available for workstation users</h1>
            <p className="text-gray-600">Personal task management is not available for workstation role users.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
        <div className="ml-64 w-full p-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center">Loading your tasks...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
        <div className="ml-64 w-full p-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center text-red-600">Error loading tasks: {error.message}</div>
          </div>
        </div>
      </div>
    );
  }

  const todoTasks = activeTasks.filter(task => task.status === 'TODO');
  const inProgressTasks = activeTasks.filter(task => task.status === 'IN_PROGRESS');
  const completedTasks = activeTasks.filter(task => task.status === 'COMPLETED');
  const holdTasks = activeTasks.filter(task => task.status === 'HOLD');

  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      <div className="ml-64 w-full p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">My Tasks</h1>
          
          <div className="space-y-8">
            {inProgressTasks.length > 0 && (
              <TaskList
                tasks={inProgressTasks}
                title="In Progress"
                onTaskStatusChange={handleTaskStatusChange}
                showCountdownTimer={true}
              />
            )}
            
            {todoTasks.length > 0 && (
              <TaskList
                tasks={todoTasks}
                title="To Do"
                onTaskStatusChange={handleTaskStatusChange}
              />
            )}
            
            {holdTasks.length > 0 && (
              <TaskList
                tasks={holdTasks}
                title="On Hold"
                onTaskStatusChange={handleTaskStatusChange}
              />
            )}
            
            {completedTasks.length > 0 && (
              <TaskList
                tasks={completedTasks}
                title="Completed"
                onTaskStatusChange={handleTaskStatusChange}
              />
            )}
            
            {activeTasks.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                No tasks assigned to you at the moment.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalTasks;
