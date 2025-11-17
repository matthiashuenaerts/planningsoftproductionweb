import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, UserCog, UserPlus, Edit, Trash2, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { employeeService } from '@/services/dataService';
import { EmployeeWorkstationsManager } from './EmployeeWorkstationsManager';
import StandardTaskAssignment from '../StandardTaskAssignment';
import { Employee } from '@/services/dataService';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const EmployeeSettings: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showWorkstationMapping, setShowWorkstationMapping] = useState(false);
  const [showTaskAssignment, setShowTaskAssignment] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const [isAddOrEditOpen, setIsAddOrEditOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [employeeData, setEmployeeData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'worker',
    logistics: false
  });
  const { toast } = useToast();

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const data = await employeeService.getAll();
      setEmployees(data);
    } catch (error: any) {
      console.error('Error loading employees:', error);
      toast({
        title: "Error",
        description: `Failed to load employees: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'manager': return 'default';
      case 'teamleader': return 'default';
      case 'worker': return 'secondary';
      case 'workstation': return 'outline';
      default: return 'outline';
    }
  };

  const handleOpenAddOrEditDialog = (employee: Employee | null) => {
    if (employee) {
      setEditingEmployee(employee);
      setEmployeeData({
        name: employee.name,
        email: employee.email || '',
        password: '',
        role: employee.role,
        logistics: employee.logistics || false
      });
    } else {
      setEditingEmployee(null);
      setEmployeeData({
        name: '',
        email: '',
        password: '',
        role: 'worker',
        logistics: false
      });
    }
    setIsAddOrEditOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const dataToSend = { ...employeeData };
      if (editingEmployee && !dataToSend.password) {
        delete (dataToSend as any).password;
      }

      if (editingEmployee) {
        await employeeService.update(editingEmployee.id, dataToSend);
        toast({ title: "Success", description: "Employee updated successfully" });
      } else {
        if (!dataToSend.name || !dataToSend.password) {
          toast({ title: "Validation Error", description: "Name and password are required", variant: "destructive" });
          return;
        }
        await employeeService.create(dataToSend);
        toast({ title: "Success", description: "Employee added successfully" });
      }
      
      setIsAddOrEditOpen(false);
      setEditingEmployee(null);
      loadEmployees();
    } catch (error: any) {
      console.error('Error saving employee:', error);
      toast({
        title: "Error",
        description: `Failed to save employee: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleDeleteClick = (employee: Employee) => {
    setEmployeeToDelete(employee);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!employeeToDelete) return;
    try {
      await employeeService.delete(employeeToDelete.id);
      toast({ title: "Success", description: "Employee deleted successfully" });
      loadEmployees();
    } catch (error: any) {
      console.error('Error deleting employee:', error);
      toast({ title: "Error", description: `Failed to delete employee: ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeleteDialogOpen(false);
      setEmployeeToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Employees</CardTitle>
            <CardDescription>Manage employees, their roles, and workstation assignments</CardDescription>
          </div>
          <Dialog open={isAddOrEditOpen} onOpenChange={setIsAddOrEditOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenAddOrEditDialog(null)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</DialogTitle>
                <DialogDescription>
                  {editingEmployee ? 'Update employee details.' : 'Create a new employee account.'}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input 
                    id="name" 
                    placeholder="Enter name" 
                    value={employeeData.name}
                    onChange={(e) => setEmployeeData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="Enter email" 
                    value={employeeData.email}
                    onChange={(e) => setEmployeeData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder={editingEmployee ? "Leave blank to keep current password" : "Enter password"}
                    value={employeeData.password}
                    onChange={(e) => setEmployeeData(prev => ({ ...prev, password: e.target.value }))}
                    required={!editingEmployee}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select 
                    value={employeeData.role} 
                    onValueChange={(value) => setEmployeeData(prev => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="teamleader">Team Leader</SelectItem>
                      <SelectItem value="worker">Worker</SelectItem>
                      <SelectItem value="workstation">Workstation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="logistics" 
                    checked={employeeData.logistics}
                    onCheckedChange={(checked) => setEmployeeData(prev => ({ ...prev, logistics: checked as boolean }))}
                  />
                  <Label 
                    htmlFor="logistics" 
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Logistics
                  </Label>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 mt-4">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSubmit}>{editingEmployee ? 'Update Employee' : 'Add Employee'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="animate-spin h-6 w-6" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No employees found
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>{employee.name}</TableCell>
                      <TableCell className="hidden md:table-cell">{employee.email || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(employee.role)}>{employee.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline" 
                            size="icon"
                            onClick={() => handleOpenAddOrEditDialog(employee)}
                            title="Edit Employee"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => handleDeleteClick(employee)}
                            title="Delete Employee"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline" 
                            size="icon"
                            onClick={() => {
                              setSelectedEmployee(employee);
                              setShowWorkstationMapping(true);
                            }}
                            title="Manage Workstations"
                          >
                            <UserCog className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              setSelectedEmployee(employee);
                              setShowTaskAssignment(true);
                            }}
                            title="Assign Tasks"
                          >
                            <Calendar className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedEmployee && (
        <>
          <Dialog open={showWorkstationMapping} onOpenChange={setShowWorkstationMapping}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Manage Workstations for {selectedEmployee.name}</DialogTitle>
                <DialogDescription>
                  Select which workstations this employee is assigned to
                </DialogDescription>
              </DialogHeader>
              
              <EmployeeWorkstationsManager 
                employeeId={selectedEmployee.id} 
                employeeName={selectedEmployee.name} 
              />
              
              <div className="flex justify-end">
                <DialogClose asChild>
                  <Button type="button" variant="outline">Close</Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showTaskAssignment} onOpenChange={setShowTaskAssignment}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Assign Standard Tasks to {selectedEmployee.name}</DialogTitle>
                <DialogDescription>
                  Select standard tasks and assign them to this employee
                </DialogDescription>
              </DialogHeader>
              
              <StandardTaskAssignment
                isOpen={showTaskAssignment}
                onClose={() => setShowTaskAssignment(false)}
                selectedDate={selectedDate}
                workers={[selectedEmployee]}
                onSave={() => {
                  setShowTaskAssignment(false);
                  toast({ title: "Success", description: "Tasks assigned successfully" });
                }}
              />
            </DialogContent>
          </Dialog>
        </>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the account for {employeeToDelete?.name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EmployeeSettings;
