
import React from 'react';
import Dashboard from '@/components/Dashboard';
import { useAuth } from '@/context/AuthContext';
import UserManagement from '@/components/UserManagement';
import WorkstationDashboard from '@/components/WorkstationDashboard';
import AppLayout from '@/components/AppLayout';

const Index = () => {
  const { currentEmployee } = useAuth();
  
  // Display dedicated workstation dashboard ONLY for workstation role
  if (currentEmployee?.role === 'workstation') {
    return <WorkstationDashboard />;
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Faseopvolging productie</h1>
        <Dashboard />
        {(currentEmployee?.role === 'admin' || currentEmployee?.role === 'teamleader') && (
          <div className="mt-8 p-6 bg-slate-50 rounded-lg border border-slate-200">
            <h2 className="text-2xl font-semibold mb-4">User Management</h2>
            <p className="mb-4 text-slate-600">As an administrator or team leader, you can add and manage users in the system.</p>
            <UserManagement />
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Index;
