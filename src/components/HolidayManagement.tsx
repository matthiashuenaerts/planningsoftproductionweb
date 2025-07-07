
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar, Plus, Trash2, User, CalendarDays } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface Holiday {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  approved: boolean;
  employee?: {
    name: string;
  };
}

interface Employee {
  id: string;
  name: string;
}

const HolidayManagement: React.FC = () => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch employees
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch holidays
  const { data: holidays = [], isLoading } = useQuery<Holiday[]>({
    queryKey: ['holidays'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('holiday_requests')
        .select('id, user_id, start_date, end_date, reason, status, employee_name')
        .order('start_date', { ascending: false });
      
      if (error) throw error;
      return data.map(item => ({
        id: item.id,
        employee_id: item.user_id,
        start_date: item.start_date,
        end_date: item.end_date,
        reason: item.reason,
        approved: item.status === 'approved',
        employee: { name: item.employee_name }
      }));
    }
  });

  // Add holiday mutation
  const addHolidayMutation = useMutation({
    mutationFn: async (holidayData: {
      employee_id: string;
      start_date: string;
      end_date: string;
      reason: string;
    }) => {
      const { data, error } = await supabase
        .from('holiday_requests')
        .insert([{
          ...holidayData,
          user_id: holidayData.employee_id,
          employee_name: employees.find(e => e.id === holidayData.employee_id)?.name || '',
          status: 'approved'
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      toast({
        title: 'Success',
        description: 'Holiday added successfully'
      });
      setShowAddDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to add holiday: ${error.message}`,
        variant: 'destructive'
      });
    }
  });

  // Delete holiday mutation
  const deleteHolidayMutation = useMutation({
    mutationFn: async (holidayId: string) => {
      const { error } = await supabase
        .from('holiday_requests')
        .delete()
        .eq('id', holidayId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      toast({
        title: 'Success',
        description: 'Holiday deleted successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to delete holiday: ${error.message}`,
        variant: 'destructive'
      });
    }
  });

  // Toggle approval mutation
  const toggleApprovalMutation = useMutation({
    mutationFn: async ({ holidayId, approved }: { holidayId: string; approved: boolean }) => {
      const { error } = await supabase
        .from('holiday_requests')
        .update({ status: approved ? 'approved' : 'pending' })
        .eq('id', holidayId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      toast({
        title: 'Success',
        description: 'Holiday approval status updated'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Failed to update approval status: ${error.message}`,
        variant: 'destructive'
      });
    }
  });

  const resetForm = () => {
    setSelectedEmployee('');
    setStartDate('');
    setEndDate('');
    setReason('');
  };

  const handleAddHoliday = () => {
    if (!selectedEmployee || !startDate || !endDate) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast({
        title: 'Error',
        description: 'Start date cannot be after end date',
        variant: 'destructive'
      });
      return;
    }

    addHolidayMutation.mutate({
      employee_id: selectedEmployee,
      start_date: startDate,
      end_date: endDate,
      reason: reason || ''
    });
  };

  const handleDeleteHoliday = (holidayId: string) => {
    if (window.confirm('Are you sure you want to delete this holiday?')) {
      deleteHolidayMutation.mutate(holidayId);
    }
  };

  const handleToggleApproval = (holidayId: string, currentApproval: boolean) => {
    toggleApprovalMutation.mutate({
      holidayId,
      approved: !currentApproval
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Holiday Management</h2>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Holiday
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Employee Holidays
          </CardTitle>
        </CardHeader>
        <CardContent>
          {holidays.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No holidays scheduled</p>
          ) : (
            <div className="space-y-4">
              {holidays.map((holiday) => (
                <div
                  key={holiday.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-4 w-4" />
                      <span className="font-medium">{holiday.employee?.name}</span>
                      <Badge variant={holiday.approved ? 'default' : 'secondary'}>
                        {holiday.approved ? 'Approved' : 'Pending'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {format(new Date(holiday.start_date), 'MMM dd, yyyy')} - {format(new Date(holiday.end_date), 'MMM dd, yyyy')}
                      </span>
                    </div>
                    {holiday.reason && (
                      <p className="text-sm text-gray-600 mt-1">
                        Reason: {holiday.reason}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={holiday.approved ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => handleToggleApproval(holiday.id, holiday.approved)}
                    >
                      {holiday.approved ? 'Unapprove' : 'Approve'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteHoliday(holiday.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Holiday Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Employee Holiday</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="employee">Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for holiday..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddHoliday}
              disabled={addHolidayMutation.isPending}
            >
              {addHolidayMutation.isPending ? 'Adding...' : 'Add Holiday'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HolidayManagement;
