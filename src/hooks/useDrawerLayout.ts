import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/context/AuthContext';

/**
 * Returns true when the navbar should use drawer (collapsed) layout.
 * This applies for mobile users and installation_team role users.
 */
export function useDrawerLayout() {
  const isMobile = useIsMobile();
  const { currentEmployee } = useAuth();
  return isMobile || currentEmployee?.role === 'installation_team';
}
