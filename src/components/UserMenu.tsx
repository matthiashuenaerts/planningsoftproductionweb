
import React, { useState, useEffect } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { MoreVertical, CalendarDays, Plus, Users, Calendar } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { holidayRequestService } from '@/services/holidayRequestService';
import HolidayRequestDialog from './HolidayRequestDialog';
import HolidayRequestsList from './HolidayRequestsList';
import { useLanguage } from '@/context/LanguageContext';
import { useNavigate } from 'react-router-dom';

const UserMenu: React.FC = () => {
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { currentEmployee } = useAuth();
  const { createLocalizedPath } = useLanguage();
  const navigate = useNavigate();

  const canManageRequests = currentEmployee?.role === 'admin' || 
                           currentEmployee?.role === 'teamleader' || 
                           currentEmployee?.role === 'manager';

  useEffect(() => {
    const fetchPendingCount = async () => {
      if (!canManageRequests) return;
      
      try {
        const allRequests = await holidayRequestService.getAllRequests();
        const pending = allRequests.filter(request => request.status === 'pending');
        setPendingCount(pending.length);
      } catch (error) {
        console.error('Error fetching pending requests count:', error);
      }
    };

    if (canManageRequests) {
      fetchPendingCount();
    }
  }, [canManageRequests]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="text-white hover:bg-sky-700">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setShowHolidayModal(true)}>
            <CalendarDays className="mr-2 h-4 w-4" />
            Holiday
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate(createLocalizedPath('/general-schedule'))}>
            <Calendar className="mr-2 h-4 w-4" />
            General Schedule
          </DropdownMenuItem>
          {canManageRequests && (
            <DropdownMenuItem onSelect={() => setShowAdminModal(true)}>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                  <Users className="mr-2 h-4 w-4" />
                  Manage Requests
                </div>
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                    {pendingCount}
                  </Badge>
                )}
              </div>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showHolidayModal} onOpenChange={setShowHolidayModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Holiday Requests
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <HolidayRequestsList showAllRequests={false} />
            
            <div className="flex justify-center pt-4 border-t">
              <HolidayRequestDialog>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add New Holiday Request
                </Button>
              </HolidayRequestDialog>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {canManageRequests && (
        <Dialog open={showAdminModal} onOpenChange={setShowAdminModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Manage Holiday Requests
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {pendingCount} pending
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              <HolidayRequestsList showAllRequests={true} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default UserMenu;
