import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Calendar, Clock, RefreshCw, X } from 'lucide-react';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ProjectDeadlineWarning {
  projectId: string;
  projectName: string;
  clientName: string;
  installationDate: Date;
  estimatedCompletionDate: Date;
  daysOverdue: number;
  canReschedule: boolean;
}

interface ProjectDeadlineWarningDialogProps {
  isOpen: boolean;
  onClose: () => void;
  warnings: ProjectDeadlineWarning[];
  onReschedule: () => void;
  onRescheduleProject: (projectId: string) => void;
  isRescheduling: boolean;
  reschedulingProjectId: string | null;
  capacityIssue: boolean;
}

export const ProjectDeadlineWarningDialog: React.FC<ProjectDeadlineWarningDialogProps> = ({
  isOpen,
  onClose,
  warnings,
  onReschedule,
  onRescheduleProject,
  isRescheduling,
  reschedulingProjectId,
  capacityIssue,
}) => {
  const canRescheduleAny = warnings.some(w => w.canReschedule);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-6 h-6" />
            Projecten kunnen niet op tijd worden afgerond
          </DialogTitle>
          <DialogDescription>
            De volgende projecten kunnen niet worden voltooid vóór hun installatiedatum op basis van de huidige planning:
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-3">
            {warnings.map((warning) => (
              <div
                key={warning.projectId}
                className="p-4 border rounded-lg bg-destructive/5 border-destructive/20"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-foreground">{warning.projectName}</h4>
                    <p className="text-sm text-muted-foreground">{warning.clientName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 text-xs font-medium bg-destructive/10 text-destructive rounded">
                      {warning.daysOverdue} dagen te laat
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRescheduleProject(warning.projectId)}
                      disabled={isRescheduling}
                      className="h-7 text-xs"
                    >
                      {reschedulingProjectId === warning.projectId ? (
                        <>
                          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                          Bezig...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Inplannen
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>
                      <span className="text-muted-foreground">Installatie: </span>
                      <span className="font-medium">{format(warning.installationDate, 'dd MMM yyyy')}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>
                      <span className="text-muted-foreground">Geschatte voltooiing: </span>
                      <span className="font-medium text-destructive">{format(warning.estimatedCompletionDate, 'dd MMM yyyy')}</span>
                    </span>
                  </div>
                </div>
                {!warning.canReschedule && (
                  <p className="mt-2 text-xs text-destructive">
                    ⚠️ Dit project kan niet worden versneld - geen extra capaciteit beschikbaar
                  </p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {capacityIssue && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="font-medium text-amber-800 dark:text-amber-200">
                  Onvoldoende capaciteit
                </h5>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Het is niet mogelijk om alle projecten op tijd af te ronden vanwege onvoldoende werknemers of te veel projecten. 
                  Overweeg om meer werknemers toe te voegen of projecten te verplaatsen.
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isRescheduling}>
            <X className="w-4 h-4 mr-2" />
            Sluiten
          </Button>
          {canRescheduleAny && !capacityIssue && (
            <Button 
              onClick={onReschedule} 
              disabled={isRescheduling}
              className="bg-primary"
            >
              {isRescheduling ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Herplannen...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Herplannen voor deadlines
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
