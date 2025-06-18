
import React from 'react';
import BrokenPartsSummary from '@/components/broken-parts/BrokenPartsSummary';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import { useIsMobile } from '@/hooks/use-mobile';

const BrokenPartsSummaryPage: React.FC = () => {
  const { currentEmployee } = useAuth();
  const isMobile = useIsMobile();

  return (
    <div className="flex h-screen bg-gray-50">
      {!isMobile && (
        <div className="w-64 h-full">
          <Navbar />
        </div>
      )}
      <div className={`flex-1 overflow-auto ${isMobile ? 'w-full' : 'ml-0'}`}>
        <div className="container mx-auto px-4 py-6">
          <BrokenPartsSummary />
        </div>
      </div>
    </div>
  );
};

export default BrokenPartsSummaryPage;
