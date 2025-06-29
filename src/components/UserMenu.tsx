
import React from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVertical, CalendarDays } from 'lucide-react';
import HolidayRequestDialog from './HolidayRequestDialog';

const UserMenu: React.FC = () => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-white hover:bg-sky-700">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <HolidayRequestDialog>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            <CalendarDays className="mr-2 h-4 w-4" />
            Holiday Request
          </DropdownMenuItem>
        </HolidayRequestDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;
