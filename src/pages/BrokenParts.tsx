
import React from 'react';
import { Link } from 'react-router-dom';
import BrokenPartsList from '@/components/broken-parts/BrokenPartsList';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { PlusCircle, BarChart } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';

const BrokenParts: React.FC = () => {
  const { currentEmployee } = useAuth();
  const { t, createLocalizedPath } = useLanguage();
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
        <div className={`${isMobile ? 'px-3 py-4' : 'px-4 py-6'} max-w-full`}>
          <div className={`flex ${isMobile ? 'flex-col gap-2' : 'justify-between items-center'} mb-4 sm:mb-6`}>
            <h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-foreground`}>{t('broken_parts_title')}</h1>
            <div className={`flex ${isMobile ? 'w-full' : ''} gap-2`}>
              <Button variant="outline" asChild size={isMobile ? 'sm' : 'default'} className={isMobile ? 'flex-1 text-xs' : ''}>
                <Link to={createLocalizedPath("/broken-parts/summary")}>
                  <BarChart className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                  {t('view_summary')}
                </Link>
              </Button>
              <Button asChild size={isMobile ? 'sm' : 'default'} className={isMobile ? 'flex-1 text-xs' : ''}>
                <Link to={createLocalizedPath("/broken-parts/new")}>
                  <PlusCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                  {t('report_new')}
                </Link>
              </Button>
            </div>
          </div>
          <BrokenPartsList />
        </div>
      </div>
    </div>
  );
};

export default BrokenParts;
