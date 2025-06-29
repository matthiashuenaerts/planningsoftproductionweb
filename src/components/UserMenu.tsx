
import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVertical, Calendar, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import HolidayRequestDialog from './HolidayRequestDialog';

const UserMenu: React.FC = () => {
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);
  const { logout } = useAuth();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setHolidayDialogOpen(true)}>
            <Calendar className="mr-2 h-4 w-4" />
            Holiday Request
          </DropdownMenuItem>
          <DropdownMenuItem onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <HolidayRequestDialog 
        open={holidayDialogOpen}
        onOpenChange={setHolidayDialogOpen}
      />
    </>
  );
};

export default UserMenu;
