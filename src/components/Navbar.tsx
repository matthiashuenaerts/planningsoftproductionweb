
import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Home, ListChecks, LayoutDashboard, Settings, Users, PackagePlus, Truck, LogOut, User, AlertTriangle, Menu, Clock } from 'lucide-react';
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
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50/30 border-r border-slate-200/80 shadow-sm">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 border-b border-slate-200/60">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
              <LayoutDashboard className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">
              {t('demo_account')}
            </h2>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
          <NavLink 
            to={createLocalizedPath("/")} 
            className={({ isActive }) => cn(
              "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group",
              isActive 
                ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 font-medium shadow-sm border border-blue-100" 
                : "hover:bg-slate-50/80 text-slate-700 hover:text-slate-900"
            )} 
            onClick={handleItemClick}
          >
            <Home className="w-5 h-5 mr-3" />
            <span>{t('dashboard')}</span>
          </NavLink>

          <NavLink 
            to={createLocalizedPath("/projects")} 
            className={({ isActive }) => cn(
              "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group",
              isActive 
                ? "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 font-medium shadow-sm border border-blue-100" 
                : "hover:bg-slate-50/80 text-slate-700 hover:text-slate-900"
            )} 
            onClick={handleItemClick}
          >
            <LayoutDashboard className="w-5 h-5 mr-3" />
            <span>{t('projects')}</span>
          </NavLink>

          <NavLink 
            to={createLocalizedPath("/workstations")} 
            className={({ isActive }) => cn(
              "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group",
              isActive 
                ? "bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 font-medium shadow-sm border border-emerald-100" 
                : "hover:bg-slate-50/80 text-slate-700 hover:text-slate-900"
            )} 
            onClick={handleItemClick}
          >
            <Truck className="w-5 h-5 mr-3" />
            <span>{t('workstations')}</span>
          </NavLink>

          <NavLink 
            to={createLocalizedPath("/broken-parts")} 
            className={({ isActive }) => cn(
              "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group",
              isActive 
                ? "bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 font-medium shadow-sm border border-orange-100" 
                : "hover:bg-slate-50/80 text-slate-700 hover:text-slate-900"
            )} 
            onClick={handleItemClick}
          >
            <AlertTriangle className="w-5 h-5 mr-3" />
            <span>{t('broken_parts')}</span>
          </NavLink>

          <NavLink 
            to={createLocalizedPath("/personal-tasks")} 
            className={({ isActive }) => cn(
              "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group",
              isActive 
                ? "bg-gradient-to-r from-violet-50 to-purple-50 text-violet-700 font-medium shadow-sm border border-violet-100" 
                : "hover:bg-slate-50/80 text-slate-700 hover:text-slate-900"
            )} 
            onClick={handleItemClick}
          >
            <ListChecks className="w-5 h-5 mr-3" />
            <span>{t('personal_tasks')}</span>
          </NavLink>

          <NavLink 
            to={createLocalizedPath("/daily-tasks")} 
            className={({ isActive }) => cn(
              "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group",
              isActive 
                ? "bg-gradient-to-r from-violet-50 to-purple-50 text-violet-700 font-medium shadow-sm border border-violet-100" 
                : "hover:bg-slate-50/80 text-slate-700 hover:text-slate-900"
            )} 
            onClick={handleItemClick}
          >
            <ListChecks className="w-5 h-5 mr-3" />
            <span>{t('installation_planning')}</span>
          </NavLink>

          {currentEmployee && ['admin', 'manager', 'installation_team', 'teamleader'].includes(currentEmployee.role) && (
            <NavLink 
              to={createLocalizedPath("/planning")} 
              className={({ isActive }) => cn(
                "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group",
                isActive 
                  ? "bg-gradient-to-r from-teal-50 to-cyan-50 text-teal-700 font-medium shadow-sm border border-teal-100" 
                  : "hover:bg-slate-50/80 text-slate-700 hover:text-slate-900"
              )} 
              onClick={handleItemClick}
            >
              <Users className="w-5 h-5 mr-3" />
              <span>{t('planning')}</span>
            </NavLink>
          )}

          {currentEmployee && ['admin', 'manager', 'installation_team', 'teamleader', 'preparater'].includes(currentEmployee.role) && (
            <NavLink 
              to={createLocalizedPath("/orders")} 
              className={({ isActive }) => cn(
                "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group",
                isActive 
                  ? "bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 font-medium shadow-sm border border-emerald-100" 
                  : "hover:bg-slate-50/80 text-slate-700 hover:text-slate-900"
              )} 
              onClick={handleItemClick}
            >
              <PackagePlus className="w-5 h-5 mr-3" />
              <span>{t('orders')}</span>
            </NavLink>
          )}

          {currentEmployee && ['admin', 'manager', 'installation_team', 'teamleader', 'preparater'].includes(currentEmployee.role) && (
            <NavLink 
              to={createLocalizedPath("/logistics")} 
              className={({ isActive }) => cn(
                "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group",
                isActive 
                  ? "bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 font-medium shadow-sm border border-emerald-100" 
                  : "hover:bg-slate-50/80 text-slate-700 hover:text-slate-900"
              )} 
              onClick={handleItemClick}
            >
              <Truck className="w-5 h-5 mr-3" />
              <span>{t('logistics')}</span>
            </NavLink>
          )}

          {currentEmployee && ['admin', 'manager', 'installation_team', 'teamleader', 'preparater'].includes(currentEmployee.role) && (
            <NavLink 
              to={createLocalizedPath("/logistics-out")} 
              className={({ isActive }) => cn(
                "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group",
                isActive 
                  ? "bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 font-medium shadow-sm border border-emerald-100" 
                  : "hover:bg-slate-50/80 text-slate-700 hover:text-slate-900"
              )} 
              onClick={handleItemClick}
            >
              <Truck className="w-5 h-5 mr-3" />
              <span>{t('logistics_out')}</span>
            </NavLink>
          )}

          {canSeeRushOrders && (
            <NavLink 
              to={createLocalizedPath("/rush-orders")} 
              className={({ isActive }) => cn(
                "flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group",
                isActive 
                  ? "bg-gradient-to-r from-red-50 to-pink-50 text-red-700 font-medium shadow-sm border border-red-100" 
                  : "hover:bg-slate-50/80 text-slate-700 hover:text-slate-900"
              )} 
              onClick={handleItemClick}
            >
              <div className="flex items-center">
                <PackagePlus className="w-5 h-5 mr-3" />
                <span>{t('rush_orders')}</span>
              </div>
              <div className="flex items-center space-x-2">
                {pendingOrdersCount > 0 && (
                  <Badge variant="outline" className="bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 border-orange-200 text-xs shadow-sm">
                    {pendingOrdersCount}
                  </Badge>
                )}
                {totalUnreadMessages > 0 && (
                  <Badge variant="outline" className="bg-gradient-to-r from-red-100 to-pink-100 text-red-700 border-red-200 text-xs shadow-sm">
                    {totalUnreadMessages}
                  </Badge>
                )}
              </div>
            </NavLink>
          )}

          {canSeeTimeRegistrations && (
            <NavLink 
              to={createLocalizedPath("/time-registrations")} 
              className={({ isActive }) => cn(
                "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group",
                isActive 
                  ? "bg-gradient-to-r from-indigo-50 to-blue-50 text-indigo-700 font-medium shadow-sm border border-indigo-100" 
                  : "hover:bg-slate-50/80 text-slate-700 hover:text-slate-900"
              )} 
              onClick={handleItemClick}
            >
              <Clock className="w-5 h-5 mr-3" />
              <span>{t('time_registrations')}</span>
            </NavLink>
          )}

          {currentEmployee?.role === 'admin' && (
            <NavLink 
              to={createLocalizedPath("/settings")} 
              className={({ isActive }) => cn(
                "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group",
                isActive 
                  ? "bg-gradient-to-r from-slate-50 to-gray-50 text-slate-700 font-medium shadow-sm border border-slate-200" 
                  : "hover:bg-slate-50/80 text-slate-700 hover:text-slate-900"
              )} 
              onClick={handleItemClick}
            >
              <Settings className="w-5 h-5 mr-3" />
              <span>{t('settings')}</span>
            </NavLink>
          )}
        </div>
        
        {/* Bottom Section - Always Visible */}
        <div className="mt-auto border-t border-slate-200/60 bg-gradient-to-r from-slate-50/50 to-blue-50/30">
          {/* Language Switcher */}
          <div className="flex justify-center items-center gap-2 p-4">
            <Button 
              size="sm" 
              variant={lang === 'nl' ? 'default' : 'ghost'} 
              className={cn(
                "text-sm font-medium transition-all duration-200",
                lang === 'nl' 
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
              )}
              onClick={() => changeLang('nl')}
            >
              NL
            </Button>
            <Button 
              size="sm" 
              variant={lang === 'en' ? 'default' : 'ghost'} 
              className={cn(
                "text-sm font-medium transition-all duration-200",
                lang === 'en' 
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
              )}
              onClick={() => changeLang('en')}
            >
              EN
            </Button>
            <Button 
              size="sm" 
              variant={lang === 'fr' ? 'default' : 'ghost'} 
              className={cn(
                "text-sm font-medium transition-all duration-200",
                lang === 'fr' 
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
              )}
              onClick={() => changeLang('fr')}
            >
              FR
            </Button>
          </div>

          {/* User Profile */}
          {currentEmployee && (
            <div className="flex items-center justify-between p-4 hover:bg-slate-100/60 transition-colors duration-200 rounded-lg mx-3 mb-2">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shadow-sm">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-slate-700">{currentEmployee.name}</span>
              </div>
              <UserMenu />
            </div>
          )}

          {/* Logout Button */}
          <div className="p-3">
            <button 
              onClick={() => {
                logout();
                handleItemClick();
              }} 
              className="flex w-full items-center px-4 py-3 rounded-xl hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 hover:text-red-600 hover:border hover:border-red-100 transition-all duration-200 group text-slate-600"
            >
              <LogOut className="w-5 h-5 mr-3" />
              <span className="font-medium">{t('logout')}</span>
            </button>
          </div>
        </div>
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
          <Button 
            variant="outline" 
            size="icon" 
            className="fixed top-4 left-4 z-50 bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="h-full w-64 mt-0 rounded-none border-r border-gray-200">
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
    <div className="w-64 bg-sidebar fixed top-0 bottom-0 z-40">
      <NavbarContent />
    </div>
  );
};

export default Navbar;
