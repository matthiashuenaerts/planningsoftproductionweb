
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Trash2, User, Settings, Shield } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  role: string;
  email?: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  employee: Employee;
}

interface RolePermission {
  id: string;
  role: string;
  navbar_item: string;
  can_access: boolean;
}

const NAVBAR_ITEMS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'projects', label: 'Projects' },
  { key: 'workstations', label: 'Workstations' },
  { key: 'broken-parts', label: 'Broken Parts' },
  { key: 'personal-tasks', label: 'Personal Tasks' },
  { key: 'daily-tasks', label: 'Installation Planning' },
  { key: 'planning', label: 'Planning' },
  { key: 'orders', label: 'Orders' },
  { key: 'logistics', label: 'Logistics' },
  { key: 'rush-orders', label: 'Rush Orders' },
  { key: 'time-registrations', label: 'Time Registrations' },
  { key: 'settings', label: 'Settings' }
];

const AVAILABLE_ROLES = ['admin', 'manager', 'worker', 'workstation', 'installation_team'];

const UserRolesSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedRoleForPermissions, setSelectedRoleForPermissions] = useState<string>('admin');

  // Fetch all employees
  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Employee[];
    }
  });

  // Fetch user roles
  const { data: userRoles } = useQuery({
    queryKey: ['userRoles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          *,
          employee:employees(*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as UserRole[];
    }
  });

  // Fetch role permissions
  const { data: rolePermissions } = useQuery({
    queryKey: ['rolePermissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
        .order('role', { ascending: true });
      
      if (error) throw error;
      return data as RolePermission[];
    }
  });

  // Add user role mutation
  const addUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { data, error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userRoles'] });
      setSelectedEmployee('');
      setSelectedRole('');
      toast({
        title: 'Success',
        description: 'User role added successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to add user role',
        variant: 'destructive'
      });
      console.error('Add user role error:', error);
    }
  });

  // Remove user role mutation
  const removeUserRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userRoles'] });
      toast({
        title: 'Success',
        description: 'User role removed successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to remove user role',
        variant: 'destructive'
      });
      console.error('Remove user role error:', error);
    }
  });

  // Update role permission mutation
  const updateRolePermissionMutation = useMutation({
    mutationFn: async ({ role, navbarItem, canAccess }: { role: string; navbarItem: string; canAccess: boolean }) => {
      const { error } = await supabase
        .from('role_permissions')
        .upsert({ 
          role, 
          navbar_item: navbarItem, 
          can_access: canAccess 
        }, {
          onConflict: 'role,navbar_item'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rolePermissions'] });
      toast({
        title: 'Success',
        description: 'Role permission updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update role permission',
        variant: 'destructive'
      });
      console.error('Update role permission error:', error);
    }
  });

  const handleAddUserRole = () => {
    if (!selectedEmployee || !selectedRole) {
      toast({
        title: 'Error',
        description: 'Please select both an employee and a role',
        variant: 'destructive'
      });
      return;
    }

    addUserRoleMutation.mutate({ userId: selectedEmployee, role: selectedRole });
  };

  const handleRemoveUserRole = (roleId: string) => {
    removeUserRoleMutation.mutate(roleId);
  };

  const handlePermissionChange = (navbarItem: string, canAccess: boolean) => {
    updateRolePermissionMutation.mutate({
      role: selectedRoleForPermissions,
      navbarItem,
      canAccess
    });
  };

  const getPermissionForRole = (role: string, navbarItem: string): boolean => {
    const permission = rolePermissions?.find(p => p.role === role && p.navbar_item === navbarItem);
    return permission?.can_access ?? false;
  };

  return (
    <div className="space-y-6">
      {/* Add User Role */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Assign User Roles</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="employee-select">Select Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees?.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name} ({employee.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="role-select">Select Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={handleAddUserRole}
                disabled={!selectedEmployee || !selectedRole || addUserRoleMutation.isPending}
                className="w-full"
              >
                {addUserRoleMutation.isPending ? 'Adding...' : 'Add Role'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current User Roles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Current User Roles</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {userRoles && userRoles.length > 0 ? (
            <div className="space-y-3">
              {userRoles.map((userRole) => (
                <div key={userRole.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <User className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="font-medium">{userRole.employee.name}</p>
                      <p className="text-sm text-gray-600">{userRole.employee.email}</p>
                    </div>
                    <Badge variant="outline">
                      {userRole.role.replace('_', ' ')}
                    </Badge>
                  </div>
                  <Button
                    onClick={() => handleRemoveUserRole(userRole.id)}
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-4">No user roles assigned yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Role Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Role Permissions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="permissions-role-select">Select Role to Configure</Label>
              <Select value={selectedRoleForPermissions} onValueChange={setSelectedRoleForPermissions}>
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Navbar Access Permissions</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {NAVBAR_ITEMS.map((item) => {
                  const hasAccess = getPermissionForRole(selectedRoleForPermissions, item.key);
                  
                  return (
                    <div key={item.key} className="flex items-center justify-between p-3 border rounded-lg">
                      <Label htmlFor={`permission-${item.key}`} className="flex-1">
                        {item.label}
                      </Label>
                      <Switch
                        id={`permission-${item.key}`}
                        checked={hasAccess}
                        onCheckedChange={(checked) => handlePermissionChange(item.key, checked)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserRolesSettings;
