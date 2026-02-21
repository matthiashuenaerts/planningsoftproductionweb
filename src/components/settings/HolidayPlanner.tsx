
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
import { Plus, Trash2 } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';

const HolidayPlanner: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingTeam, setEditingTeam] = useState<'production' | 'installation' | 'preparation'>('production');
  const { tenant } = useTenant();

  const { data: holidays = [], isLoading } = useQuery<Holiday[]>({
    queryKey: ['holidays', tenant?.id],
    queryFn: () => holidayService.getHolidays(tenant?.id),
  });

  const { data: workingHours = [] } = useQuery<WorkingHours[]>({
    queryKey: ['workingHours', tenant?.id],
    queryFn: () => workingHoursService.getWorkingHours(tenant?.id),
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

  const addBreakMutation = useMutation({
    mutationFn: ({ workingHoursId, startTime, endTime }: { workingHoursId: string, startTime: string, endTime: string }) =>
      workingHoursService.addBreak(workingHoursId, startTime, endTime),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workingHours'] });
      toast({ title: 'Success', description: 'Break added successfully.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to add break: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const deleteBreakMutation = useMutation({
    mutationFn: (breakId: string) => workingHoursService.deleteBreak(breakId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workingHours'] });
      toast({ title: 'Success', description: 'Break deleted successfully.' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to delete break: ${error.message}`,
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

  // Ensure working hours exist for a day before adding a break
  const ensureWorkingHoursAndAddBreak = async (day: number) => {
    let dayHours = workingHoursService.getWorkingHoursForDay(workingHours, editingTeam, day);
    
    if (!dayHours) {
      // Create working hours for this day first
      try {
        const created = await workingHoursService.upsertWorkingHours({
          team: editingTeam,
          day_of_week: day,
          start_time: '08:00',
          end_time: '17:00',
          break_minutes: 0,
          is_active: true,
        });
        // Now add the break
        addBreakMutation.mutate({
          workingHoursId: created.id,
          startTime: '12:00',
          endTime: '12:30',
        });
      } catch (error: any) {
        toast({
          title: 'Error',
          description: `Failed to create working hours: ${error.message}`,
          variant: 'destructive',
        });
      }
    } else {
      addBreakMutation.mutate({
        workingHoursId: dayHours.id,
        startTime: '12:00',
        endTime: '12:30',
      });
    }
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
                <div className="space-y-4">
                  {daysOfWeek.map((dayName, dayIndex) => {
                    const dayHours = workingHoursService.getWorkingHoursForDay(workingHours, editingTeam, dayIndex);
                    return (
                      <div key={dayIndex} className="p-4 border rounded-lg space-y-3">
                        <div className="grid grid-cols-4 gap-4 items-end">
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
                        </div>
                        
                        {/* Breaks Section */}
                        <div className="space-y-2 pl-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Breaks</Label>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => ensureWorkingHoursAndAddBreak(dayIndex)}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Break
                            </Button>
                          </div>
                          
                          {dayHours?.breaks && dayHours.breaks.length > 0 ? (
                            <div className="space-y-2">
                              {dayHours.breaks.map((breakItem) => (
                                <div key={breakItem.id} className="flex gap-2 items-end">
                                  <div className="flex-1">
                                    <Label htmlFor={`break-start-${breakItem.id}`} className="text-xs">From</Label>
                                    <Input
                                      id={`break-start-${breakItem.id}`}
                                      type="time"
                                      value={breakItem.start_time}
                                      onChange={(e) => {
                                        workingHoursService.updateBreak(breakItem.id, e.target.value, breakItem.end_time)
                                          .then(() => queryClient.invalidateQueries({ queryKey: ['workingHours'] }));
                                      }}
                                      className="mt-1"
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <Label htmlFor={`break-end-${breakItem.id}`} className="text-xs">To</Label>
                                    <Input
                                      id={`break-end-${breakItem.id}`}
                                      type="time"
                                      value={breakItem.end_time}
                                      onChange={(e) => {
                                        workingHoursService.updateBreak(breakItem.id, breakItem.start_time, e.target.value)
                                          .then(() => queryClient.invalidateQueries({ queryKey: ['workingHours'] }));
                                      }}
                                      className="mt-1"
                                    />
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => deleteBreakMutation.mutate(breakItem.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">No breaks configured</p>
                          )}
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
