import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

interface DeveloperRouteProps {
  children: React.ReactNode;
}

const DeveloperRoute: React.FC<DeveloperRouteProps> = ({ children }) => {
  const { isAuthenticated, isDeveloper } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    sessionStorage.setItem(
      "redirectAfterLogin",
      location.pathname + location.search
    );
    return <Navigate to="/dev/login" replace />;
  }

  if (!isDeveloper) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default DeveloperRoute;
