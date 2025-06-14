
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, UserCog, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { employeeService } from '@/services/dataService';
import { EmployeeWorkstationsManager } from './EmployeeWorkstationsManager';
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
  const [showAddEmployeeDialog, setShowAddEmployeeDialog] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    password: '',
    role: 'worker'
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

  const handleAddEmployee = async () => {
    try {
      if (!newEmployee.name || !newEmployee.password) {
        toast({
          title: "Validation Error",
          description: "Name and password are required",
          variant: "destructive"
        });
        return;
      }

      await employeeService.create(newEmployee);
      
      toast({
        title: "Success",
        description: "Employee added successfully"
      });
      
      setNewEmployee({
        name: '',
        email: '',
        password: '',
        role: 'worker'
      });
      
      setShowAddEmployeeDialog(false);
      loadEmployees();
    } catch (error: any) {
      console.error('Error adding employee:', error);
      toast({
        title: "Error",
        description: `Failed to add employee: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Employees</CardTitle>
            <CardDescription>Manage employee workstation assignments</CardDescription>
          </div>
          <Dialog open={showAddEmployeeDialog} onOpenChange={setShowAddEmployeeDialog}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Employee</DialogTitle>
                <DialogDescription>
                  Create a new employee account
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input 
                    id="name" 
                    placeholder="Enter name" 
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="Enter email" 
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="Enter password" 
                    value={newEmployee.password}
                    onChange={(e) => setNewEmployee(prev => ({ ...prev, password: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select 
                    value={newEmployee.role} 
                    onValueChange={(value) => setNewEmployee(prev => ({ ...prev, role: value }))}
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
              </div>
              
              <div className="flex justify-end space-x-2 mt-4">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleAddEmployee}>Add Employee</Button>
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
                        <Button
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedEmployee(employee);
                            setShowWorkstationMapping(true);
                          }}
                        >
                          <UserCog className="mr-2 h-4 w-4" />
                          Workstations
                        </Button>
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
      )}
    </div>
  );
};

export default EmployeeSettings;
