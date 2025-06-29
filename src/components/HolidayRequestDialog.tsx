
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { holidayRequestService } from '@/services/holidayRequestService';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface HolidayRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HolidayRequestDialog: React.FC<HolidayRequestDialogProps> = ({
  open,
  onOpenChange
}) => {
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { currentEmployee } = useAuth();

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      toast({
        title: 'Error',
        description: 'Please select both start and end dates',
        variant: 'destructive'
      });
      return;
    }

    if (startDate > endDate) {
      toast({
        title: 'Error',
        description: 'Start date cannot be after end date',
        variant: 'destructive'
      });
      return;
    }

    if (!currentEmployee) {
      toast({
        title: 'Error',
        description: 'Employee information not found',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      await holidayRequestService.createRequest({
        employee_name: currentEmployee.name,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        reason: reason.trim() || undefined
      });

      toast({
        title: 'Success',
        description: 'Holiday request submitted successfully'
      });

      // Reset form
      setStartDate(undefined);
      setEndDate(undefined);
      setReason('');
      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting holiday request:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit holiday request',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request Holiday</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="text-base font-medium mb-3 block">Start Date</Label>
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={setStartDate}
              disabled={(date) => date < new Date()}
              className={cn("rounded-md border pointer-events-auto")}
            />
          </div>
          
          <div>
            <Label className="text-base font-medium mb-3 block">End Date</Label>
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={setEndDate}
              disabled={(date) => date < new Date() || (startDate && date < startDate)}
              className={cn("rounded-md border pointer-events-auto")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reason">Reason (Optional)</Label>
          <Textarea
            id="reason"
            placeholder="Please provide a reason for your holiday request..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>

        {startDate && endDate && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Request Summary</h4>
            <p><strong>From:</strong> {format(startDate, 'PPP')}</p>
            <p><strong>To:</strong> {format(endDate, 'PPP')}</p>
            <p><strong>Duration:</strong> {Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1} days</p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!startDate || !endDate || isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HolidayRequestDialog;
