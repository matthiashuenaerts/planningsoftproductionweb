
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar } from '@/components/ui/calendar';
import { holidayService, Holiday } from '@/services/holidayService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const HolidayPlanner: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: holidays = [], isLoading } = useQuery<Holiday[]>({
    queryKey: ['holidays'],
    queryFn: () => holidayService.getHolidays(),
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

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Holiday Planner</CardTitle>
        <CardDescription>Select dates to mark them as holidays for each team. Click a selected date again to remove it.</CardDescription>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-8">
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
      </CardContent>
    </Card>
  );
};

export default HolidayPlanner;
