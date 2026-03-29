import React from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useRolePermissions } from "@/hooks/useRolePermissions";

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  /** The navbar_item key used in role_permissions table */
  navbarItem?: string;
  /** Legacy: still allow logistics flag override */
  requireLogistics?: boolean;
}

/**
 * Wraps a route to enforce role-based access using the role_permissions table.
 * If no navbarItem is provided, falls back to allowing all authenticated users.
 */
const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({
  children,
  navbarItem,
  requireLogistics,
}) => {
  const { currentEmployee, isDeveloper } = useAuth();
  const { tenant, lang } = useParams<{ tenant: string; lang: string }>();
  const { canAccess, isLoading } = useRolePermissions();

  if (!currentEmployee && !isDeveloper) return null;

  // Developers bypass all role checks
  if (isDeveloper) return <>{children}</>;

  if (!currentEmployee) return null;

  // While permissions are loading, show nothing (prevent flash)
  if (isLoading && navbarItem) return null;

  // Check logistics override
  const hasLogistics = requireLogistics ? currentEmployee.logistics : false;

  // If a navbarItem is specified, check role_permissions
  if (navbarItem && !canAccess(navbarItem) && !hasLogistics) {
    const base = tenant ? `/${tenant}/${lang || "nl"}` : "/";
    return <Navigate to={base} replace />;
  }

  return <>{children}</>;
};

export default RoleProtectedRoute;
