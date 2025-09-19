
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { holidayRequestService } from '@/services/holidayRequestService';
import { CalendarDays, Clock, User, FileText } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DateRange } from 'react-day-picker';

interface HolidayRequestDialogProps {
  children: React.ReactNode;
}

const HolidayRequestDialog: React.FC<HolidayRequestDialogProps> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { currentEmployee } = useAuth();
  const { toast } = useToast();

  const calculateDaysRequested = () => {
    if (!dateRange?.from || !dateRange?.to) return 0;
    return differenceInDays(dateRange.to, dateRange.from) + 1;
  };

  const handleSubmit = async () => {
    if (!dateRange?.from || !dateRange?.to || !currentEmployee) {
      toast({
        title: "Error",
        description: "Please select both start and end dates",
        variant: "destructive"
      });
      return;
    }

    if (dateRange.from > dateRange.to) {
      toast({
        title: "Error",
        description: "Start date cannot be after end date",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await holidayRequestService.createRequest({
        user_id: currentEmployee.id,
        employee_name: currentEmployee.name,
        start_date: dateRange.from.toLocaleDateString('en-CA'),
        end_date: dateRange.to.toLocaleDateString('en-CA'),
        reason: reason.trim() || undefined
      });

      toast({
        title: "Success",
        description: "Holiday request submitted successfully"
      });

      // Reset form
      setDateRange(undefined);
      setReason('');
      setOpen(false);
    } catch (error) {
      console.error('Error submitting holiday request:', error);
      toast({
        title: "Error",
        description: "Failed to submit holiday request",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CalendarDays className="h-6 w-6 text-blue-600" />
            Request Holiday Leave
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Employee Info Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                Employee Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{currentEmployee?.name}</p>
                  <p className="text-sm text-gray-600">{currentEmployee?.role}</p>
                </div>
                <Badge variant="secondary">Active Employee</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Date Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="h-5 w-5" />
                Select Dates
              </CardTitle>
              <CardDescription>
                Choose your holiday start and end dates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center space-y-4">
                <div className="border rounded-lg p-3 bg-gray-50">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    disabled={(date) => date < new Date()}
                    className="w-full"
                    numberOfMonths={1}
                  />
                </div>
                
                {dateRange?.from && (
                  <div className="w-full space-y-2">
                    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded">
                      <CalendarDays className="h-4 w-4" />
                      Start: {format(dateRange.from, 'EEEE, MMMM do, yyyy')}
                    </div>
                    {dateRange?.to && (
                      <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 p-2 rounded">
                        <CalendarDays className="h-4 w-4" />
                        End: {format(dateRange.to, 'EEEE, MMMM do, yyyy')}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Duration Summary */}
              {dateRange?.from && dateRange?.to && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-900">Duration Summary</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Total Days:</span>
                      <span className="ml-2 font-semibold text-blue-700">{calculateDaysRequested()} days</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <Badge variant="outline" className="ml-2">Pending Approval</Badge>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reason Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                Reason for Leave
              </CardTitle>
              <CardDescription>
                Optional: Provide additional details about your holiday request
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Enter the reason for your holiday request (vacation, personal, family time, etc.)..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-sm text-gray-500 mt-2">
                {reason.length}/500 characters
              </p>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
              className="min-w-24"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !dateRange?.from || !dateRange?.to}
              className="min-w-32"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </div>
              ) : (
                'Submit Request'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HolidayRequestDialog;
