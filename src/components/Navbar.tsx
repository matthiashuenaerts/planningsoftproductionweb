import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Home, ListChecks, LayoutDashboard, Settings, Users, PackagePlus, Truck, LogOut, User, AlertTriangle, Menu, Clock } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { rushOrderService } from '@/services/rushOrderService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerClose, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { useTranslation } from 'react-i18next';

const NavbarContent = ({
  onItemClick
}: {
  onItemClick?: () => void;
}) => {
  const {
    currentEmployee,
    logout
  } = useAuth();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

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
  return <div className="h-full px-3 py-4 overflow-y-auto bg-sky-800 text-white flex flex-col">
      <div className="flex flex-col h-full justify-between">
        <div>
          <h2 className="px-2 py-3 text-lg font-semibold mb-2">Demo Account</h2>
          <ul className="space-y-2 font-medium">
            <li>
              <NavLink to={`/${lang}`} end className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
                <Home className="w-5 h-5 text-white group-hover:text-white" />
                <span className="ml-3">{t('navbar.dashboard')}</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="projects" className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
                <LayoutDashboard className="w-5 h-5 text-white group-hover:text-white" />
                <span className="ml-3">{t('navbar.projects')}</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="workstations" className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
                <Truck className="w-5 h-5 text-white group-hover:text-white" />
                <span className="ml-3">{t('navbar.workstations')}</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="broken-parts" className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
                <AlertTriangle className="w-5 h-5 text-white group-hover:text-white" />
                <span className="ml-3">{t('navbar.brokenParts')}</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="personal-tasks" className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
                <ListChecks className="w-5 h-5 text-white group-hover:text-white" />
                <span className="ml-3">{t('navbar.personalTasks')}</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="daily-tasks" className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
                <ListChecks className="w-5 h-5 text-white group-hover:text-white" />
                <span className="ml-3">{t('navbar.installationPlanning')}</span>
              </NavLink>
            </li>
            {currentEmployee && ['admin', 'manager', 'installation_team'].includes(currentEmployee.role) && <li>
                <NavLink to="planning" className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
                  <Users className="w-5 h-5 text-white group-hover:text-white" />
                  <span className="ml-3">{t('navbar.planning')}</span>
                </NavLink>
              </li>}
            {currentEmployee && ['admin', 'manager', 'installation_team'].includes(currentEmployee.role) && <li>
                <NavLink to="orders" className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
                  <PackagePlus className="w-5 h-5 text-white group-hover:text-white" />
                  <span className="ml-3">{t('navbar.orders')}</span>
                </NavLink>
              </li>}
            {currentEmployee && ['admin', 'manager', 'installation_team'].includes(currentEmployee.role) && <li>
                <NavLink to="logistics" className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
                  <Truck className="w-5 h-5 text-white group-hover:text-white" />
                  <span className="ml-3">{t('navbar.logistics')}</span>
                </NavLink>
              </li>}
            {currentEmployee && ['admin', 'manager', 'installation_team'].includes(currentEmployee.role) && <li>
                <NavLink to="logistics-out" className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
                  <Truck className="w-5 h-5 text-white group-hover:text-white" />
                  <span className="ml-3">{t('navbar.logisticsOut')}</span>
                </NavLink>
              </li>}
            {canSeeRushOrders && <li>
                <NavLink to="rush-orders" className="flex items-center justify-between p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
                  <div className="flex items-center">
                    <PackagePlus className="w-5 h-5 text-white group-hover:text-white" />
                    <span className="ml-3">{t('navbar.rushOrders')}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {pendingOrdersCount > 0 && <Badge variant="outline" className="bg-yellow-500 text-white border-0 font-medium">
                        {pendingOrdersCount}
                      </Badge>}
                    {totalUnreadMessages > 0 && <Badge variant="outline" className="bg-red-500 text-white border-0 font-medium">
                        {totalUnreadMessages}
                      </Badge>}
                  </div>
                </NavLink>
              </li>}
            {canSeeTimeRegistrations && <li>
                <NavLink to="time-registrations" className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
                  <Clock className="w-5 h-5 text-white group-hover:text-white" />
                  <span className="ml-3">{t('navbar.timeRegistrations')}</span>
                </NavLink>
              </li>}
            {currentEmployee?.role === 'admin' && (
              <li>
                <NavLink to="settings" className="flex items-center p-2 rounded-lg hover:bg-sky-700 group" onClick={handleItemClick}>
                  <Settings className="w-5 h-5 text-white group-hover:text-white" />
                  <span className="ml-3">{t('navbar.settings')}</span>
                </NavLink>
              </li>
            )}
          </ul>
        </div>
        
        {/* User profile at bottom */}
        <div className="mt-auto border-t border-blue-600 pt-2">
          {currentEmployee && <div className="flex items-center p-2 mb-2">
              <User className="w-5 h-5 text-white" />
              <span className="ml-3 text-sm">{currentEmployee.name}</span>
            </div>}
          <button onClick={() => {
          logout();
          handleItemClick();
        }} className="flex w-full items-center p-2 rounded-lg hover:bg-sky-700 group text-white">
            <LogOut className="w-5 h-5 text-white" />
            <span className="ml-3">{t('navbar.logout')}</span>
          </button>
        </div>
      </div>
    </div>;
};

const Navbar = () => {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <Drawer direction="left">
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
      </Drawer>;
  }
  return <div className="w-64 bg-sidebar fixed top-0 bottom-0">
      <NavbarContent />
    </div>;
};

export default Navbar;
