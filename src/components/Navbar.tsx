
import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Home, ListChecks, LayoutDashboard, Settings, Users, PackagePlus, Truck, LogOut, User, AlertTriangle, Menu, Clock, FileText } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { rushOrderService } from '@/services/rushOrderService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerClose, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import UserMenu from './UserMenu';
import { ScrollArea } from '@/components/ui/scroll-area';

const NavbarContent = ({
  onItemClick
}: {
  onItemClick?: () => void;
}) => {
  const {
    currentEmployee,
    logout
  } = useAuth();
  const { t, lang, changeLang, createLocalizedPath } = useLanguage();

  // Allow admin, manager, installation_team, and worker roles to see the Rush Orders menu
  const canSeeRushOrders = currentEmployee && ['admin', 'manager', 'installation_team', 'worker'].includes(currentEmployee.role);

  // Allow admin and manager to see time registrations
  const canSeeTimeRegistrations = currentEmployee && ['admin', 'manager'].includes(currentEmployee.role);

  // Query rush orders to get counts for pending orders and unread messages
  const {
    data: rushOrders,
    isLoading
  } = useQuery({
    queryKey: ['rushOrders', 'navbar'],
    queryFn: rushOrderService.getAllRushOrders,
    enabled: !!canSeeRushOrders,
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  // Calculate counts
  const pendingOrdersCount = rushOrders?.filter(order => order.status === 'pending').length || 0;

  // Calculate total unread messages across all rush orders
  const totalUnreadMessages = rushOrders?.reduce((total, order) => {
    return total + (order.unread_messages_count || 0);
  }, 0) || 0;

  const handleItemClick = () => {
    if (onItemClick) {
      onItemClick();
    }
  };

  return (
    <div className="h-full bg-sky-800 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 mb-2">
        <h2 className="text-lg font-semibold">{t('demo_account')}</h2>
      </div>

      {/* Scrollable Menu Items */}
      <ScrollArea className="flex-1 px-3">
        <ul className="space-y-2 font-medium pb-4">
          <li>
            <NavLink to={createLocalizedPath("/")} className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
              <Home className="w-5 h-5 text-white group-hover:text-white" />
              <span className="ml-3">{t('dashboard')}</span>
            </NavLink>
          </li>
          <li>
            <NavLink to={createLocalizedPath("/projects")} className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
              <LayoutDashboard className="w-5 h-5 text-white group-hover:text-white" />
              <span className="ml-3">{t('projects')}</span>
            </NavLink>
          </li>
          <li>
            <NavLink to={createLocalizedPath("/workstations")} className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
              <Truck className="w-5 h-5 text-white group-hover:text-white" />
              <span className="ml-3">{t('workstations')}</span>
            </NavLink>
          </li>
          <li>
            <NavLink to={createLocalizedPath("/broken-parts")} className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
              <AlertTriangle className="w-5 h-5 text-white group-hover:text-white" />
              <span className="ml-3">{t('broken_parts')}</span>
            </NavLink>
          </li>
          <li>
            <NavLink to={createLocalizedPath("/personal-tasks")} className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
              <ListChecks className="w-5 h-5 text-white group-hover:text-white" />
              <span className="ml-3">{t('personal_tasks')}</span>
            </NavLink>
          </li>
          <li>
            <NavLink to={createLocalizedPath("/notes-and-tasks")} className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
              <FileText className="w-5 h-5 text-white group-hover:text-white" />
              <span className="ml-3">Notes & Tasks</span>
            </NavLink>
          </li>
          {currentEmployee && ['admin', 'manager', 'installation_team', 'teamleader'].includes(currentEmployee.role) && (
            <li>
              <NavLink to={createLocalizedPath("/daily-tasks")} className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
                <ListChecks className="w-5 h-5 text-white group-hover:text-white" />
                <span className="ml-3">{t('installation_planning')}</span>
              </NavLink>
            </li>
          )}

          {currentEmployee && ['admin', 'manager', 'installation_team', 'teamleader'].includes(currentEmployee.role) && (
            <li>
              <NavLink to={createLocalizedPath("/planning")} className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
                <Users className="w-5 h-5 text-white group-hover:text-white" />
                <span className="ml-3">{t('planning')}</span>
              </NavLink>
            </li>
          )}
          {currentEmployee && ['admin', 'manager', 'installation_team', 'teamleader', 'preparater'].includes(currentEmployee.role) && (
            <li>
              <NavLink to={createLocalizedPath("/orders")} className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
                <PackagePlus className="w-5 h-5 text-white group-hover:text-white" />
                <span className="ml-3">{t('orders')}</span>
              </NavLink>
            </li>
          )}
          {currentEmployee && ['admin', 'manager', 'installation_team', 'teamleader', 'preparater'].includes(currentEmployee.role) && (
            <li>
              <NavLink to={createLocalizedPath("/logistics")} className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
                <Truck className="w-5 h-5 text-white group-hover:text-white" />
                <span className="ml-3">{t('logistics')}</span>
              </NavLink>
            </li>
          )}
          {currentEmployee && ['admin', 'manager', 'installation_team', 'teamleader', 'preparater'].includes(currentEmployee.role) && (
            <li>
              <NavLink to={createLocalizedPath("/logistics-out")} className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
                <Truck className="w-5 h-5 text-white group-hover:text-white" />
                <span className="ml-3">{t('logistics_out')}</span>
              </NavLink>
            </li>
          )}
          {canSeeRushOrders && (
            <li>
              <NavLink to={createLocalizedPath("/rush-orders")} className="flex items-center justify-between p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
                <div className="flex items-center">
                  <PackagePlus className="w-5 h-5 text-white group-hover:text-white" />
                  <span className="ml-3">{t('rush_orders')}</span>
                </div>
                <div className="flex items-center space-x-2">
                  {pendingOrdersCount > 0 && (
                    <Badge variant="outline" className="bg-yellow-500 text-white border-0 font-medium">
                      {pendingOrdersCount}
                    </Badge>
                  )}
                  {totalUnreadMessages > 0 && (
                    <Badge variant="outline" className="bg-red-500 text-white border-0 font-medium">
                      {totalUnreadMessages}
                    </Badge>
                  )}
                </div>
              </NavLink>
            </li>
          )}
          {canSeeTimeRegistrations && (
            <li>
              <NavLink to={createLocalizedPath("/time-registrations")} className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
                <Clock className="w-5 h-5 text-white group-hover:text-white" />
                <span className="ml-3">{t('time_registrations')}</span>
              </NavLink>
            </li>
          )}
          {currentEmployee?.role === 'admin' && (
            <li>
              <NavLink to={createLocalizedPath("/settings")} className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
                <Settings className="w-5 h-5 text-white group-hover:text-white" />
                <span className="ml-3">{t('settings')}</span>
              </NavLink>
            </li>
          )}
        </ul>
      </ScrollArea>
        
      {/* Fixed Bottom Section */}
      <div className="mt-auto px-3 pb-4">
        <div className="flex justify-center items-center gap-2 mb-2 p-2 border-t border-b border-blue-600">
          <Button 
            size="sm" 
            variant={lang === 'nl' ? 'default' : 'ghost'} 
            className={cn(
              "text-sm font-medium",
              lang === 'nl' 
                ? 'bg-white text-sky-800 hover:bg-gray-100' 
                : 'text-white hover:bg-sky-700 hover:text-white'
            )}
            onClick={() => changeLang('nl')}
          >
            NL
          </Button>
          <Button 
            size="sm" 
            variant={lang === 'en' ? 'default' : 'ghost'} 
            className={cn(
              "text-sm font-medium",
              lang === 'en' 
                ? 'bg-white text-sky-800 hover:bg-gray-100' 
                : 'text-white hover:bg-sky-700 hover:text-white'
            )}
            onClick={() => changeLang('en')}
          >
            EN
          </Button>
          <Button 
            size="sm" 
            variant={lang === 'fr' ? 'default' : 'ghost'} 
            className={cn(
              "text-sm font-medium",
              lang === 'fr' 
                ? 'bg-white text-sky-800 hover:bg-gray-100' 
                : 'text-white hover:bg-sky-700 hover:text-white'
            )}
            onClick={() => changeLang('fr')}
          >
            FR
          </Button>
        </div>
        {currentEmployee && (
          <div className="flex items-center justify-between p-2 mb-2">
            <div className="flex items-center">
              <User className="w-5 h-5 text-white" />
              <span className="ml-3 text-sm">{currentEmployee.name}</span>
            </div>
            <UserMenu />
          </div>
        )}
        <button 
          onClick={() => {
            logout();
            handleItemClick();
          }} 
          className="flex w-full items-center p-2 rounded-lg hover:bg-sky-700 group text-white"
        >
          <LogOut className="w-5 h-5 text-white" />
          <span className="ml-3">{t('logout')}</span>
        </button>
      </div>
    </div>
  );
};

const Navbar = () => {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <Drawer direction="left">
        <DrawerTrigger asChild>
          <Button variant="outline" size="icon" className="fixed top-4 left-4 z-50 bg-sky-800 border-sky-600 text-white hover:bg-sky-700">
            <Menu className="h-4 w-4" />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="h-full w-64 mt-0 rounded-none">
          <DrawerClose asChild>
            <div className="h-full">
              <NavbarContent onItemClick={() => {}} />
            </div>
          </DrawerClose>
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <div className="w-64 bg-sidebar fixed top-0 bottom-0">
      <NavbarContent />
    </div>
  );
};

export default Navbar;
