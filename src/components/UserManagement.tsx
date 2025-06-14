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
import { employeeService } from '@/services/dataService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

const UserManagement = () => {
  const { currentEmployee } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await employeeService.create(newUser);
      toast({
        title: "Success",
        description: "New user has been added successfully",
      });
      setIsOpen(false);
      refetch();
      setNewUser({
        name: '',
        email: '',
        password: '',
        role: 'worker',
        workstation: '',
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (currentEmployee?.role !== 'admin' && currentEmployee?.role !== 'teamleader') {
    return null;
  }

  return (
    <div className="space-y-4">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button>Add New User</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
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
                required
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
            <Button type="submit" className="w-full">Add User</Button>
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
                  {/* Actions would go here */}
                  <Button variant="outline" size="sm">Edit</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;
