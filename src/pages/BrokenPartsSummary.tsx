import React from 'react';
import BrokenPartsSummary from '@/components/broken-parts/BrokenPartsSummary';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
const BrokenPartsSummaryPage: React.FC = () => {
  const {
    currentEmployee
  } = useAuth();
  return <div className="flex h-screen bg-gray-50">
      <div className="w-64 h-full">
        <Navbar />
      </div>
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 py-6 my-[70px]">
          <BrokenPartsSummary />
        </div>
      </div>
    </div>;
};
export default BrokenPartsSummaryPage;