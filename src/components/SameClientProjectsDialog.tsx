import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Users } from 'lucide-react';

interface NearbyProject {
  id: string;
  name: string;
  start_date: string;
  duration: number;
  assignment_id: string;
}

interface SameClientProjectsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  movedProjectName: string;
  clientName: string;
  nearbyProjects: NearbyProject[];
  newDate: string;
  oldDate: string;
  onMoveAllToSameDate: () => void;
  onMoveRelatively: () => void;
  onKeepOriginal: () => void;
}

export const SameClientProjectsDialog: React.FC<SameClientProjectsDialogProps> = ({
  isOpen,
  onClose,
  movedProjectName,
  clientName,
  nearbyProjects,
  newDate,
  oldDate,
  onMoveAllToSameDate,
  onMoveRelatively,
  onKeepOriginal,
}) => {
  const daysDiff = Math.round(
    (new Date(newDate).getTime() - new Date(oldDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  const direction = daysDiff > 0 ? 'later' : 'eerder';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Projecten van dezelfde klant gevonden
          </DialogTitle>
          <DialogDescription>
            Er zijn <strong>{nearbyProjects.length}</strong> andere projecten van klant{' '}
            <strong>{clientName}</strong> binnen 14 dagen van het verplaatste project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            <strong>{movedProjectName}</strong> is verplaatst naar{' '}
            <strong>{format(new Date(newDate), 'd MMM yyyy', { locale: nl })}</strong>{' '}
            ({Math.abs(daysDiff)} {Math.abs(daysDiff) === 1 ? 'dag' : 'dagen'} {direction}).
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Project</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Huidige startdatum</th>
                </tr>
              </thead>
              <tbody>
                {nearbyProjects.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {format(new Date(p.start_date), 'd MMM yyyy', { locale: nl })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-sm font-medium text-foreground">Wat wilt u doen met deze projecten?</div>

          <div className="flex flex-col gap-2">
            <Button onClick={onMoveAllToSameDate} className="justify-start">
              Alles op dezelfde datum plaatsen ({format(new Date(newDate), 'd MMM yyyy', { locale: nl })})
            </Button>
            <Button variant="secondary" onClick={onMoveRelatively} className="justify-start">
              Relatief meeverplaatsen ({Math.abs(daysDiff)} {Math.abs(daysDiff) === 1 ? 'dag' : 'dagen'} {direction})
            </Button>
            <Button variant="outline" onClick={onKeepOriginal} className="justify-start">
              Originele positie behouden
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
