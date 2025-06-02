
import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import TaskList from '@/components/TaskList';
import { dataService } from '@/services/dataService';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { useToast } from '@/hooks/use-toast';

const PersonalTasks = () => {
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['personal-tasks', currentEmployee?.id],
    queryFn: () => dataService.getPersonalTasks(currentEmployee?.id || ''),
    enabled: !!currentEmployee?.id,
  });

  const handleTaskStatusChange = async (taskId: string, newStatus: "TODO" | "IN_PROGRESS" | "COMPLETED" | "HOLD") => {
    if (!currentEmployee?.id) return;

    try {
      // If starting a task (TODO -> IN_PROGRESS), start time registration
      if (newStatus === 'IN_PROGRESS') {
        // Find the task to get its details
        const task = tasks.find(t => t.id === taskId);
        if (task) {
          // Stop any existing active time registration for this employee
          await timeRegistrationService.stopActiveTimeRegistration(currentEmployee.id);
          
          // Start new time registration for this task
          await timeRegistrationService.startTimeRegistration(taskId, currentEmployee.id);
          
          toast({
            title: "Task Started",
            description: "Time registration has been started for this task.",
          });
        }
      }

      // If completing a task (any status -> COMPLETED), stop time registration
      if (newStatus === 'COMPLETED') {
        await timeRegistrationService.stopActiveTimeRegistration(currentEmployee.id);
        
        toast({
          title: "Task Completed",
          description: "Time registration has been stopped and task marked as complete.",
        });
      }

      // Update task status
      await dataService.updateTaskStatus(taskId, newStatus, currentEmployee.id);
      
      // Refresh tasks
      queryClient.invalidateQueries({ queryKey: ['personal-tasks'] });
      
    } catch (error) {
      console.error('Error updating task status:', error);
      toast({
        title: "Error",
        description: "Failed to update task status",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="ml-64 container mx-auto px-4 py-8">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="ml-64 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Personal Tasks</h1>
          <p className="text-gray-600 mt-2">Your assigned tasks and responsibilities</p>
        </div>

        <TaskList 
          tasks={tasks} 
          onTaskStatusChange={handleTaskStatusChange}
          showRushOrderBadge={true}
          showCountdownTimer={true}
        />
      </div>
    </div>
  );
};

export default PersonalTasks;
