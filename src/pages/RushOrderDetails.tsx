
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import Navbar from '@/components/Navbar';
import RushOrderDetail from '@/components/rush-orders/RushOrderDetail';
import { useLanguage } from '@/context/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';

const RushOrderDetails = () => {
  const { rushOrderId } = useParams<{ rushOrderId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, createLocalizedPath } = useLanguage();
  const isMobile = useIsMobile();
  
  const handleStatusChange = () => {
    // Invalidate the rush orders list to refresh data
    queryClient.invalidateQueries({ queryKey: ['rushOrders'] });
  };
  
  return (
    <div className="flex min-h-screen">
      {!isMobile && (
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
      )}
      <div className={`w-full p-6 ${!isMobile ? 'ml-64' : ''}`}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <Button
              variant="ghost"
              className="mb-4"
              onClick={() => navigate(createLocalizedPath('/rush-orders'))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              {t('back_to_rush_orders')}
            </Button>
            
            <h1 className="text-3xl font-bold">{t('rush_order_details_title')}</h1>
          </div>
          
          {rushOrderId ? (
            <RushOrderDetail 
              rushOrderId={rushOrderId} 
              onStatusChange={handleStatusChange}
            />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">{t('rush_order_not_found')}</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => navigate(createLocalizedPath('/rush-orders'))}
              >
                {t('return_to_rush_orders')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RushOrderDetails;
