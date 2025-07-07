
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Wand2, AlertCircle, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { planningService } from '@/services/planningService';
import { format } from 'date-fns';

interface PersonalPlanningGeneratorProps {
  selectedDate: Date;
  employees: any[];
  onScheduleGenerated: () => void;
}

const PersonalPlanningGenerator: React.FC<PersonalPlanningGeneratorProps> = ({
  selectedDate,
  employees,
  onScheduleGenerated
}) => {
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isOnHoliday, setIsOnHoliday] = useState(false);
  const { toast } = useToast();

  const checkHolidayStatus = async (employeeId: string) => {
    try {
      const holidayStatus = await planningService.isEmployeeOnHoliday(employeeId, selectedDate);
      setIsOnHoliday(holidayStatus);
      return holidayStatus;
    } catch (error) {
      console.error('Error checking holiday status:', error);
      return false;
    }
  };

  const generatePersonalPlan = async () => {
    if (!selectedEmployee) {
      toast({
        title: 'Employee Required',
        description: 'Please select an employee to create a plan',
        variant: 'destructive'
      });
      return;
    }

    // Check if employee is on holiday
    const holidayStatus = await checkHolidayStatus(selectedEmployee);
    if (holidayStatus) {
      toast({
        title: 'Employee on Holiday',
        description: 'Cannot generate plan for employee who is on holiday',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsGenerating(true);
      
      // Generate the plan
      await planningService.generatePlanFromPersonalTasks(selectedEmployee, selectedDate);
      
      const employee = employees.find(emp => emp.id === selectedEmployee);
      const employeeName = employee ? employee.name : 'selected employee';
      
      toast({
        title: 'Success',
        description: `Personal plan generated for ${employeeName}`,
      });

      onScheduleGenerated();
    } catch (error: any) {
      console.error('Generate personal plan error:', error);
      toast({
        title: 'Error',
        description: `Failed to generate plan: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generatePreview = async () => {
    if (!selectedEmployee) return;

    // Check holiday status first
    const holidayStatus = await checkHolidayStatus(selectedEmployee);
    if (holidayStatus) {
      setPreview([]);
      setShowPreview(true);
      return;
    }

    try {
      // Get employee's urgent tasks for preview
      const tasks = await planningService.getAvailableTasksForPlanning();
      const employeeTasks = tasks.filter(task => 
        !task.assignee_id || task.assignee_id === selectedEmployee
      ).slice(0, 5); // Preview first 5 tasks

      setPreview(employeeTasks);
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating preview:', error);
    }
  };

  const handleEmployeeChange = async (employeeId: string) => {
    setSelectedEmployee(employeeId);
    // Check holiday status when employee changes
    await checkHolidayStatus(employeeId);
    setShowPreview(false);
    setPreview([]);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const selectedEmployeeData = employees.find(emp => emp.id === selectedEmployee);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Wand2 className="h-5 w-5 mr-2" />
          Personal Planning Generator
        </CardTitle>
        <CardDescription>
          Generate a personal daily plan for an employee based on their urgent tasks and workstation assignments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex-1">
            <Select
              value={selectedEmployee || ""}
              onValueChange={handleEmployeeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select employee for personal planning" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    <div className="flex items-center">
                      <User className="h-4 w-4 mr-2" />
                      {employee.name}
                      {employee.workstation && (
                        <Badge variant="outline" className="ml-2">
                          {employee.workstation}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={generatePreview}
              disabled={!selectedEmployee || isOnHoliday}
            >
              Preview Tasks
            </Button>
            <Button
              onClick={generatePersonalPlan}
              disabled={isGenerating || !selectedEmployee || isOnHoliday}
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Generate Plan
                </>
              )}
            </Button>
          </div>
        </div>

        {selectedEmployeeData && (
          <div className={`p-3 rounded-lg border ${isOnHoliday ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
            <div className={`flex items-center text-sm ${isOnHoliday ? 'text-orange-800' : 'text-blue-800'}`}>
              <User className="h-4 w-4 mr-2" />
              <span className="font-medium">{selectedEmployeeData.name}</span>
              {selectedEmployeeData.workstation && (
                <>
                  <span className="mx-2">•</span>
                  <span>Workstation: {selectedEmployeeData.workstation}</span>
                </>
              )}
              <span className="mx-2">•</span>
              <span>Date: {format(selectedDate, 'MMM dd, yyyy')}</span>
              {isOnHoliday && (
                <>
                  <span className="mx-2">•</span>
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    <span className="font-medium">On Holiday</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {isOnHoliday && (
          <div className="flex items-center justify-center p-4 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded">
            <AlertCircle className="h-4 w-4 mr-2" />
            This employee is on holiday and cannot be scheduled for work
          </div>
        )}

        {showPreview && !isOnHoliday && preview.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">Preview - Most Urgent Tasks:</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {preview.map((task, index) => (
                <div key={task.id} className="flex items-center justify-between p-2 border rounded text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-muted-foreground">#{index + 1}</span>
                    <span className="font-medium">{task.title}</span>
                    {task.duration && (
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 mr-1" />
                        {task.duration}m
                      </div>
                    )}
                  </div>
                  <Badge className={getPriorityColor(task.priority)}>
                    {task.priority}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {showPreview && !isOnHoliday && preview.length === 0 && (
          <div className="flex items-center justify-center p-4 text-sm text-muted-foreground border border-dashed rounded">
            <AlertCircle className="h-4 w-4 mr-2" />
            No tasks available for this employee
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PersonalPlanningGenerator;
