
import React, { useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MoreVertical, CalendarDays, Plus } from 'lucide-react';
import HolidayRequestDialog from './HolidayRequestDialog';
import HolidayRequestsList from './HolidayRequestsList';

const UserMenu: React.FC = () => {
  const [showHolidayModal, setShowHolidayModal] = useState(false);

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
            {/* Holiday Requests List */}
            <HolidayRequestsList showAllRequests={false} />
            
            {/* Add New Request Button */}
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
    </>
  );
};

export default UserMenu;
