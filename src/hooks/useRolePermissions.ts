import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface RolePermission {
  navbar_item: string;
  can_access: boolean;
}

export function useRolePermissions() {
  const { currentEmployee, isDeveloper } = useAuth();

  const role = currentEmployee?.role;

  const { data: permissions, isLoading } = useQuery({
    queryKey: ['role_permissions', role],
    queryFn: async () => {
      if (!role) return [];
      const { data, error } = await supabase
        .from('role_permissions')
        .select('navbar_item, can_access')
        .eq('role', role);
      if (error) {
        console.error('Failed to fetch role permissions:', error);
        return [];
      }
      return (data as RolePermission[]) ?? [];
    },
    enabled: !!role && !isDeveloper,
    staleTime: 5 * 60 * 1000,
  });

  /**
   * Check if the current user can access a navbar item.
   * Developers always have access. If no permission row exists, default to false.
   */
  const canAccess = (navbarItem: string): boolean => {
    if (isDeveloper) return true;
    if (isLoading || !permissions) return false; // deny while loading
    const perm = permissions.find(p => p.navbar_item === navbarItem);
    // If no row exists for this item, deny access
    return perm?.can_access ?? false;
  };

  return { canAccess, isLoading, permissions };
}
