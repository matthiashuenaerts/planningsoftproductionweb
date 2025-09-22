import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { dailyTeamAssignmentService, Employee, DailyTeamAssignment } from '@/services/dailyTeamAssignmentService';
import { X, Plus } from 'lucide-react';
import { format } from 'date-fns';

interface ProjectUserAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  teamId: string;
  teamName: string;
  date: Date;
}

export const ProjectUserAssignmentDialog: React.FC<ProjectUserAssignmentDialogProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  teamId,
  teamName,
  date
}) => {
  const [availableEmployees, setAvailableEmployees] = useState<Employee[]>([]);
  const [currentAssignments, setCurrentAssignments] = useState<DailyTeamAssignment[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const dateString = format(date, 'yyyy-MM-dd');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, teamId, dateString]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [employees, assignments] = await Promise.all([
        dailyTeamAssignmentService.getAvailableEmployees(),
        dailyTeamAssignmentService.getAssignmentsForProjectDate(projectId, dateString)
      ]);
      
      setAvailableEmployees(employees);
      setCurrentAssignments(assignments);
    } catch (error: any) {
      console.error('Error loading assignment data:', error);
      toast({
        title: "Error",
        description: `Failed to load data: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignEmployee = async () => {
    if (!selectedEmployeeId) {
      toast({
        title: "Error",
        description: "Please select an employee",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      await dailyTeamAssignmentService.assignEmployeeToTeamForDate(
        selectedEmployeeId,
        teamId,
        dateString,
        true,
        notes
      );

      toast({
        title: "Success",
        description: "Employee assigned successfully"
      });

      // Reload data
      await loadData();
      
      // Reset form
      setSelectedEmployeeId('');
      setNotes('');
    } catch (error: any) {
      console.error('Error assigning employee:', error);
      toast({
        title: "Error",
        description: `Failed to assign employee: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveEmployee = async (employeeId: string) => {
    try {
      setLoading(true);
      await dailyTeamAssignmentService.removeEmployeeFromTeamForDate(
        employeeId,
        teamId,
        dateString
      );

      toast({
        title: "Success",
        description: "Employee removed successfully"
      });

      // Reload data
      await loadData();
    } catch (error: any) {
      console.error('Error removing employee:', error);
      toast({
        title: "Error",
        description: `Failed to remove employee: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getEmployeeName = (employeeId: string) => {
    const employee = availableEmployees.find(emp => emp.id === employeeId);
    return employee?.name || 'Unknown Employee';
  };

  const assignedEmployeeIds = new Set(currentAssignments.map(a => a.employee_id));
  const unassignedEmployees = availableEmployees.filter(emp => !assignedEmployeeIds.has(emp.id));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Team Members</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Project</Label>
            <p className="text-sm text-muted-foreground">{projectName}</p>
          </div>
          
          <div>
            <Label className="text-sm font-medium">Team</Label>
            <p className="text-sm text-muted-foreground">{teamName}</p>
          </div>
          
          <div>
            <Label className="text-sm font-medium">Date</Label>
            <p className="text-sm text-muted-foreground">{format(date, 'EEEE, MMMM d, yyyy')}</p>
          </div>
          
          {/* Current Assignments */}
          <div>
            <Label className="text-sm font-medium">Assigned Team Members</Label>
            <div className="mt-2 space-y-2">
              {currentAssignments.length > 0 ? (
                currentAssignments.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">
                        {getEmployeeName(assignment.employee_id)}
                      </Badge>
                      {assignment.notes && (
                        <span className="text-xs text-muted-foreground">
                          {assignment.notes}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveEmployee(assignment.employee_id)}
                      disabled={loading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No team members assigned</p>
              )}
            </div>
          </div>
          
          {/* Add New Assignment */}
          <div className="border-t pt-4">
            <Label className="text-sm font-medium">Add Team Member</Label>
            <div className="mt-2 space-y-3">
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {unassignedEmployees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name} ({employee.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div>
                <Label htmlFor="notes" className="text-sm">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this assignment..."
                  className="mt-1"
                  rows={2}
                />
              </div>
              
              <Button 
                onClick={handleAssignEmployee}
                disabled={loading || !selectedEmployeeId}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Assign Employee
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};