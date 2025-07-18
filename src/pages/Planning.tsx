import React, { useState, useEffect } from 'react';
import { format, addDays, isWeekend } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { planningService } from '@/services/planningService';
import { Schedule } from '@/services/planningService';
import { WorkstationSchedule } from '@/services/planningService';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Settings, Clock, Zap, Calendar } from 'lucide-react';

interface Holiday {
  date: string;
  description: string;
}

const Planning = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [workstationSchedules, setWorkstationSchedules] = useState<WorkstationSchedule[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  const [generatingWorkstationSchedule, setGeneratingWorkstationSchedule] = useState(false);
  const [generatingPersonalSchedule, setGeneratingPersonalSchedule] = useState(false);
  const [generatingNextSchedule, setGeneratingNextSchedule] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [availableEmployees, setAvailableEmployees] = useState<{ id: string; name: string }[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchHolidays();
    fetchAvailableEmployees();
    refetchSchedules();
    refetchWorkstationSchedules();
  }, [selectedDate]);

  const fetchHolidays = async () => {
    try {
      const { data, error } = await planningService.getAvailableTasksForPlanning();
      if (error) throw error;
    } catch (error: any) {
      console.error("Error fetching holidays:", error);
      toast({
        title: "Error",
        description: "Failed to load holidays",
        variant: "destructive"
      });
    }
  };

  const fetchAvailableEmployees = async () => {
    try {
      const { data, error } = await planningService.getAvailableTasksForPlanning();
      if (error) throw error;
    } catch (error: any) {
      console.error("Error fetching available employees:", error);
      toast({
        title: "Error",
        description: "Failed to load available employees",
        variant: "destructive"
      });
    }
  };

  const refetchSchedules = async () => {
    try {
      const schedules = await planningService.getSchedulesByDate(selectedDate);
      setSchedules(schedules);
    } catch (error: any) {
      console.error("Error fetching schedules:", error);
      toast({
        title: "Error",
        description: "Failed to load schedules",
        variant: "destructive"
      });
    }
  };

  const refetchWorkstationSchedules = async () => {
    try {
      const workstationSchedules = await planningService.getWorkstationSchedulesByDate(selectedDate);
      setWorkstationSchedules(workstationSchedules);
    } catch (error: any) {
      console.error("Error fetching workstation schedules:", error);
      toast({
        title: "Error",
        description: "Failed to load workstation schedules",
        variant: "destructive"
      });
    }
  };

  const generateDailyPlan = async () => {
    try {
      setGeneratingSchedule(true);
      await planningService.generateDailyPlan(selectedDate);
      toast({
        title: "Schedule Generated",
        description: "Successfully generated the daily plan",
      });
      await Promise.all([
        refetchSchedules(),
        refetchWorkstationSchedules(),
      ]);
    } catch (error: any) {
      console.error("Error generating daily plan:", error);
      toast({
        title: "Error",
        description: `Failed to generate schedule: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setGeneratingSchedule(false);
    }
  };

  const generateWorkstationSchedules = async () => {
    try {
      setGeneratingWorkstationSchedule(true);
      await planningService.generateWorkstationSchedulesForDate(selectedDate);
      toast({
        title: "Workstation Schedules Generated",
        description: "Successfully generated workstation schedules",
      });
      await Promise.all([
        refetchSchedules(),
        refetchWorkstationSchedules(),
      ]);
    } catch (error: any) {
      console.error("Error generating workstation schedules:", error);
      toast({
        title: "Error",
        description: `Failed to generate workstation schedules: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setGeneratingWorkstationSchedule(false);
    }
  };

  const generatePersonalPlan = async () => {
    if (!employeeId) {
      toast({
        title: "Error",
        description: "Please select an employee",
        variant: "destructive",
      });
      return;
    }

    try {
      setGeneratingPersonalSchedule(true);
      await planningService.generatePlanFromPersonalTasks(employeeId, selectedDate);
      toast({
        title: "Personal Plan Generated",
        description: "Successfully generated personal plan for the selected employee",
      });
      await Promise.all([
        refetchSchedules(),
        refetchWorkstationSchedules(),
      ]);
    } catch (error: any) {
      console.error("Error generating personal plan:", error);
      toast({
        title: "Error",
        description: `Failed to generate personal plan: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setGeneratingPersonalSchedule(false);
    }
  };

  const generateScheduleForNextWorkingDay = async () => {
    try {
      setGeneratingNextSchedule(true);
      
      const today = new Date();
      const nextWorkingDay = getNextNonHolidayWorkingDay(today);
      
      if (!nextWorkingDay) {
        toast({
          title: "Error",
          description: "Could not determine next working day",
          variant: "destructive",
        });
        return;
      }

      // Use the enhanced method that analyzes today's tasks
      await planningService.generateScheduleForNextWorkingDay(today, nextWorkingDay);
      
      toast({
        title: "Schedule Generated",
        description: `Schedule generated for ${format(nextWorkingDay, 'EEEE, MMMM d, yyyy')} based on today's task analysis`,
      });
      
      // Refresh data if viewing the generated date
      if (format(selectedDate, 'yyyy-MM-dd') === format(nextWorkingDay, 'yyyy-MM-dd')) {
        await Promise.all([
          refetchSchedules(),
          refetchWorkstationSchedules(),
        ]);
      }
    } catch (error: any) {
      console.error('Error generating schedule for next working day:', error);
      toast({
        title: "Error",
        description: `Failed to generate schedule: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setGeneratingNextSchedule(false);
    }
  };

  const isHoliday = (date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return holidays.some(holiday => holiday.date === dateStr);
  };

  const getNextNonHolidayWorkingDay = (date: Date): Date | null => {
    let nextDay = addDays(date, 1);
    let attempts = 0;
    
    while ((isWeekend(nextDay) || isHoliday(nextDay)) && attempts < 365) {
      nextDay = addDays(nextDay, 1);
      attempts++;
    }

    return attempts < 365 ? nextDay : null;
  };

  const getNextWorkingDayLabel = (): string => {
    const nextWorkingDay = getNextNonHolidayWorkingDay(selectedDate);
    if (nextWorkingDay) {
      return `for ${format(nextWorkingDay, 'EEE, MMM d')}`;
    }
    return "for Next Working Day";
  };

  const hasTodaySchedule = schedules.length > 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Planning</h1>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-[280px] justify-start text-left font-normal",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) =>
                date > new Date() || isHoliday(date)
              }
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex gap-4 flex-wrap">
        <Button
          onClick={generateDailyPlan}
          disabled={generatingSchedule || isHoliday(selectedDate)}
          className="flex items-center gap-2"
          title={isHoliday(selectedDate) ? "Cannot generate schedule on holidays" : ""}
        >
          <Zap className="h-4 w-4" />
          {generatingSchedule ? 'Generating...' : 'Generate Schedule'}
        </Button>

        <Button
          onClick={generateScheduleForNextWorkingDay}
          disabled={generatingNextSchedule || !hasTodaySchedule || isHoliday(selectedDate)}
          className="flex items-center gap-2"
          title={
            isHoliday(selectedDate) 
              ? "Cannot generate on holidays" 
              : !hasTodaySchedule 
                ? "Generate today's schedule first" 
                : ""
          }
        >
          <Calendar className="h-4 w-4" />
          {generatingNextSchedule ? 'Analyzing & Generating...' : `Generate Schedule ${getNextWorkingDayLabel()}`}
        </Button>

        <Button
          onClick={generateWorkstationSchedules}
          disabled={generatingWorkstationSchedule || isHoliday(selectedDate)}
          className="flex items-center gap-2"
          title={isHoliday(selectedDate) ? "Cannot generate schedule on holidays" : ""}
        >
          <Settings className="h-4 w-4" />
          {generatingWorkstationSchedule ? 'Generating...' : 'Generate Workstation Schedules'}
        </Button>

        <Drawer>
          <DrawerTrigger asChild>
            <Button
              variant="outline"
              className="flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              Generate Personal Plan
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Generate Personal Plan</DrawerTitle>
              <DrawerDescription>
                Generate a personal plan for a specific employee on the selected date.
              </DrawerDescription>
            </DrawerHeader>
            <div className="p-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employee">Employee</Label>
                  <Select onValueChange={setEmployeeId}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableEmployees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DrawerFooter>
              <Button
                onClick={generatePersonalPlan}
                disabled={generatingPersonalSchedule || isHoliday(selectedDate) || !employeeId}
                className="flex items-center gap-2"
              >
                {generatingPersonalSchedule ? 'Generating...' : 'Generate Personal Plan'}
              </Button>
              <DrawerClose>
                <Button variant="outline">Cancel</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold mb-2">Schedules</h2>
            {schedules.length === 0 ? (
              <div className="text-center text-gray-500">
                <Settings className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                <p>No schedules found for this date</p>
              </div>
            ) : (
              <Table>
                <TableCaption>A list of schedules for the selected date.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Time</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Employee</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-medium">{format(new Date(schedule.start_time), 'HH:mm')}</TableCell>
                      <TableCell>{schedule.title}</TableCell>
                      <TableCell>{schedule.employee_id}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="text-lg font-semibold mb-2">Workstation Schedules</h2>
            {workstationSchedules.length === 0 ? (
              <div className="text-center text-gray-500">
                <Settings className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                <p>No workstation schedules found for this date</p>
              </div>
            ) : (
              <Table>
                <TableCaption>A list of workstation schedules for the selected date.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Time</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Workstation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workstationSchedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-medium">{format(new Date(schedule.start_time), 'HH:mm')}</TableCell>
                      <TableCell>{schedule.task_title}</TableCell>
                      <TableCell>{schedule.workstation_id}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Planning;
