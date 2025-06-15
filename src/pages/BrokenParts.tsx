
import React from 'react';
import { Link } from 'react-router-dom';
import BrokenPartsList from '@/components/broken-parts/BrokenPartsList';
import { useAuth } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { PlusCircle, BarChart } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const BrokenParts: React.FC = () => {
  const { currentEmployee } = useAuth();
  const { t, i18n } = useTranslation();
  
  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-64 h-full">
        <Navbar />
      </div>
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">{t('brokenParts.title')}</h1>
            <div className="flex space-x-2">
              <Button variant="outline" asChild>
                <Link to={`/${i18n.language}/broken-parts/summary`}>
                  <BarChart className="h-4 w-4 mr-2" />
                  {t('brokenParts.viewSummary')}
                </Link>
              </Button>
              <Button asChild>
                <Link to={`/${i18n.language}/broken-parts/new`}>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  {t('brokenParts.reportNew')}
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
