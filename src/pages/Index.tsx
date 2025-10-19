import React from 'react';
import Dashboard from '@/components/Dashboard';
import { useAuth } from '@/context/AuthContext';
import UserManagement from '@/components/UserManagement';
import Navbar from '@/components/Navbar';
import WorkstationDashboard from '@/components/WorkstationDashboard';
import { useIsMobile } from '@/hooks/use-mobile';
const Index = () => {
  const {
    currentEmployee
  } = useAuth();
  const isMobile = useIsMobile();

  // Display dedicated workstation dashboard ONLY for workstation role
  if (currentEmployee?.role === 'workstation') {
    return <WorkstationDashboard />;
  }
  return <div className="flex min-h-screen">
      {!isMobile && (
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
      )}
      {isMobile && <Navbar />}
      <div className={`w-full p-6 ${!isMobile ? 'ml-64' : ''}`}>
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
          <Dashboard />
          {currentEmployee?.role === 'admin' || currentEmployee?.role === 'teamleader'}
        </div>
      </div>
    </div>;
};
export default Index;