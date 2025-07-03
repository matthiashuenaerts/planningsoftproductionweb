import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Holiday {
  id: string;
  date: string;
  team: string;
  created_at: string;
}

interface Employee {
  id: string;
  name: string;
  role: string;
}

const HolidayManagement: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const queryClient = useQueryClient();

  // Fetch existing holidays from the holidays table (team holidays)
  const { data: holidays, isLoading: loadingHolidays } = useQuery({
    queryKey: ['holidays'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data as Holiday[];
    }
  });

  // Fetch employees for team selection
  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, role')
        .order('name');
      
      if (error) throw error;
      return data as Employee[];
    }
  });

  // Get unique teams/roles
  const teams = employees ? [...new Set(employees.map(emp => emp.role))] : [];

  // Add holiday mutation
  const addHolidayMutation = useMutation({
    mutationFn: async ({ date, team }: { date: string; team: string }) => {
      const { data, error } = await supabase
        .from('holidays')
        .insert([{ date, team }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      toast.success('Holiday added successfully');
      setSelectedDate(undefined);
      setSelectedTeam('');
    },
    onError: (error) => {
      console.error('Error adding holiday:', error);
      toast.error('Failed to add holiday');
    }
  });

  // Delete holiday mutation
  const deleteHolidayMutation = useMutation({
    mutationFn: async (holidayId: string) => {
      const { error } = await supabase
        .from('holidays')
        .delete()
        .eq('id', holidayId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      toast.success('Holiday deleted successfully');
    },
    onError: (error) => {
      console.error('Error deleting holiday:', error);
      toast.error('Failed to delete holiday');
    }
  });

  const handleAddHoliday = () => {
    if (!selectedDate || !selectedTeam) {
      toast.error('Please select both date and team');
      return;
    }

    const dateString = format(selectedDate, 'yyyy-MM-dd');
    addHolidayMutation.mutate({ date: dateString, team: selectedTeam });
  };

  const handleDeleteHoliday = (holidayId: string) => {
    deleteHolidayMutation.mutate(holidayId);
  };

  return (
    <div className="space-y-6">
      {/* Add Holiday Form */}
      <Card>
        <CardHeader>
          <CardTitle>Add Team Holiday</CardTitle>
          <CardDescription>
            Add a holiday for a specific team. This will prevent scheduling for that team on the selected date.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'PPP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team} value={team}>
                      {team}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={handleAddHoliday}
            disabled={addHolidayMutation.isPending || !selectedDate || !selectedTeam}
            className="w-full"
          >
            {addHolidayMutation.isPending ? 'Adding...' : 'Add Holiday'}
          </Button>
        </CardContent>
      </Card>

      {/* Existing Holidays List */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Team Holidays</CardTitle>
          <CardDescription>
            Manage existing team holidays. Individual employee holidays are managed through holiday requests.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingHolidays ? (
            <p>Loading holidays...</p>
          ) : holidays && holidays.length > 0 ? (
            <div className="space-y-2">
              {holidays.map((holiday) => (
                <div key={holiday.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <span className="font-medium">{format(new Date(holiday.date), 'PPP')}</span>
                    <span className="ml-3 text-sm text-gray-600">Team: {holiday.team}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteHoliday(holiday.id)}
                    disabled={deleteHolidayMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No team holidays configured.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HolidayManagement;
