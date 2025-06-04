
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (error: any) {
      toast({
        title: 'Login Failed',
        description: error.message || 'Invalid credentials',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Quick login buttons for demo purposes
  const quickLogin = async (role: "admin" | "manager" | "worker" | "workstation" | "installation_team") => {
    setIsLoading(true);
    try {
      let email = '';
      let password = 'password123';
      
      switch (role) {
        case 'admin':
          email = 'admin@company.com';
          break;
        case 'manager':
          email = 'manager@company.com';
          break;
        case 'worker':
          email = 'worker@company.com';
          break;
        case 'workstation':
          email = 'workstation@company.com';
          break;
        case 'installation_team':
          email = 'installation@company.com';
          break;
      }
      
      await login(email, password);
      navigate('/');
    } catch (error: any) {
      toast({
        title: 'Login Failed',
        description: error.message || 'Login failed',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Sign in</CardTitle>
            <CardDescription className="text-center">
              Enter your email and password to access your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
            
            <div className="space-y-2">
              <p className="text-sm text-gray-600 text-center">Quick login for demo:</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => quickLogin('admin')} disabled={isLoading}>
                  Admin
                </Button>
                <Button variant="outline" size="sm" onClick={() => quickLogin('manager')} disabled={isLoading}>
                  Manager
                </Button>
                <Button variant="outline" size="sm" onClick={() => quickLogin('worker')} disabled={isLoading}>
                  Worker
                </Button>
                <Button variant="outline" size="sm" onClick={() => quickLogin('workstation')} disabled={isLoading}>
                  Workstation
                </Button>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => quickLogin('installation_team')} disabled={isLoading}>
                Installation Team
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
