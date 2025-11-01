
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

interface Employee {
  id: string;
  name: string;
  role: 'admin' | 'manager' | 'worker' | 'workstation' | 'installation_team' | 'teamleader' | 'preparater';
  workstation?: string;
  logistics?: boolean;
}

interface AuthContextType {
  currentEmployee: Employee | null;
  isAuthenticated: boolean;
  user: User | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  
  // Fetch employee data based on auth user
  const fetchEmployeeData = async (userId: string) => {
    try {
      const { data: employee, error } = await supabase
        .from('employees')
        .select('*')
        .eq('auth_user_id', userId)
        .single();

      if (error) throw error;
      
      if (employee) {
        setCurrentEmployee({
          id: employee.id,
          name: employee.name,
          role: employee.role as 'admin' | 'manager' | 'worker' | 'workstation' | 'installation_team' | 'teamleader' | 'preparater',
          workstation: employee.workstation,
          logistics: employee.logistics
        });
      }
    } catch (error) {
      console.error('Failed to fetch employee data:', error);
      setCurrentEmployee(null);
    }
  };

  // Set up auth state listener
  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer employee data fetch with setTimeout
          setTimeout(() => {
            fetchEmployeeData(session.user.id);
          }, 0);
        } else {
          setCurrentEmployee(null);
        }
        
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchEmployeeData(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);
  
  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        await fetchEmployeeData(data.user.id);
      }

      return {};
    } catch (error: any) {
      console.error('Login error:', error);
      return { error: error.message || 'Failed to login' };
    }
  };
  
  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentEmployee(null);
    setUser(null);
    setSession(null);
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
        user,
        session,
        isAuthenticated: !!currentEmployee && !!session,
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
