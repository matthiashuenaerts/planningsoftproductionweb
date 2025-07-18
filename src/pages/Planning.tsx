import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { planningService } from '../services/planningService';
import { useQuery } from '@tanstack/react-query';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface Schedule {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  employee_id: string;
  task_id?: string;
  phase_id?: string;
  description?: string;
  is_auto_generated?: boolean;
  employees?: {
    id: string;
    name: string;
  };
  tasks?: {
    id: string;
    title: string;
    standard_tasks?: {
      id: string;
      task_name: string;
      task_number: string;
    };
  };
  phases?: {
    id: string;
    name: string;
    projects?: {
      id: string;
      name: string;
      client: string;
    };
  };
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Schedule;
}

const Planning = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isGenerating, setIsGenerating] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const { data: schedulesData, refetch } = useQuery({
    queryKey: ['schedules', selectedDate],
    queryFn: async () => {
      const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
      
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          *,
          employees (
            id,
            name
          ),
          tasks (
            id,
            title,
            standard_tasks (
              id,
              task_name,
              task_number
            )
          ),
          phases (
            id,
            name,
            projects (
              id,
              name,
              client
            )
          )
        `)
        .gte('start_time', startOfMonth.toISOString())
        .lte('start_time', endOfMonth.toISOString())
        .order('start_time');

      if (error) throw error;
      return data as Schedule[];
    },
  });

  useEffect(() => {
    if (schedulesData) {
      setSchedules(schedulesData);
    }
  }, [schedulesData]);

  const events: CalendarEvent[] = schedules.map(schedule => ({
    id: schedule.id,
    title: `${schedule.employees?.name || 'Unknown'}: ${schedule.title}`,
    start: new Date(schedule.start_time),
    end: new Date(schedule.end_time),
    resource: schedule,
  }));

  const generateTomorrowSchedule = async () => {
    if (!selectedDate) return;

    try {
      setIsGenerating(true);
      
      // Get today's date and tomorrow's date
      const today = new Date(selectedDate);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Skip weekends and holidays
      while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
        tomorrow.setDate(tomorrow.getDate() + 1);
      }

      // Check if tomorrow is a holiday for production team
      const { data: holidays } = await supabase
        .from('holidays')
        .select('*')
        .eq('date', tomorrow.toISOString().split('T')[0])
        .eq('team', 'production');

      if (holidays && holidays.length > 0) {
        // Skip to next working day
        tomorrow.setDate(tomorrow.getDate() + 1);
        while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
          tomorrow.setDate(tomorrow.getDate() + 1);
        }
      }

      console.log("Generating schedule for:", tomorrow.toISOString().split('T')[0]);

      // Get today's tasks to analyze what's completed/in progress
      const { data: todaysTasks } = await supabase
        .from('tasks')
        .select(`
          *,
          standard_tasks (
            id,
            task_name,
            task_number
          ),
          phases (
            id,
            name,
            project_id,
            projects (
              id,
              name,
              client
            )
          )
        `)
        .eq('due_date', today.toISOString().split('T')[0]);

      console.log("Today's tasks:", todaysTasks);

      // Get all limit task relationships to understand dependencies
      const { data: limitTasks } = await supabase
        .from('standard_task_limit_phases')
        .select(`
          *,
          standard_tasks!standard_task_limit_phases_standard_task_id_fkey (
            id,
            task_name,
            task_number
          ),
          limit_standard_task:standard_tasks!standard_task_limit_phases_limit_standard_task_id_fkey (
            id,
            task_name,
            task_number
          )
        `);

      console.log("Limit tasks:", limitTasks);

      // Find tasks that will be unlocked tomorrow based on today's completed/in-progress tasks
      const unlockedTaskIds = new Set<string>();
      
      if (todaysTasks && limitTasks) {
        // For each of today's tasks that are completed or in progress
        todaysTasks.forEach(todayTask => {
          if (todayTask.status === 'COMPLETED' || todayTask.status === 'IN_PROGRESS') {
            // Find what tasks this unlocks
            limitTasks.forEach(limitTask => {
              if (limitTask.limit_standard_task?.id === todayTask.standard_task_id) {
                unlockedTaskIds.add(limitTask.standard_tasks?.id);
                console.log(`Task ${todayTask.title} unlocks ${limitTask.standard_tasks?.task_name}`);
              }
            });
          }
        });
      }

      console.log("Unlocked task IDs:", Array.from(unlockedTaskIds));

      // Get all available workers
      const workersResult = await planningService.getAvailableWorkers();
      if (workersResult.error || !workersResult.data) {
        toast.error("Failed to fetch available workers");
        return;
      }

      const workers = workersResult.data;
      console.log("Available workers:", workers);

      // Get ongoing projects with active phases
      const { data: activeProjects } = await supabase
        .from('projects')
        .select(`
          *,
          phases (
            *,
            tasks (
              *,
              standard_tasks (
                id,
                task_name,
                task_number,
                time_coefficient
              )
            )
          )
        `)
        .in('status', ['ACTIVE', 'IN_PROGRESS'])
        .order('installation_date', { ascending: true });

      console.log("Active projects:", activeProjects);

      if (!activeProjects || activeProjects.length === 0) {
        toast.info("No active projects found for scheduling");
        return;
      }

      const tasksToSchedule: any[] = [];

      // Process each project
      activeProjects.forEach(project => {
        if (!project.phases) return;

        project.phases.forEach((phase: any) => {
          if (!phase.tasks) return;

          // Find tasks that should continue from today or are newly unlocked
          phase.tasks.forEach((task: any) => {
            const isUnlocked = unlockedTaskIds.has(task.standard_task_id);
            const isContinuation = todaysTasks?.some(todayTask => 
              todayTask.standard_task_id === task.standard_task_id &&
              todayTask.status === 'IN_PROGRESS' &&
              todayTask.phases?.project_id === project.id
            );

            // Include task if it's unlocked by today's work or is a continuation
            if (isUnlocked || isContinuation) {
              tasksToSchedule.push({
                ...task,
                project_name: project.name,
                project_client: project.client,
                phase_name: phase.name,
                is_continuation: isContinuation,
                is_newly_unlocked: isUnlocked
              });
            }
          });
        });
      });

      console.log("Tasks to schedule:", tasksToSchedule);

      if (tasksToSchedule.length === 0) {
        toast.info("No tasks available for scheduling tomorrow based on today's progress");
        return;
      }

      // Sort tasks by priority: continuations first, then newly unlocked
      tasksToSchedule.sort((a, b) => {
        if (a.is_continuation && !b.is_continuation) return -1;
        if (!a.is_continuation && b.is_continuation) return 1;
        if (a.is_newly_unlocked && !b.is_newly_unlocked) return -1;
        if (!a.is_newly_unlocked && b.is_newly_unlocked) return 1;
        return 0;
      });

      // Create schedule entries for tomorrow
      const scheduleEntries = [];
      let currentTime = new Date(tomorrow);
      currentTime.setHours(8, 0, 0, 0); // Start at 8 AM

      for (let i = 0; i < Math.min(tasksToSchedule.length, workers.length); i++) {
        const task = tasksToSchedule[i];
        const worker = workers[i];
        
        const startTime = new Date(currentTime);
        const endTime = new Date(currentTime);
        endTime.setHours(endTime.getHours() + (task.duration || 4)); // Default 4 hours if no duration

        const title = task.is_continuation 
          ? `${task.title} (Continued)`
          : `${task.title} (New)`;

        scheduleEntries.push({
          title,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          employee_id: worker.id,
          task_id: task.id,
          phase_id: task.phase_id,
          description: `${task.project_name} - ${task.phase_name}${task.is_continuation ? ' (Continuation from previous day)' : ' (Unlocked by completed prerequisites)'}`,
          is_auto_generated: true
        });

        // Stagger start times for different workers
        if (i < workers.length - 1) {
          currentTime.setMinutes(currentTime.getMinutes() + 30);
        }
      }

      console.log("Schedule entries to create:", scheduleEntries);

      // Insert the schedule entries
      const { error: insertError } = await supabase
        .from('schedules')
        .insert(scheduleEntries);

      if (insertError) {
        console.error("Error creating schedule:", insertError);
        toast.error("Failed to create tomorrow's schedule");
        return;
      }

      toast.success(`Generated schedule for ${tomorrow.toLocaleDateString()} with ${scheduleEntries.length} tasks`);
      
      // Refresh the schedule data
      refetch();

    } catch (error) {
      console.error("Error generating tomorrow's schedule:", error);
      toast.error("Failed to generate tomorrow's schedule");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    const schedule = event.resource;
    console.log('Selected schedule:', schedule);
  };

  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    console.log('Selected slot:', { start, end });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Planning & Scheduling</h1>
        <div className="flex gap-4">
          <button
            onClick={generateTomorrowSchedule}
            disabled={isGenerating}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? 'Generating...' : 'Generate Tomorrow\'s Schedule'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 600 }}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          selectable
          views={['month', 'week', 'day']}
          defaultView="week"
          date={selectedDate}
          onNavigate={setSelectedDate}
          eventPropGetter={(event) => ({
            style: {
              backgroundColor: event.resource.is_auto_generated ? '#3b82f6' : '#10b981',
              borderColor: event.resource.is_auto_generated ? '#2563eb' : '#059669',
            },
          })}
        />
      </div>
    </div>
  );
};

export default Planning;
