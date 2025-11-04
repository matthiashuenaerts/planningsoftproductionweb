import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { CalendarIcon, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OverlappingProject {
  id: string;
  name: string;
  client: string;
  startDate: Date;
  endDate: Date;
  startHour: number;
  endHour: number;
  teamId?: string;
  teamName?: string;
}

interface ProjectOverlapResolutionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  overlappingProjects: OverlappingProject[];
  onResolve: (resolvedProjects: OverlappingProject[]) => void;
}

const hours = Array.from({ length: 24 }, (_, i) => i);

export const ProjectOverlapResolutionDialog: React.FC<ProjectOverlapResolutionDialogProps> = ({
  isOpen,
  onClose,
  overlappingProjects,
  onResolve
}) => {
  const [projects, setProjects] = useState<OverlappingProject[]>(overlappingProjects);

  // Update projects when overlappingProjects changes
  React.useEffect(() => {
    setProjects(overlappingProjects);
  }, [overlappingProjects]);

  const updateProject = (index: number, updates: Partial<OverlappingProject>) => {
    const updated = [...projects];
    updated[index] = { ...updated[index], ...updates };
    setProjects(updated);
  };

  // Check if there are still overlaps and identify them
  const getOverlappingPairs = () => {
    const overlaps: Array<{ project1: OverlappingProject; project2: OverlappingProject }> = [];
    
    for (let i = 0; i < projects.length; i++) {
      for (let j = i + 1; j < projects.length; j++) {
        const p1 = projects[i];
        const p2 = projects[j];
        
        // Only check if same team
        if (p1.teamId !== p2.teamId) continue;
        
        const p1Start = new Date(p1.startDate);
        p1Start.setHours(p1.startHour, 0, 0, 0);
        const p1End = new Date(p1.endDate);
        p1End.setHours(p1.endHour, 0, 0, 0);
        
        const p2Start = new Date(p2.startDate);
        p2Start.setHours(p2.startHour, 0, 0, 0);
        const p2End = new Date(p2.endDate);
        p2End.setHours(p2.endHour, 0, 0, 0);
        
        if (p1Start <= p2End && p2Start <= p1End) {
          overlaps.push({ project1: p1, project2: p2 });
        }
      }
    }
    return overlaps;
  };

  const overlappingPairs = getOverlappingPairs();
  const hasOverlaps = overlappingPairs.length > 0;

  // Group projects by team
  const projectsByTeam = projects.reduce((acc, project) => {
    const teamId = project.teamId || 'unknown';
    if (!acc[teamId]) {
      acc[teamId] = {
        teamName: project.teamName || 'Unknown Team',
        projects: []
      };
    }
    acc[teamId].projects.push(project);
    return acc;
  }, {} as Record<string, { teamName: string; projects: OverlappingProject[] }>);

  // Get projects that overlap with a specific project
  const getOverlapsForProject = (projectId: string) => {
    return overlappingPairs
      .filter(pair => pair.project1.id === projectId || pair.project2.id === projectId)
      .map(pair => pair.project1.id === projectId ? pair.project2.name : pair.project1.name);
  };

  const handleSave = async () => {
    try {
      // Save each project's override to the database
      for (const project of projects) {
        const { error } = await supabase
          .from('project_team_assignment_overrides')
          .upsert({
            project_id: project.id,
            team_id: project.teamId,
            start_date: format(project.startDate, 'yyyy-MM-dd'),
            end_date: format(project.endDate, 'yyyy-MM-dd'),
            start_hour: project.startHour,
            end_hour: project.endHour,
          });

        if (error) throw error;
      }

      toast.success('Project schedules saved successfully');
      onResolve(projects);
      onClose();
    } catch (error) {
      console.error('Error saving project overrides:', error);
      toast.error('Failed to save project schedules');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Resolve Project Overlaps
          </DialogTitle>
          <DialogDescription>
            The following projects have overlapping schedules. Please adjust their start and end times to prevent conflicts.
          </DialogDescription>
        </DialogHeader>

        <Alert variant={hasOverlaps ? "destructive" : "default"} className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {hasOverlaps 
              ? `⚠️ ${projects.length} projects still have overlapping schedules. Adjust dates and times to resolve all conflicts.`
              : `✓ No overlaps detected! You can now save the changes.`
            }
          </AlertDescription>
        </Alert>

        <div className="space-y-8">
          {Object.entries(projectsByTeam).map(([teamId, teamData]) => (
            <div key={teamId} className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <h3 className="font-semibold text-lg">{teamData.teamName}</h3>
                <span className="text-sm text-muted-foreground">
                  ({teamData.projects.length} project{teamData.projects.length > 1 ? 's' : ''})
                </span>
              </div>
              
              {teamData.projects.map((project, index) => {
                const projectIndex = projects.findIndex(p => p.id === project.id);
                const overlapsWithProjects = getOverlapsForProject(project.id);
                
                return (
                  <div 
                    key={project.id} 
                    className={cn(
                      "border rounded-lg p-4 space-y-4",
                      overlapsWithProjects.length > 0 && "border-destructive bg-destructive/5"
                    )}
                  >
                    <div>
                      <h4 className="font-semibold">{project.name}</h4>
                      <p className="text-sm text-muted-foreground">{project.client}</p>
                      {overlapsWithProjects.length > 0 && (
                        <Alert variant="destructive" className="mt-2">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            Overlaps with: {overlapsWithProjects.join(', ')}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Start Date & Time */}
                      <div className="space-y-2">
                        <Label>Start Date & Time</Label>
                        <div className="flex gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "flex-1 justify-start text-left font-normal",
                                  !project.startDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {project.startDate ? format(project.startDate, "PPP") : <span>Pick a date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={project.startDate}
                                onSelect={(date) => date && updateProject(projectIndex, { startDate: date })}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>

                          <Select
                            value={project.startHour.toString()}
                            onValueChange={(value) => updateProject(projectIndex, { startHour: parseInt(value) })}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {hours.map((hour) => (
                                <SelectItem key={hour} value={hour.toString()}>
                                  {hour.toString().padStart(2, '0')}:00
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* End Date & Time */}
                      <div className="space-y-2">
                        <Label>End Date & Time</Label>
                        <div className="flex gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "flex-1 justify-start text-left font-normal",
                                  !project.endDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {project.endDate ? format(project.endDate, "PPP") : <span>Pick a date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={project.endDate}
                                onSelect={(date) => date && updateProject(projectIndex, { endDate: date })}
                                initialFocus
                                className="pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>

                          <Select
                            value={project.endHour.toString()}
                            onValueChange={(value) => updateProject(projectIndex, { endHour: parseInt(value) })}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {hours.map((hour) => (
                                <SelectItem key={hour} value={hour.toString()}>
                                  {hour.toString().padStart(2, '0')}:00
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
