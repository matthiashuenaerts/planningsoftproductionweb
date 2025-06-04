
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface Employee {
  id: string;
  name: string;
  role: 'admin' | 'manager' | 'worker' | 'workstation' | 'installation_team';
  workstation?: string;
  expires?: number;
}

interface AuthContextType {
  currentEmployee: Employee | null;
  isAuthenticated: boolean;
  login: (employeeData: Employee) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  
  // Check for existing session on component mount and check for expiration
  useEffect(() => {
    const checkSession = () => {
      const storedSession = localStorage.getItem('employeeSession');
      if (storedSession) {
        try {
          const employeeData = JSON.parse(storedSession);
          
          // Check if session has expired
          if (employeeData.expires && employeeData.expires < Date.now()) {
            console.log('Session expired, logging out');
            localStorage.removeItem('employeeSession');
            setCurrentEmployee(null);
            // Only redirect to login if not already there
            if (window.location.pathname !== '/login') {
              navigate('/login');
            }
            return;
          }
          
          setCurrentEmployee(employeeData);
        } catch (error) {
          console.error('Failed to parse stored session:', error);
          localStorage.removeItem('employeeSession');
          setCurrentEmployee(null);
        }
      }
      setIsLoading(false);
    };
    
    // Check session immediately
    checkSession();
    
    // Set up interval to check session every minute
    const intervalId = setInterval(checkSession, 60000);
    
    return () => clearInterval(intervalId);
  }, [navigate]);
  
  const login = (employeeData: Employee) => {
    setCurrentEmployee(employeeData);
    // Calculate session expiration - end of today
    const today = new Date();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    
    const sessionData = {
      ...employeeData,
      expires: endOfDay.getTime()
    };
    
    localStorage.setItem('employeeSession', JSON.stringify(sessionData));
  };
  
  const logout = () => {
    setCurrentEmployee(null);
    localStorage.removeItem('employeeSession');
    navigate('/login');
  };
  
  // Don't render children until we've checked for existing session
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }
  
  return (
    <AuthContext.Provider
      value={{
        currentEmployee,
        isAuthenticated: !!currentEmployee,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
