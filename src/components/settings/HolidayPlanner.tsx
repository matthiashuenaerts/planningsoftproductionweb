
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar } from '@/components/ui/calendar';
import { holidayService, Holiday } from '@/services/holidayService';
import { workingHoursService, WorkingHours } from '@/services/workingHoursService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const HolidayPlanner: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingTeam, setEditingTeam] = useState<'production' | 'installation' | 'preparation'>('production');

  const { data: holidays = [], isLoading } = useQuery<Holiday[]>({
    queryKey: ['holidays'],
    queryFn: () => holidayService.getHolidays(),
  });

  const { data: workingHours = [] } = useQuery<WorkingHours[]>({
    queryKey: ['workingHours'],
    queryFn: () => workingHoursService.getWorkingHours(),
  });

  const mutationOptions = {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      toast({ title: 'Success', description: 'Holidays updated successfully.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to update holidays: ${error.message}`,
        variant: 'destructive',
      });
    },
  };

  const addHolidayMutation = useMutation({
    mutationFn: ({ date, team }: { date: Date, team: 'production' | 'installation' }) => holidayService.addHoliday(date, team),
    ...mutationOptions,
  });

  const removeHolidayMutation = useMutation({
    mutationFn: ({ date, team }: { date: Date, team: 'production' | 'installation' }) => holidayService.removeHoliday(date, team),
    ...mutationOptions,
  });

  const upsertWorkingHoursMutation = useMutation({
    mutationFn: (workingHours: Omit<WorkingHours, 'id' | 'created_at' | 'updated_at'>) => 
      workingHoursService.upsertWorkingHours(workingHours),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workingHours'] });
      toast({ title: 'Success', description: 'Working hours updated successfully.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to update working hours: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const handleDayClick = (day: Date | undefined, team: 'production' | 'installation') => {
    if (!day) return;

    const dateString = format(day, 'yyyy-MM-dd');
    const isHoliday = holidays.some(h => h.date === dateString && h.team === team);

    if (isHoliday) {
      removeHolidayMutation.mutate({ date: day, team });
    } else {
      addHolidayMutation.mutate({ date: day, team });
    }
  };

  const getTeamHolidays = (team: 'production' | 'installation') => {
    return holidays
      .filter(h => h.team === team)
      .map(h => new Date(h.date + 'T00:00:00')); // ensure date is parsed as local
  };

  const productionHolidays = getTeamHolidays('production');
  const installationHolidays = getTeamHolidays('installation');

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const handleWorkingHoursChange = (day: number, field: 'start_time' | 'end_time' | 'break_minutes', value: string) => {
    const existingHours = workingHoursService.getWorkingHoursForDay(workingHours, editingTeam, day);
    
    const updatedHours = {
      team: editingTeam,
      day_of_week: day,
      start_time: existingHours?.start_time || '08:00',
      end_time: existingHours?.end_time || '17:00',
      break_minutes: existingHours?.break_minutes || 0,
      is_active: true,
      [field]: field === 'break_minutes' ? parseInt(value) || 0 : value,
    };

    upsertWorkingHoursMutation.mutate(updatedHours);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Holiday Planner & Working Hours</CardTitle>
        <CardDescription>Manage holidays and configure working hours for each team.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="holidays" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="holidays">Holidays</TabsTrigger>
            <TabsTrigger value="working-hours">Working Hours</TabsTrigger>
          </TabsList>
          
          <TabsContent value="holidays" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-medium mb-4 text-center">Production Team Holidays</h3>
                <div className="flex justify-center">
                  <Calendar
                    mode="multiple"
                    selected={productionHolidays}
                    onDayClick={(day) => handleDayClick(day, 'production')}
                    className="rounded-md border"
                  />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-4 text-center">Installation Team Holidays</h3>
                <div className="flex justify-center">
                  <Calendar
                    mode="multiple"
                    selected={installationHolidays}
                    onDayClick={(day) => handleDayClick(day, 'installation')}
                    className="rounded-md border"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="working-hours" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label>Select Team</Label>
                <Tabs value={editingTeam} onValueChange={(v) => setEditingTeam(v as any)} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="production">Production</TabsTrigger>
                    <TabsTrigger value="installation">Installation</TabsTrigger>
                    <TabsTrigger value="preparation">Preparation</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Weekly Schedule for {editingTeam.charAt(0).toUpperCase() + editingTeam.slice(1)} Team</h3>
                <div className="space-y-3">
                  {daysOfWeek.map((dayName, dayIndex) => {
                    const dayHours = workingHoursService.getWorkingHoursForDay(workingHours, editingTeam, dayIndex);
                    return (
                      <div key={dayIndex} className="grid grid-cols-4 gap-4 items-end p-4 border rounded-lg">
                        <div>
                          <Label className="text-sm font-medium">{dayName}</Label>
                        </div>
                        <div>
                          <Label htmlFor={`start-${dayIndex}`} className="text-xs">Start Time</Label>
                          <Input
                            id={`start-${dayIndex}`}
                            type="time"
                            value={dayHours?.start_time || '08:00'}
                            onChange={(e) => handleWorkingHoursChange(dayIndex, 'start_time', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`end-${dayIndex}`} className="text-xs">End Time</Label>
                          <Input
                            id={`end-${dayIndex}`}
                            type="time"
                            value={dayHours?.end_time || '17:00'}
                            onChange={(e) => handleWorkingHoursChange(dayIndex, 'end_time', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`break-${dayIndex}`} className="text-xs">Break (min)</Label>
                          <Input
                            id={`break-${dayIndex}`}
                            type="number"
                            min="0"
                            step="15"
                            value={dayHours?.break_minutes || 0}
                            onChange={(e) => handleWorkingHoursChange(dayIndex, 'break_minutes', e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default HolidayPlanner;
