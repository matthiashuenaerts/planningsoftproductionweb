
import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, currentEmployee } = useAuth();

  // Check for session expiration on route access
  useEffect(() => {
    const storedSession = localStorage.getItem('employeeSession');
    if (storedSession) {
      try {
        const employeeData = JSON.parse(storedSession);
        if (employeeData.expires && employeeData.expires < Date.now()) {
          // Session expired, clear it
          localStorage.removeItem('employeeSession');
        }
      } catch (error) {
        console.error('Failed to parse stored session:', error);
        localStorage.removeItem('employeeSession');
      }
    }
  }, []);

  if (!isAuthenticated) {
    // Store the current location so we can redirect back after login
    const currentPath = window.location.pathname + window.location.search;
    sessionStorage.setItem('redirectAfterLogin', currentPath);
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
