
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { holidayRequestService } from '@/services/holidayRequestService';
import { CalendarDays, Clock, User, FileText } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { DateRange } from 'react-day-picker';
import { useLanguage } from '@/context/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const { t } = useLanguage();
  const isMobile = useIsMobile();

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
      <DialogContent className={isMobile
        ? 'max-w-[calc(100vw-1.5rem)] w-[calc(100vw-1.5rem)] p-4 max-h-[90vh] overflow-y-auto'
        : 'max-w-2xl max-h-[90vh] overflow-y-auto'
      }>
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isMobile ? 'text-base' : 'text-xl'}`}>
            <CalendarDays className={`${isMobile ? 'h-4 w-4' : 'h-6 w-6'} text-primary`} />
            Request Holiday Leave
          </DialogTitle>
        </DialogHeader>
        
        <div className={`space-y-${isMobile ? '4' : '6'}`}>
          {/* Employee Info */}
          <div className={`border border-border rounded-xl ${isMobile ? 'p-3' : 'p-4'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`${isMobile ? 'h-8 w-8' : 'h-9 w-9'} rounded-lg bg-primary/10 flex items-center justify-center`}>
                  <User className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} text-primary`} />
                </div>
                <div>
                  <p className={`font-medium ${isMobile ? 'text-sm' : ''} text-foreground`}>{currentEmployee?.name}</p>
                  <p className="text-xs text-muted-foreground">{currentEmployee?.role}</p>
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">Active</Badge>
            </div>
          </div>

          {/* Date Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarDays className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} text-muted-foreground`} />
              <span className={`font-medium ${isMobile ? 'text-sm' : ''} text-foreground`}>Select Dates</span>
            </div>
            <div className={`border border-border rounded-xl ${isMobile ? 'p-2' : 'p-3'} bg-muted/30 flex justify-center`}>
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
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 bg-green-500/10 p-2 rounded-lg">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Start: {format(dateRange.from, isMobile ? 'MMM do, yyyy' : 'EEEE, MMMM do, yyyy')}
                </div>
                {dateRange?.to && (
                  <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 p-2 rounded-lg">
                    <CalendarDays className="h-3.5 w-3.5" />
                    End: {format(dateRange.to, isMobile ? 'MMM do, yyyy' : 'EEEE, MMMM do, yyyy')}
                  </div>
                )}
              </div>
            )}

            {dateRange?.from && dateRange?.to && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Clock className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} text-primary`} />
                  <span className={`font-medium ${isMobile ? 'text-xs' : 'text-sm'} text-foreground`}>Duration Summary</span>
                </div>
                <div className={`flex ${isMobile ? 'flex-col gap-1' : 'gap-4'} text-xs`}>
                  <span className="text-muted-foreground">Total: <strong className="text-foreground">{calculateDaysRequested()} days</strong></span>
                  <Badge variant="outline" className="text-xs w-fit">Pending Approval</Badge>
                </div>
              </div>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} text-muted-foreground`} />
              <span className={`font-medium ${isMobile ? 'text-sm' : ''} text-foreground`}>Reason (optional)</span>
            </div>
            <Textarea
              placeholder="Enter the reason for your holiday request..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={isMobile ? 3 : 4}
              className={`resize-none ${isMobile ? 'text-sm' : ''}`}
            />
            <p className="text-xs text-muted-foreground">{reason.length}/500</p>
          </div>

          {/* Action Buttons */}
          <div className={`flex ${isMobile ? 'flex-col' : 'justify-end'} gap-2 pt-3 border-t border-border`}>
            {isMobile ? (
              <>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !dateRange?.from || !dateRange?.to}
                  className="h-10"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </div>
                  ) : (
                    'Submit Request'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isSubmitting}
                  className="h-10"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
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
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </div>
                  ) : (
                    'Submit Request'
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HolidayRequestDialog;
