
import React from 'react';
import BrokenPartsSummary from '@/components/broken-parts/BrokenPartsSummary';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import { useIsMobile } from '@/hooks/use-mobile';

const BrokenPartsSummaryPage: React.FC = () => {
  const { currentEmployee } = useAuth();
  const isMobile = useIsMobile();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {!isMobile && (
        <div className="w-64 h-full flex-shrink-0">
          <Navbar />
        </div>
      )}
      {isMobile && <Navbar />}
      <div className={`flex-1 overflow-auto min-w-0 ${isMobile ? 'pt-16' : ''}`}>
        <div className={`${isMobile ? 'px-3 py-4' : 'container mx-auto px-4 py-6'}`}>
          <BrokenPartsSummary />
        </div>
      </div>
    </div>
  );
};

export default BrokenPartsSummaryPage;
