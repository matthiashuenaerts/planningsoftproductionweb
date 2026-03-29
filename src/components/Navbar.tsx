import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Home, ListChecks, LayoutDashboard, Settings, Users, PackagePlus, Truck, LogOut, User, AlertTriangle, Menu, Clock, FileText, HelpCircle, Receipt, Wrench, X, ChevronRight, Globe } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { rushOrderService } from '@/services/rushOrderService';
import { useTenant } from '@/context/TenantContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerClose, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import UserMenu from './UserMenu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HelpDialog } from '@/components/help/HelpDialog';
import { supabase } from '@/integrations/supabase/client';
import { useRolePermissions } from '@/hooks/useRolePermissions';

const NavbarContent = ({
  onItemClick
}: {
  onItemClick?: () => void;
}) => {
  const {
    currentEmployee,
    logout,
    isDeveloper
  } = useAuth();
  const {
    t,
    lang,
    changeLang,
    createLocalizedPath
  } = useLanguage();
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const { tenant } = useTenant();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { canAccess } = useRolePermissions();
  const canSeeInvoices = currentEmployee && ['admin', 'manager'].includes(currentEmployee.role);

  const { data: isServiceMember } = useQuery({
    queryKey: ['isServiceTeamMember', currentEmployee?.id],
    queryFn: async () => {
      if (!currentEmployee) return false;
      const { data: memberships } = await supabase
        .from('placement_team_members' as any)
        .select('team_id')
        .eq('employee_id', currentEmployee.id);
      if (!memberships || memberships.length === 0) return false;
      const teamIds = (memberships as any[]).map((m: any) => m.team_id);
      const { data: serviceTeams } = await (supabase
        .from('placement_teams')
        .select('id') as any)
        .eq('team_type', 'service')
        .eq('is_active', true)
        .in('id', teamIds);
      return serviceTeams && serviceTeams.length > 0;
    },
    enabled: !!currentEmployee,
  });

  const {
    data: rushOrders,
  } = useQuery({
    queryKey: ['rushOrders', 'navbar', tenant?.id],
    queryFn: () => rushOrderService.getAllRushOrders(tenant?.id),
    enabled: !!canSeeRushOrders,
    refetchInterval: 30000
  });

  const pendingOrdersCount = rushOrders?.filter(order => order.status === 'pending').length || 0;
  const totalUnreadMessages = rushOrders?.reduce((total, order) => {
    return total + (order.unread_messages_count || 0);
  }, 0) || 0;

  const handleItemClick = () => {
    if (onItemClick) {
      onItemClick();
    }
  };

  const isActive = (path: string) => {
    const localizedPath = createLocalizedPath(path);
    return location.pathname === localizedPath || location.pathname === path;
  };

  const navLinkClass = (path: string) =>
    cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group",
      isActive(path)
        ? "bg-white/15 text-white shadow-sm backdrop-blur-sm"
        : "text-white/80 hover:bg-white/10 hover:text-white active:scale-[0.98]"
    );

  const langButtonClass = (l: string) =>
    cn(
      "text-xs font-semibold h-8 w-10 rounded-lg transition-all",
      lang === l
        ? "bg-white text-sky-800 shadow-sm hover:bg-white/90"
        : "text-white/70 hover:bg-white/10 hover:text-white"
    );

  return (
    <div className="h-full text-white flex flex-col bg-gradient-to-b from-[#1a6b96] to-[#144e6e]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
        {tenant?.logo_url && (
          <img src={tenant.logo_url} alt="Company Logo" className="w-9 h-9 rounded-lg object-contain bg-white/10 p-1" />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold truncate tracking-tight">{tenant?.name || t('company')}</h2>
          {currentEmployee && (
            <p className="text-[11px] text-white/50 truncate">{currentEmployee.name}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setHelpDialogOpen(true)}
          className="h-8 w-8 p-0 text-white/60 hover:text-white hover:bg-white/10 rounded-lg"
          title="Help"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable Menu Items */}
      <ScrollArea className="flex-1 px-2.5 py-2">
        <nav className="space-y-0.5 pb-2">
          <NavLink to={createLocalizedPath("/")} className={navLinkClass("/")} onClick={handleItemClick}>
            <Home className="w-[18px] h-[18px] shrink-0 opacity-80" />
            <span>{t('dashboard')}</span>
          </NavLink>

          {(isDeveloper || (currentEmployee && ['admin', 'manager', 'teamleader'].includes(currentEmployee.role))) && (
            <NavLink to={createLocalizedPath("/control-panel")} className={navLinkClass("/control-panel")} onClick={handleItemClick}>
              <LayoutDashboard className="w-[18px] h-[18px] shrink-0 opacity-80" />
              <span>{t('control_panel')}</span>
            </NavLink>
          )}

          <NavLink to={createLocalizedPath("/projects")} className={navLinkClass("/projects")} onClick={handleItemClick}>
            <LayoutDashboard className="w-[18px] h-[18px] shrink-0 opacity-80" />
            <span>{t('projects')}</span>
          </NavLink>

          <NavLink to={createLocalizedPath("/workstations")} className={navLinkClass("/workstations")} onClick={handleItemClick}>
            <Truck className="w-[18px] h-[18px] shrink-0 opacity-80" />
            <span>{t('workstations')}</span>
          </NavLink>

          <NavLink to={createLocalizedPath("/broken-parts")} className={navLinkClass("/broken-parts")} onClick={handleItemClick}>
            <AlertTriangle className="w-[18px] h-[18px] shrink-0 opacity-80" />
            <span>{t('broken_parts')}</span>
          </NavLink>

          <NavLink to={createLocalizedPath("/personal-tasks")} className={navLinkClass("/personal-tasks")} onClick={handleItemClick}>
            <ListChecks className="w-[18px] h-[18px] shrink-0 opacity-80" />
            <span>{t('personal_tasks')}</span>
          </NavLink>

          <NavLink to={createLocalizedPath("/notes-and-tasks")} className={navLinkClass("/notes-and-tasks")} onClick={handleItemClick}>
            <FileText className="w-[18px] h-[18px] shrink-0 opacity-80" />
            <span>{t('Tasks_Notes')}</span>
          </NavLink>

          {(isDeveloper || isServiceMember || (currentEmployee && ['admin', 'manager', 'teamleader'].includes(currentEmployee.role))) && (
            <NavLink to={createLocalizedPath("/service-installation")} className={navLinkClass("/service-installation")} onClick={handleItemClick}>
              <Wrench className="w-[18px] h-[18px] shrink-0 opacity-80" />
              <span>{t('service_installation')}</span>
            </NavLink>
          )}

          {(isDeveloper || (currentEmployee && ['admin', 'manager', 'installation_team', 'teamleader'].includes(currentEmployee.role))) && (
            <NavLink to={createLocalizedPath("/daily-tasks")} className={navLinkClass("/daily-tasks")} onClick={handleItemClick}>
              <ListChecks className="w-[18px] h-[18px] shrink-0 opacity-80" />
              <span>{t('installation_planning')}</span>
            </NavLink>
          )}

          {(isDeveloper || (currentEmployee && ['admin', 'manager', 'installation_team', 'teamleader'].includes(currentEmployee.role))) && (
            <NavLink to={createLocalizedPath("/planning")} className={navLinkClass("/planning")} onClick={handleItemClick}>
              <Users className="w-[18px] h-[18px] shrink-0 opacity-80" />
              <span>{t('planning')}</span>
            </NavLink>
          )}

          {(isDeveloper || (currentEmployee && ['admin', 'manager', 'installation_team', 'teamleader', 'preparater'].includes(currentEmployee.role))) && (
            <NavLink to={createLocalizedPath("/orders")} className={navLinkClass("/orders")} onClick={handleItemClick}>
              <PackagePlus className="w-[18px] h-[18px] shrink-0 opacity-80" />
              <span>{t('orders')}</span>
            </NavLink>
          )}

          {(isDeveloper || (currentEmployee && (currentEmployee.logistics || ['admin', 'manager', 'installation_team', 'teamleader', 'preparater'].includes(currentEmployee.role)))) && (
            <NavLink to={createLocalizedPath("/logistics")} className={navLinkClass("/logistics")} onClick={handleItemClick}>
              <Truck className="w-[18px] h-[18px] shrink-0 opacity-80" />
              <span>{t('logistics')}</span>
            </NavLink>
          )}

          {(isDeveloper || (currentEmployee && (currentEmployee.logistics || ['admin', 'manager', 'installation_team', 'teamleader', 'preparater'].includes(currentEmployee.role)))) && (
            <NavLink to={createLocalizedPath("/logistics-out")} className={navLinkClass("/logistics-out")} onClick={handleItemClick}>
              <Truck className="w-[18px] h-[18px] shrink-0 opacity-80" />
              <span>{t('logistics_out')}</span>
            </NavLink>
          )}

          {canSeeRushOrders && (
            <NavLink to={createLocalizedPath("/rush-orders")} className={navLinkClass("/rush-orders")} onClick={handleItemClick}>
              <PackagePlus className="w-[18px] h-[18px] shrink-0 opacity-80" />
              <span className="flex-1">{t('rush_orders')}</span>
              <div className="flex items-center gap-1">
                {pendingOrdersCount > 0 && (
                  <span className="bg-amber-400 text-amber-950 text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {pendingOrdersCount}
                  </span>
                )}
                {totalUnreadMessages > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {totalUnreadMessages}
                  </span>
                )}
              </div>
            </NavLink>
          )}

          {canSeeTimeRegistrations && (
            <NavLink to={createLocalizedPath("/time-registrations")} className={navLinkClass("/time-registrations")} onClick={handleItemClick}>
              <Clock className="w-[18px] h-[18px] shrink-0 opacity-80" />
              <span>{t('time_registrations')}</span>
            </NavLink>
          )}

          {canSeeInvoices && (
            <NavLink to={createLocalizedPath("/invoices")} className={navLinkClass("/invoices")} onClick={handleItemClick}>
              <Receipt className="w-[18px] h-[18px] shrink-0 opacity-80" />
              <span>{t('inv_invoices')}</span>
            </NavLink>
          )}

          {(isDeveloper || (currentEmployee && ['admin', 'manager', 'teamleader'].includes(currentEmployee.role))) && (
            <NavLink to={createLocalizedPath("/settings")} className={navLinkClass("/settings")} onClick={handleItemClick}>
              <Settings className="w-[18px] h-[18px] shrink-0 opacity-80" />
              <span>{t('settings')}</span>
            </NavLink>
          )}
        </nav>
      </ScrollArea>

      {/* Fixed Bottom Section */}
      <div className="mt-auto border-t border-white/10">
        {/* Language Switcher */}
        <div className="flex items-center justify-center gap-1 px-3 py-2.5">
          <Globe className="w-3.5 h-3.5 text-white/40 mr-1" />
          <Button size="sm" variant="ghost" className={langButtonClass('nl')} onClick={() => changeLang('nl')}>NL</Button>
          <Button size="sm" variant="ghost" className={langButtonClass('en')} onClick={() => changeLang('en')}>EN</Button>
          <Button size="sm" variant="ghost" className={langButtonClass('fr')} onClick={() => changeLang('fr')}>FR</Button>
        </div>

        {/* User & Logout */}
        {currentEmployee && (
          <div className="flex items-center gap-2 px-3 py-2 border-t border-white/10">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/15 shrink-0">
              <User className="w-4 h-4 text-white/80" />
            </div>
            <span className="flex-1 text-xs font-medium truncate text-white/80">{currentEmployee.name}</span>
            <UserMenu />
          </div>
        )}

        <button
          onClick={() => { logout(); handleItemClick(); }}
          className="flex w-full items-center gap-3 px-5 py-3 text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors border-t border-white/10"
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          <span>{t('logout')}</span>
        </button>
      </div>

      <HelpDialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen} />
    </div>
  );
};

const Navbar = () => {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (isMobile) {
    return (
      <Drawer direction="left" open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="fixed top-3 left-3 z-50 bg-[#1a6b96] border-0 text-white hover:bg-[#155a80] active:scale-95 h-11 w-11 rounded-2xl shadow-lg shadow-sky-900/30 transition-all"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="h-full w-[280px] mt-0 rounded-none border-r-0">
          <NavbarContent onItemClick={() => setDrawerOpen(false)} />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <div className="w-64 fixed top-0 bottom-0">
      <NavbarContent />
    </div>
  );
};

export default Navbar;
