
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
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white shadow-2xl border-r border-slate-700/50">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-700/50 bg-slate-800/50">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <LayoutDashboard className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {t('demo_account')}
            </h2>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 custom-scrollbar">
          <NavLink 
            to={createLocalizedPath("/")} 
            className={({ isActive }) => cn(
              "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group relative",
              isActive 
                ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 shadow-lg border border-blue-500/30" 
                : "hover:bg-slate-700/50 text-slate-300 hover:text-white"
            )} 
            onClick={handleItemClick}
          >
            <Home className="w-5 h-5 mr-3 transition-transform group-hover:scale-110" />
            <span className="font-medium">{t('dashboard')}</span>
          </NavLink>

          <NavLink 
            to={createLocalizedPath("/projects")} 
            className={({ isActive }) => cn(
              "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group relative",
              isActive 
                ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 shadow-lg border border-blue-500/30" 
                : "hover:bg-slate-700/50 text-slate-300 hover:text-white"
            )} 
            onClick={handleItemClick}
          >
            <LayoutDashboard className="w-5 h-5 mr-3 transition-transform group-hover:scale-110" />
            <span className="font-medium">{t('projects')}</span>
          </NavLink>

          <NavLink 
            to={createLocalizedPath("/workstations")} 
            className={({ isActive }) => cn(
              "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group relative",
              isActive 
                ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 shadow-lg border border-blue-500/30" 
                : "hover:bg-slate-700/50 text-slate-300 hover:text-white"
            )} 
            onClick={handleItemClick}
          >
            <Truck className="w-5 h-5 mr-3 transition-transform group-hover:scale-110" />
            <span className="font-medium">{t('workstations')}</span>
          </NavLink>

          <NavLink 
            to={createLocalizedPath("/broken-parts")} 
            className={({ isActive }) => cn(
              "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group relative",
              isActive 
                ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 shadow-lg border border-blue-500/30" 
                : "hover:bg-slate-700/50 text-slate-300 hover:text-white"
            )} 
            onClick={handleItemClick}
          >
            <AlertTriangle className="w-5 h-5 mr-3 transition-transform group-hover:scale-110" />
            <span className="font-medium">{t('broken_parts')}</span>
          </NavLink>

          <NavLink 
            to={createLocalizedPath("/personal-tasks")} 
            className={({ isActive }) => cn(
              "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group relative",
              isActive 
                ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 shadow-lg border border-blue-500/30" 
                : "hover:bg-slate-700/50 text-slate-300 hover:text-white"
            )} 
            onClick={handleItemClick}
          >
            <ListChecks className="w-5 h-5 mr-3 transition-transform group-hover:scale-110" />
            <span className="font-medium">{t('personal_tasks')}</span>
          </NavLink>

          <NavLink 
            to={createLocalizedPath("/daily-tasks")} 
            className={({ isActive }) => cn(
              "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group relative",
              isActive 
                ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 shadow-lg border border-blue-500/30" 
                : "hover:bg-slate-700/50 text-slate-300 hover:text-white"
            )} 
            onClick={handleItemClick}
          >
            <ListChecks className="w-5 h-5 mr-3 transition-transform group-hover:scale-110" />
            <span className="font-medium">{t('installation_planning')}</span>
          </NavLink>

          {currentEmployee && ['admin', 'manager', 'installation_team', 'teamleader'].includes(currentEmployee.role) && (
            <NavLink 
              to={createLocalizedPath("/planning")} 
              className={({ isActive }) => cn(
                "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group relative",
                isActive 
                  ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 shadow-lg border border-blue-500/30" 
                  : "hover:bg-slate-700/50 text-slate-300 hover:text-white"
              )} 
              onClick={handleItemClick}
            >
              <Users className="w-5 h-5 mr-3 transition-transform group-hover:scale-110" />
              <span className="font-medium">{t('planning')}</span>
            </NavLink>
          )}

          {currentEmployee && ['admin', 'manager', 'installation_team', 'teamleader', 'preparater'].includes(currentEmployee.role) && (
            <NavLink 
              to={createLocalizedPath("/orders")} 
              className={({ isActive }) => cn(
                "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group relative",
                isActive 
                  ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 shadow-lg border border-blue-500/30" 
                  : "hover:bg-slate-700/50 text-slate-300 hover:text-white"
              )} 
              onClick={handleItemClick}
            >
              <PackagePlus className="w-5 h-5 mr-3 transition-transform group-hover:scale-110" />
              <span className="font-medium">{t('orders')}</span>
            </NavLink>
          )}

          {currentEmployee && ['admin', 'manager', 'installation_team', 'teamleader', 'preparater'].includes(currentEmployee.role) && (
            <NavLink 
              to={createLocalizedPath("/logistics")} 
              className={({ isActive }) => cn(
                "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group relative",
                isActive 
                  ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 shadow-lg border border-blue-500/30" 
                  : "hover:bg-slate-700/50 text-slate-300 hover:text-white"
              )} 
              onClick={handleItemClick}
            >
              <Truck className="w-5 h-5 mr-3 transition-transform group-hover:scale-110" />
              <span className="font-medium">{t('logistics')}</span>
            </NavLink>
          )}

          {currentEmployee && ['admin', 'manager', 'installation_team', 'teamleader', 'preparater'].includes(currentEmployee.role) && (
            <NavLink 
              to={createLocalizedPath("/logistics-out")} 
              className={({ isActive }) => cn(
                "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group relative",
                isActive 
                  ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 shadow-lg border border-blue-500/30" 
                  : "hover:bg-slate-700/50 text-slate-300 hover:text-white"
              )} 
              onClick={handleItemClick}
            >
              <Truck className="w-5 h-5 mr-3 transition-transform group-hover:scale-110" />
              <span className="font-medium">{t('logistics_out')}</span>
            </NavLink>
          )}

          {canSeeRushOrders && (
            <NavLink 
              to={createLocalizedPath("/rush-orders")} 
              className={({ isActive }) => cn(
                "flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group relative",
                isActive 
                  ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 shadow-lg border border-blue-500/30" 
                  : "hover:bg-slate-700/50 text-slate-300 hover:text-white"
              )} 
              onClick={handleItemClick}
            >
              <div className="flex items-center">
                <PackagePlus className="w-5 h-5 mr-3 transition-transform group-hover:scale-110" />
                <span className="font-medium">{t('rush_orders')}</span>
              </div>
              <div className="flex items-center space-x-2">
                {pendingOrdersCount > 0 && (
                  <Badge variant="outline" className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0 font-medium text-xs px-2 py-1">
                    {pendingOrdersCount}
                  </Badge>
                )}
                {totalUnreadMessages > 0 && (
                  <Badge variant="outline" className="bg-gradient-to-r from-red-500 to-pink-500 text-white border-0 font-medium text-xs px-2 py-1">
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
                "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group relative",
                isActive 
                  ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 shadow-lg border border-blue-500/30" 
                  : "hover:bg-slate-700/50 text-slate-300 hover:text-white"
              )} 
              onClick={handleItemClick}
            >
              <Clock className="w-5 h-5 mr-3 transition-transform group-hover:scale-110" />
              <span className="font-medium">{t('time_registrations')}</span>
            </NavLink>
          )}

          {currentEmployee?.role === 'admin' && (
            <NavLink 
              to={createLocalizedPath("/settings")} 
              className={({ isActive }) => cn(
                "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group relative",
                isActive 
                  ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-300 shadow-lg border border-blue-500/30" 
                  : "hover:bg-slate-700/50 text-slate-300 hover:text-white"
              )} 
              onClick={handleItemClick}
            >
              <Settings className="w-5 h-5 mr-3 transition-transform group-hover:scale-110" />
              <span className="font-medium">{t('settings')}</span>
            </NavLink>
          )}
        </div>
        
        {/* Bottom Section - Always Visible */}
        <div className="mt-auto border-t border-slate-700/50 bg-slate-800/30 backdrop-blur-sm">
          {/* Language Switcher */}
          <div className="flex justify-center items-center gap-2 p-4">
            <Button 
              size="sm" 
              variant={lang === 'nl' ? 'default' : 'ghost'} 
              className={cn(
                "text-sm font-medium transition-all duration-200",
                lang === 'nl' 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-lg' 
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
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
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-lg' 
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
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
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-lg' 
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              )}
              onClick={() => changeLang('fr')}
            >
              FR
            </Button>
          </div>

          {/* User Profile */}
          {currentEmployee && (
            <div className="flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors duration-200 rounded-lg mx-3 mb-2">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-slate-200">{currentEmployee.name}</span>
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
              className="flex w-full items-center px-4 py-3 rounded-xl hover:bg-gradient-to-r hover:from-red-500/20 hover:to-pink-500/20 transition-all duration-200 group text-slate-300 hover:text-red-300 border border-transparent hover:border-red-500/30"
            >
              <LogOut className="w-5 h-5 mr-3 transition-transform group-hover:scale-110" />
              <span className="font-medium">{t('logout')}</span>
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(51, 65, 85, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.7);
        }
      `}</style>
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
            className="fixed top-4 left-4 z-50 bg-gradient-to-br from-slate-800 to-slate-900 border-slate-600 text-white hover:from-slate-700 hover:to-slate-800 shadow-lg"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="h-full w-64 mt-0 rounded-none border-r border-slate-700/50">
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
