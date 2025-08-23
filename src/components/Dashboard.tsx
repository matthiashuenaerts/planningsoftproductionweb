import React from 'react';
import ProductionDashboard from './ProductionDashboard';
import SeedDataButton from './SeedDataButton';
import { useAuth } from '@/context/AuthContext';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldCheck } from "lucide-react";

const Dashboard: React.FC = () => {
  const { currentEmployee } = useAuth();

  return (
    <div>
      {currentEmployee?.role === 'admin' && (
        <Alert className="mb-6 bg-blue-50 border border-blue-200">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          <AlertTitle className="text-blue-800">Administrator Account</AlertTitle>
          <AlertDescription className="text-blue-700">
            You are logged in as an administrator. You have access to user management functionality.
          </AlertDescription>
        </Alert>
      )}

      <SeedDataButton />
      
      <ProductionDashboard />
    </div>
  );
};

export default Dashboard;
