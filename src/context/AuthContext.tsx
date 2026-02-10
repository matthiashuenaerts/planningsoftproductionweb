import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { useTenant } from "@/context/TenantContext";

interface Employee {
  id: string;
  name: string;
  role:
    | "admin"
    | "manager"
    | "worker"
    | "workstation"
    | "installation_team"
    | "teamleader"
    | "preparater";
  workstation?: string;
  logistics?: boolean;
  tenant_id?: string;
}

type AppRole =
  | "admin"
  | "manager"
  | "worker"
  | "workstation"
  | "installation_team"
  | "teamleader"
  | "preparater"
  | "advisor"
  | "calculator"
  | "developer";

interface AuthContextType {
  currentEmployee: Employee | null;
  roles: AppRole[];
  isDeveloper: boolean;
  isAuthenticated: boolean;
  user: User | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantSlug } = useTenant();

  const isDeveloper = roles.includes("developer");

  // Fetch employee data based on auth user
  const fetchEmployeeData = async (userId: string) => {
    try {
      const { data: employee, error } = await supabase
        .from("employees")
        .select("*")
        .eq("auth_user_id", userId)
        .maybeSingle();

      if (error) throw error;

      if (employee) {
        setCurrentEmployee({
          id: employee.id,
          name: employee.name,
          role: employee.role as Employee["role"],
          workstation: employee.workstation,
          logistics: employee.logistics,
          tenant_id: (employee as any).tenant_id,
        });
      } else {
        setCurrentEmployee(null);
      }
    } catch (error) {
      console.error("Failed to fetch employee data:", error);
      setCurrentEmployee(null);
    }
  };

  const fetchUserRoles = async (userId: string) => {
    try {
      const { data: emp } = await supabase
        .from("employees")
        .select("id")
        .eq("auth_user_id", userId)
        .maybeSingle();

      if (!emp) {
        setRoles([]);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", emp.id);

      if (error) throw error;
      setRoles(((data ?? []).map((r: any) => r.role) as AppRole[]) ?? []);
    } catch (error) {
      console.error("Failed to fetch user roles:", error);
      setRoles([]);
    }
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setTimeout(() => {
          fetchEmployeeData(session.user.id);
          fetchUserRoles(session.user.id);
        }, 0);
      } else {
        setCurrentEmployee(null);
        setRoles([]);
      }

      setIsLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchEmployeeData(session.user.id);
        fetchUserRoles(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        await Promise.all([fetchEmployeeData(data.user.id), fetchUserRoles(data.user.id)]);
      }

      return {};
    } catch (error: any) {
      console.error("Login error:", error);
      return { error: error.message || "Failed to login" };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentEmployee(null);
    setRoles([]);
    setUser(null);
    setSession(null);

    // Extract tenant from current path to redirect to tenant login
    const segs = location.pathname.split("/").filter(Boolean);
    const firstSeg = segs[0];
    if (firstSeg && firstSeg !== "dev") {
      navigate(`/${firstSeg}/login`);
    } else {
      navigate("/");
    }
  };

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
        roles,
        isDeveloper,
        user,
        session,
        isAuthenticated: !!session && (!!currentEmployee || isDeveloper),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
