import React from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { tenant } = useParams<{ tenant: string }>();

  if (!isAuthenticated) {
    const currentPath = window.location.pathname + window.location.search;
    sessionStorage.setItem("redirectAfterLogin", currentPath);
    // Redirect to tenant-scoped login
    return <Navigate to={tenant ? `/${tenant}/login` : "/dev/login"} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
