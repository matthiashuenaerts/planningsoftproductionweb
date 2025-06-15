
import React from 'react';
import BrokenPartForm from '@/components/broken-parts/BrokenPartForm';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';

const NewBrokenPart: React.FC = () => {
  const { currentEmployee } = useAuth();
  
  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-64 h-full">
        <Navbar />
      </div>
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold mb-6">Report Broken Part</h1>
          <BrokenPartForm />
        </div>
      </div>
    </div>
  );
};

export default NewBrokenPart;
