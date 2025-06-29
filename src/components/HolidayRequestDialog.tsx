
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { holidayRequestService } from '@/services/holidayRequestService';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';

interface HolidayRequestDialogProps {
  children: React.ReactNode;
}

const HolidayRequestDialog: React.FC<HolidayRequestDialogProps> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { currentEmployee } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!startDate || !endDate || !currentEmployee) {
      toast({
        title: "Error",
        description: "Please select both start and end dates",
        variant: "destructive"
      });
      return;
    }

    if (startDate > endDate) {
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
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        reason: reason.trim() || undefined
      });

      toast({
        title: "Success",
        description: "Holiday request submitted successfully"
      });

      // Reset form
      setStartDate(undefined);
      setEndDate(undefined);
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Request Holiday
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label>Start Date</Label>
              <div className="border rounded-md p-3">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  disabled={(date) => date < new Date()}
                  className="w-full"
                />
              </div>
              {startDate && (
                <p className="text-sm text-gray-600">
                  Selected: {format(startDate, 'PPP')}
                </p>
              )}
            </div>
            
            <div className="space-y-3">
              <Label>End Date</Label>
              <div className="border rounded-md p-3">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  disabled={(date) => date < new Date() || (startDate && date < startDate)}
                  className="w-full"
                />
              </div>
              {endDate && (
                <p className="text-sm text-gray-600">
                  Selected: {format(endDate, 'PPP')}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="reason">Reason (Optional)</Label>
            <Textarea
              id="reason"
              placeholder="Enter the reason for your holiday request..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !startDate || !endDate}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HolidayRequestDialog;
