
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import Navbar from '@/components/Navbar';
import RushOrderDetail from '@/components/rush-orders/RushOrderDetail';

const RushOrderDetails = () => {
  const { rushOrderId } = useParams<{ rushOrderId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const handleStatusChange = () => {
    // Invalidate the rush orders list to refresh data
    queryClient.invalidateQueries({ queryKey: ['rushOrders'] });
  };
  
  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      <div className="ml-64 w-full p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <Button
              variant="ghost"
              className="mb-4"
              onClick={() => navigate('/rush-orders')}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back to Rush Orders
            </Button>
            
            <h1 className="text-3xl font-bold">Rush Order Details</h1>
          </div>
          
          {rushOrderId ? (
            <RushOrderDetail 
              rushOrderId={rushOrderId} 
              onStatusChange={handleStatusChange}
            />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">Rush order not found</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => navigate('/rush-orders')}
              >
                Return to Rush Orders
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RushOrderDetails;
