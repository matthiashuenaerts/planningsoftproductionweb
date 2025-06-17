import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { employeeService, Employee } from '@/services/dataService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Edit, Trash2 } from 'lucide-react';

const UserManagement = () => {
  const { currentEmployee } = useAuth();
  const [isAddOrEditOpen, setIsAddOrEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Employee | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<Employee | null>(null);

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'worker',
    workstation: '',
  });
  const { toast } = useToast();
  
  const { data: employees, refetch } = useQuery({
    queryKey: ['employees'],
    queryFn: employeeService.getAll,
  });

  const handleOpenDialog = (employee: Employee | null) => {
    if (employee) {
      setEditingUser(employee);
      setNewUser({
        name: employee.name,
        email: employee.email || '',
        password: '', // Password field is cleared for editing for security
        role: employee.role,
        workstation: employee.workstation || '',
      });
    } else {
      setEditingUser(null);
      setNewUser({
        name: '',
        email: '',
        password: '',
        role: 'worker',
        workstation: '',
      });
    }
    setIsAddOrEditOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userData = { ...newUser };
      if (editingUser && !userData.password) {
        delete (userData as any).password;
      }

      if (editingUser) {
        await employeeService.update(editingUser.id, userData);
        toast({
          title: "Success",
          description: "User has been updated successfully",
        });
      } else {
        await employeeService.create(newUser);
        toast({
          title: "Success",
          description: "New user has been added successfully",
        });
      }
      setIsAddOrEditOpen(false);
      refetch();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (employee: Employee) => {
    setUserToDelete(employee);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    try {
      await employeeService.delete(userToDelete.id);
      toast({
        title: "Success",
        description: "User deleted successfully.",
      });
      refetch();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  if (currentEmployee?.role !== 'admin' && currentEmployee?.role !== 'teamleader') {
    return null;
  }

  return (
    <div className="space-y-4">
      <Dialog open={isAddOrEditOpen} onOpenChange={setIsAddOrEditOpen}>
        <DialogTrigger asChild>
          <Button onClick={() => handleOpenDialog(null)}>Add New User</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newUser.name}
                onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                required={!editingUser}
                placeholder={editingUser ? 'Leave blank to keep current password' : ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={newUser.role}
                onValueChange={(value) => setNewUser(prev => ({ ...prev, role: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="teamleader">Team Leader</SelectItem>
                  <SelectItem value="worker">Worker</SelectItem>
                  <SelectItem value="preparater">Preparater</SelectItem>
                  <SelectItem value="workstation">Workstation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="workstation">Workstation (optional)</Label>
              <Select
                value={newUser.workstation}
                onValueChange={(value) => setNewUser(prev => ({ ...prev, workstation: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select workstation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CUTTING">Cutting</SelectItem>
                  <SelectItem value="WELDING">Welding</SelectItem>
                  <SelectItem value="PAINTING">Painting</SelectItem>
                  <SelectItem value="ASSEMBLY">Assembly</SelectItem>
                  <SelectItem value="PACKAGING">Packaging</SelectItem>
                  <SelectItem value="SHIPPING">Shipping</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">{editingUser ? 'Update User' : 'Add User'}</Button>
          </form>
        </DialogContent>
      </Dialog>
      
      <div className="rounded-md border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="py-3 px-4 text-left">Name</th>
              <th className="py-3 px-4 text-left">Email</th>
              <th className="py-3 px-4 text-left">Role</th>
              <th className="py-3 px-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees?.map((employee) => (
              <tr key={employee.id} className="border-b">
                <td className="py-3 px-4">{employee.name}</td>
                <td className="py-3 px-4">{employee.email || '-'}</td>
                <td className="py-3 px-4">{employee.role}</td>
                <td className="py-3 px-4">
                  {(currentEmployee?.role === 'admin' || currentEmployee?.role === 'teamleader') && (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(employee)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDeleteClick(employee)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user account for {userToDelete?.name}.
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

export default UserManagement;
