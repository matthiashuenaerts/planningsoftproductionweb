
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
import { Trash2, Plus, Settings, Shield } from 'lucide-react';

type AppRole = 'admin' | 'manager' | 'worker' | 'workstation' | 'installation_team';

interface RolePermission {
  id: string;
  role: AppRole;
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

const AVAILABLE_ROLES: AppRole[] = ['admin', 'manager', 'worker', 'workstation', 'installation_team'];

const UserRolesSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRoleForPermissions, setSelectedRoleForPermissions] = useState<AppRole>('admin');
  const [newRoleName, setNewRoleName] = useState<string>('');

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

  // Get unique roles from permissions
  const existingRoles = Array.from(new Set(rolePermissions?.map(p => p.role) || []));

  // Add new role mutation
  const addRoleMutation = useMutation({
    mutationFn: async (newRole: string) => {
      // Validate that the role is one of the allowed enum values
      if (!AVAILABLE_ROLES.includes(newRole.toLowerCase() as AppRole)) {
        throw new Error(`Role "${newRole}" is not a valid role. Must be one of: ${AVAILABLE_ROLES.join(', ')}`);
      }

      const roleEnum = newRole.toLowerCase() as AppRole;
      
      // First add default permissions for the new role
      const defaultPermissions = NAVBAR_ITEMS.map(item => ({
        role: roleEnum,
        navbar_item: item.key,
        can_access: false // Default to no access
      }));

      const { error } = await supabase
        .from('role_permissions')
        .insert(defaultPermissions);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rolePermissions'] });
      setNewRoleName('');
      toast({
        title: 'Success',
        description: 'New role added successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add new role',
        variant: 'destructive'
      });
      console.error('Add role error:', error);
    }
  });

  // Remove role mutation
  const removeRoleMutation = useMutation({
    mutationFn: async (role: AppRole) => {
      const { error } = await supabase
        .from('role_permissions')
        .delete()
        .eq('role', role);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rolePermissions'] });
      toast({
        title: 'Success',
        description: 'Role removed successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to remove role',
        variant: 'destructive'
      });
      console.error('Remove role error:', error);
    }
  });

  // Update role permission mutation
  const updateRolePermissionMutation = useMutation({
    mutationFn: async ({ role, navbarItem, canAccess }: { role: AppRole; navbarItem: string; canAccess: boolean }) => {
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

  const handleAddRole = () => {
    if (!newRoleName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a role name',
        variant: 'destructive'
      });
      return;
    }

    if (existingRoles.includes(newRoleName.toLowerCase() as AppRole)) {
      toast({
        title: 'Error',
        description: 'Role already exists',
        variant: 'destructive'
      });
      return;
    }

    addRoleMutation.mutate(newRoleName.toLowerCase());
  };

  const handleRemoveRole = (role: AppRole) => {
    // Prevent removing default roles
    if (AVAILABLE_ROLES.includes(role)) {
      toast({
        title: 'Error',
        description: 'Cannot remove default system roles',
        variant: 'destructive'
      });
      return;
    }

    removeRoleMutation.mutate(role);
  };

  const handlePermissionChange = (navbarItem: string, canAccess: boolean) => {
    updateRolePermissionMutation.mutate({
      role: selectedRoleForPermissions,
      navbarItem,
      canAccess
    });
  };

  const getPermissionForRole = (role: AppRole, navbarItem: string): boolean => {
    const permission = rolePermissions?.find(p => p.role === role && p.navbar_item === navbarItem);
    return permission?.can_access ?? false;
  };

  return (
    <div className="space-y-6">
      {/* Add New Role */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Plus className="h-5 w-5" />
            <span>Add New Role</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <p className="text-sm text-gray-600">Available roles: {AVAILABLE_ROLES.join(', ')}</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Label htmlFor="new-role">Role Name</Label>
              <Input
                id="new-role"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Enter role name (e.g., admin, manager, worker)"
              />
            </div>
            <Button 
              onClick={handleAddRole}
              disabled={addRoleMutation.isPending}
              className="mt-6"
            >
              {addRoleMutation.isPending ? 'Adding...' : 'Add Role'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing Roles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Existing Roles</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {existingRoles.length > 0 ? (
            <div className="space-y-3">
              {existingRoles.map((role) => (
                <div key={role} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Shield className="h-4 w-4 text-gray-500" />
                    <Badge variant="outline">
                      {role.replace('_', ' ')}
                    </Badge>
                  </div>
                  {!AVAILABLE_ROLES.includes(role) && (
                    <Button
                      onClick={() => handleRemoveRole(role)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-4">No roles found.</p>
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
              <Select value={selectedRoleForPermissions} onValueChange={(value: AppRole) => setSelectedRoleForPermissions(value)}>
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {existingRoles.map((role) => (
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
