import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { User, Lock, Building2 } from 'lucide-react';
const Login: React.FC = () => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const {
    login,
    isAuthenticated
  } = useAuth();

  // Trigger entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const redirectPath = sessionStorage.getItem('redirectAfterLogin');
      if (redirectPath) {
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(redirectPath);
      } else {
        navigate('/');
      }
    }
  }, [isAuthenticated, navigate]);

  // Global Enter key handler
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !loading) {
        e.preventDefault();
        const form = document.querySelector('form');
        if (form) {
          form.requestSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [loading]);
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !password) {
      toast({
        title: "Error",
        description: "Please enter both employee name and password",
        variant: "destructive"
      });
      return;
    }
    try {
      setLoading(true);

      // Get employee by name first to find their email
      const { data: employees, error: queryError } = await supabase
        .from('employees')
        .select('*')
        .eq('name', name)
        .eq('password', password);
      
      if (queryError) {
        console.error('Database query error:', queryError);
        throw new Error('Failed to connect to database');
      }

      if (!employees || employees.length === 0) {
        throw new Error('Invalid username or password');
      }

      const employee = employees[0];

      // Check if employee has auth_user_id (migrated to Supabase Auth)
      if (!employee.auth_user_id || !employee.email) {
        throw new Error('Your account needs to be migrated. Please contact your administrator.');
      }

      // Use Supabase Auth login with email and password
      const loginResult = await login(employee.email, password);
      
      if (loginResult.error) {
        throw new Error(loginResult.error);
      }

      toast({
        title: "Login successful",
        description: `Welcome, ${employee.name}!`
      });

      // Navigate to the originally requested page or home
      const redirectPath = sessionStorage.getItem('redirectAfterLogin');
      if (redirectPath) {
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(redirectPath);
      } else {
        navigate('/');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: "Login failed",
        description: error.message || "An error occurred during login",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  return <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-[fade-in_2s_ease-out]"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-[fade-in_2s_ease-out_0.5s_both]"></div>
        <div className="absolute top-40 left-40 w-60 h-60 bg-amber-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-[fade-in_2s_ease-out_1s_both]"></div>
      </div>

      <div className={`w-full max-w-md space-y-8 relative z-10 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
        
        {/* Logo Section */}
        <div className="text-center space-y-6">
          <div className="relative inline-block">
            <img src="https://static.wixstatic.com/media/99c033_5bb79e52130d4fa6bbae75d9a22b198d~mv2.png" alt="Company Logo" className="relative w-32 h-auto mx-auto rounded-lg shadow-lg hover:scale-105 transition-transform duration-300" />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-4xl text-[#195F85]">
                AutoMattiOn
              </h1>
              <h1 className="font-bold text-4xl text-[#42A5DB]">
                Compass
              </h1>
            </div>

            <p className="text-[#42A5DB] text-lg font-bold">
              Guiding your production to perfection!
            </p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="backdrop-blur-sm bg-white/80 border-0 shadow-2xl ring-1 ring-gray-200/50 hover:shadow-3xl transition-all duration-500">
          <CardHeader className="space-y-1 text-center pb-8">
            
            <CardTitle className="text-2xl font-semibold text-gray-800">Welcome Back</CardTitle>
            <CardDescription className="text-gray-600">
              Sign in to access your workspace
            </CardDescription>
          </CardHeader>
          
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                  Gebruikersnaam
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input id="name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Enter your employee name" disabled={loading} className="pl-10 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-colors duration-200" />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Paswoord
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" disabled={loading} className="pl-10 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 transition-colors duration-200" />
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="pt-6 pb-8">
              <Button 
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none" 
                type="submit" 
                disabled={loading}
              >
                {loading ? <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </div> : "Sign in"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>Secure access to your production planning system</p>
        </div>
      </div>
    </div>;
};
export default Login;
