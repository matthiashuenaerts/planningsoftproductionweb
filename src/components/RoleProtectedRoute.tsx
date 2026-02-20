import React from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
  requireLogistics?: boolean;
}

/**
 * Wraps a route to enforce role-based access.
 * If the user's role is not in allowedRoles, they are redirected to the dashboard.
 */
const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({
  children,
  allowedRoles,
  requireLogistics,
}) => {
  const { currentEmployee } = useAuth();
  const { tenant, lang } = useParams<{ tenant: string; lang: string }>();

  if (!currentEmployee) return null;

  const hasRole = allowedRoles.includes(currentEmployee.role);
  const hasLogistics = requireLogistics ? currentEmployee.logistics : false;

  if (!hasRole && !hasLogistics) {
    // Redirect to tenant dashboard
    const base = tenant ? `/${tenant}/${lang || "nl"}` : "/";
    return <Navigate to={base} replace />;
  }

  return <>{children}</>;
};

export default RoleProtectedRoute;
