
import React, { useState, useEffect } from 'react';
import { format, startOfDay, addDays, isSameDay } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Calendar as CalendarIcon, 
  AlertCircle, 
  CheckCircle, 
  ListTodo,
  Loader2,
  Clock,
  Users,
  User,
  Wand2,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Navbar from '@/components/Navbar';
import PlanningTimeline from '@/components/PlanningTimeline';
import PlanningControls from '@/components/PlanningControls';
import PersonalPlanningGenerator from '@/components/PersonalPlanningGenerator';
import PlanningTaskManager from '@/components/PlanningTaskManager';
import { employeeService } from '@/services/dataService';
import { planningService } from '@/services/planningService';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Planning = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationSuccess, setGenerationSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showTaskManager, setShowTaskManager] = useState(false);
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const isAdmin = currentEmployee?.role === 'admin';

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const employeeData = await employeeService.getAll();
        setEmployees(employeeData);
        
        // If admin, preselect the first employee, otherwise select current user
        if (isAdmin && employeeData.length > 0) {
          setSelectedEmployee(employeeData[0].id);
        } else if (currentEmployee) {
          setSelectedEmployee(currentEmployee.id);
        }
      } catch (error) {
        console.error('Error fetching employees:', error);
        toast({
          title: "Error",
          description: "Failed to load employee data",
          variant: "destructive"
        });
      }
    };

    fetchEmployees();
  }, [toast, currentEmployee, isAdmin]);

  const handleGeneratePlan = async () => {
    if (!isAdmin) {
      toast({
        title: "Permission Denied",
        description: "Only administrators can generate plans",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsGeneratingPlan(true);
      setGenerationError(null);
      setGenerationSuccess(null);
      
      // Generate a plan based on open tasks and employee availability
      await planningService.generateDailyPlan(selectedDate);
      
      setGenerationSuccess("Daily plan has been successfully generated for all employees");
      setRefreshTrigger(prev => prev + 1);
      toast({
        title: "Success",
        description: "Daily plan has been generated",
      });
    } catch (error: any) {
      console.error("Generate plan error:", error);
      setGenerationError(error.message || "Failed to generate plan");
      toast({
        title: "Error",
        description: `Failed to generate plan: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handlePlanGenerated = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleTaskManagerSave = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // Clear messages when date changes
  useEffect(() => {
    setGenerationError(null);
    setGenerationSuccess(null);
  }, [selectedDate]);

  const handleEmployeeChange = (employeeId: string) => {
    setSelectedEmployee(employeeId);
    
    // If admin viewing personal tab, update the tab to show the selected employee
    if (isAdmin && activeTab === "me") {
      setActiveTab("selected");
    }
  };

  const getFilteredEmployees = () => {
    if (activeTab === "all") {
      return employees;
    } else if (activeTab === "me") {
      return employees.filter(emp => emp.id === currentEmployee?.id);
    } else if (activeTab === "selected" && selectedEmployee) {
      return employees.filter(emp => emp.id === selectedEmployee);
    }
    return [];
  };

  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      <div className="ml-64 w-full p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between mb-6 gap-4">
            <div>
              <h1 className="text-3xl font-bold">Daily Planning</h1>
              <p className="text-slate-600 mt-1">
                {isAdmin ? "Create and manage employee schedules with intelligent task allocation" : "Your daily schedule"}
              </p>
            </div>
            
            <div className="flex flex-col md:flex-row items-start md:items-center space-y-3 md:space-y-0 md:space-x-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => setSelectedDate(date || new Date())}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              
              <div className="flex space-x-2">
                {isAdmin && (
                  <PlanningControls 
                    selectedDate={selectedDate}
                    onGeneratePlan={handleGeneratePlan}
                    isGenerating={isGeneratingPlan}
                  />
                )}
                
                <Button
                  variant="secondary"
                  onClick={() => setShowTaskManager(true)}
                  disabled={!selectedEmployee}
                  className="whitespace-nowrap"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Task
                </Button>
              </div>
            </div>
          </div>

          {generationError && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{generationError}</AlertDescription>
            </Alert>
          )}
          
          {generationSuccess && (
            <Alert variant="default" className="mb-4 bg-green-50 text-green-800 border-green-200">
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{generationSuccess}</AlertDescription>
            </Alert>
          )}

          {isAdmin && (
            <PersonalPlanningGenerator
              selectedDate={selectedDate}
              employees={employees}
              selectedEmployee={selectedEmployee}
              onEmployeeChange={handleEmployeeChange}
              onPlanGenerated={handlePlanGenerated}
            />
          )}
          
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="w-full max-w-xs">
              <Select
                value={selectedEmployee || ""}
                onValueChange={handleEmployeeChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
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
            
            {isAdmin && (
              <Tabs 
                value={activeTab} 
                onValueChange={setActiveTab}
                className="w-full max-w-md"
              >
                <TabsList className="grid grid-cols-3">
                  <TabsTrigger value="all" className="flex items-center justify-center">
                    <Users className="h-4 w-4 mr-2" />
                    All Employees
                  </TabsTrigger>
                  <TabsTrigger value="selected" className="flex items-center justify-center">
                    <User className="h-4 w-4 mr-2" />
                    Selected
                  </TabsTrigger>
                  <TabsTrigger value="me" className="flex items-center justify-center">
                    <User className="h-4 w-4 mr-2" />
                    My Schedule
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>

          <PlanningTimeline 
            key={refreshTrigger}
            selectedDate={selectedDate}
            employees={isAdmin ? getFilteredEmployees() : employees.filter(emp => emp.id === currentEmployee?.id)}
            isAdmin={isAdmin}
          />
          
          <div className="mt-6">
            <div className="bg-muted rounded-lg p-4">
              <h3 className="text-lg font-medium mb-2 flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Standard Working Hours
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="font-medium">Morning</div>
                  <div className="text-sm text-muted-foreground">7:00 AM - 10:00 AM</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="font-medium">Mid-day</div>
                  <div className="text-sm text-muted-foreground">10:15 AM - 12:30 PM</div>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="font-medium">Afternoon</div>
                  <div className="text-sm text-muted-foreground">1:00 PM - 4:00 PM</div>
                </div>
              </div>
            </div>
          </div>

          <PlanningTaskManager
            isOpen={showTaskManager}
            onClose={() => setShowTaskManager(false)}
            selectedDate={selectedDate}
            selectedEmployee={selectedEmployee || ''}
            onSave={handleTaskManagerSave}
          />
        </div>
      </div>
    </div>
  );
};

export default Planning;
