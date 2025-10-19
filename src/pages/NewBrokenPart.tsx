
import React from 'react';
import BrokenPartForm from '@/components/broken-parts/BrokenPartForm';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import { useLanguage } from '@/context/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';

const NewBrokenPart: React.FC = () => {
  const { currentEmployee } = useAuth();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  
  return (
    <div className="flex h-screen bg-gray-50">
      {!isMobile && (
        <div className="w-64 h-full">
          <Navbar />
        </div>
      )}
      {isMobile && <Navbar />}
      <div className={`flex-1 overflow-auto ${!isMobile ? '' : ''}`}>
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold mb-6">{t('report_broken_part')}</h1>
          <BrokenPartForm />
        </div>
      </div>
    </div>
  );
};

export default NewBrokenPart;
