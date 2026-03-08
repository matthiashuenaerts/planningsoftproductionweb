import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Home, ListChecks, LayoutDashboard, Settings, Users, PackagePlus, Truck, LogOut, User, AlertTriangle, Menu, Clock, FileText, HelpCircle, Receipt, Wrench } from 'lucide-react';
import { NavLink } from 'react-router-dom';
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

  // Developers can see everything
  const canSeeRushOrders = isDeveloper || (currentEmployee && ['admin', 'manager', 'installation_team', 'worker', 'teamleader'].includes(currentEmployee.role));
  const canSeeTimeRegistrations = isDeveloper || (currentEmployee && ['admin', 'manager', 'teamleader'].includes(currentEmployee.role));
  const canSeeInvoices = currentEmployee && ['admin', 'manager'].includes(currentEmployee.role);

  // Check if employee is a member of any service team
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
  // Query rush orders to get counts for pending orders and unread messages
  const {
    data: rushOrders,
    isLoading
  } = useQuery({
    queryKey: ['rushOrders', 'navbar', tenant?.id],
    queryFn: () => rushOrderService.getAllRushOrders(tenant?.id),
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
  return <div className="h-full text-white flex flex-col bg-[#195f85]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 mb-0.5">
        <h2 className="text-xs font-semibold truncate">{tenant?.name || t('company')}</h2>
        {tenant?.logo_url && <img src={tenant.logo_url} alt="Company Logo" className="relative w-7 h-auto" />}
        <Button variant="ghost" size="sm" onClick={() => setHelpDialogOpen(true)} className="p-1 text-white hover:bg-sky-700 h-6 w-6" title="Help">
          <HelpCircle className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Scrollable Menu Items */}
      <ScrollArea className="flex-1 px-1.5">
        <ul className="space-y-0 font-medium pb-2">
          <li>
            <NavLink to={createLocalizedPath("/")} className="flex items-center px-2 py-1.5 rounded-md hover:bg-sky-700 active:bg-sky-600 group transition-colors" onClick={handleItemClick}>
              <Home className="w-4 h-4 text-white shrink-0" />
              <span className="ml-2 text-xs">{t('dashboard')}</span>
            </NavLink>
          </li>
          {(isDeveloper || (currentEmployee && ['admin', 'manager', 'teamleader'].includes(currentEmployee.role))) && (
            <li>
              <NavLink to={createLocalizedPath("/control-panel")} className="flex items-center px-2 py-1.5 rounded-md hover:bg-sky-700 active:bg-sky-600 group transition-colors" onClick={handleItemClick}>
                <LayoutDashboard className="w-4 h-4 text-white shrink-0" />
                <span className="ml-2 text-xs">{t('control_panel')}</span>
              </NavLink>
            </li>
          )}
          <li>
            <NavLink to={createLocalizedPath("/projects")} className="flex items-center px-2 py-1.5 rounded-md hover:bg-sky-700 active:bg-sky-600 group transition-colors" onClick={handleItemClick}>
              <LayoutDashboard className="w-4 h-4 text-white shrink-0" />
              <span className="ml-2 text-xs">{t('projects')}</span>
            </NavLink>
          </li>
          <li>
            <NavLink to={createLocalizedPath("/workstations")} className="flex items-center px-2 py-1.5 rounded-md hover:bg-sky-700 active:bg-sky-600 group transition-colors" onClick={handleItemClick}>
              <Truck className="w-4 h-4 text-white shrink-0" />
              <span className="ml-2 text-xs">{t('workstations')}</span>
            </NavLink>
          </li>
          <li>
            <NavLink to={createLocalizedPath("/broken-parts")} className="flex items-center px-2 py-1.5 rounded-md hover:bg-sky-700 active:bg-sky-600 group transition-colors" onClick={handleItemClick}>
              <AlertTriangle className="w-4 h-4 text-white shrink-0" />
              <span className="ml-2 text-xs">{t('broken_parts')}</span>
            </NavLink>
          </li>
          <li>
            <NavLink to={createLocalizedPath("/personal-tasks")} className="flex items-center px-2 py-1.5 rounded-md hover:bg-sky-700 active:bg-sky-600 group transition-colors" onClick={handleItemClick}>
              <ListChecks className="w-4 h-4 text-white shrink-0" />
              <span className="ml-2 text-xs">{t('personal_tasks')}</span>
            </NavLink>
          </li>
          <li>
            <NavLink to={createLocalizedPath("/notes-and-tasks")} className="flex items-center px-2 py-1.5 rounded-md hover:bg-sky-700 active:bg-sky-600 group transition-colors" onClick={handleItemClick}>
              <FileText className="w-4 h-4 text-white shrink-0" />
              <span className="ml-2 text-xs">{t('Tasks_Notes')}</span>
            </NavLink>
          </li>
          {(isDeveloper || isServiceMember || (currentEmployee && ['admin', 'teamleader'].includes(currentEmployee.role))) && <li>
              <NavLink to={createLocalizedPath("/service-installation")} className="flex items-center px-2 py-1.5 rounded-md hover:bg-sky-700 active:bg-sky-600 group transition-colors" onClick={handleItemClick}>
                <Wrench className="w-4 h-4 text-white shrink-0" />
                <span className="ml-2 text-xs">{t('service_installation')}</span>
              </NavLink>
            </li>}
          {(isDeveloper || (currentEmployee && ['admin', 'manager', 'installation_team', 'teamleader'].includes(currentEmployee.role))) && <li>
              <NavLink to={createLocalizedPath("/daily-tasks")} className="flex items-center px-2 py-1.5 rounded-md hover:bg-sky-700 active:bg-sky-600 group transition-colors" onClick={handleItemClick}>
                <ListChecks className="w-4 h-4 text-white shrink-0" />
                <span className="ml-2 text-xs">{t('installation_planning')}</span>
              </NavLink>
            </li>}
          {(isDeveloper || (currentEmployee && ['admin', 'manager', 'installation_team', 'teamleader'].includes(currentEmployee.role))) && <li>
              <NavLink to={createLocalizedPath("/planning")} className="flex items-center px-2 py-1.5 rounded-md hover:bg-sky-700 active:bg-sky-600 group transition-colors" onClick={handleItemClick}>
                <Users className="w-4 h-4 text-white shrink-0" />
                <span className="ml-2 text-xs">{t('planning')}</span>
              </NavLink>
            </li>}
          {(isDeveloper || (currentEmployee && ['admin', 'manager', 'installation_team', 'teamleader', 'preparater'].includes(currentEmployee.role))) && <li>
              <NavLink to={createLocalizedPath("/orders")} className="flex items-center px-2 py-1.5 rounded-md hover:bg-sky-700 active:bg-sky-600 group transition-colors" onClick={handleItemClick}>
                <PackagePlus className="w-4 h-4 text-white shrink-0" />
                <span className="ml-2 text-xs">{t('orders')}</span>
              </NavLink>
            </li>}
          {(isDeveloper || (currentEmployee && (currentEmployee.logistics || ['admin', 'manager', 'installation_team', 'teamleader', 'preparater'].includes(currentEmployee.role)))) && <li>
              <NavLink to={createLocalizedPath("/logistics")} className="flex items-center px-2 py-1.5 rounded-md hover:bg-sky-700 active:bg-sky-600 group transition-colors" onClick={handleItemClick}>
                <Truck className="w-4 h-4 text-white shrink-0" />
                <span className="ml-2 text-xs">{t('logistics')}</span>
              </NavLink>
            </li>}
          {(isDeveloper || (currentEmployee && (currentEmployee.logistics || ['admin', 'manager', 'installation_team', 'teamleader', 'preparater'].includes(currentEmployee.role)))) && <li>
              <NavLink to={createLocalizedPath("/logistics-out")} className="flex items-center px-2 py-1.5 rounded-md hover:bg-sky-700 active:bg-sky-600 group transition-colors" onClick={handleItemClick}>
                <Truck className="w-4 h-4 text-white shrink-0" />
                <span className="ml-2 text-xs">{t('logistics_out')}</span>
              </NavLink>
            </li>}
          {canSeeRushOrders && <li>
              <NavLink to={createLocalizedPath("/rush-orders")} className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-sky-700 active:bg-sky-600 group transition-colors" onClick={handleItemClick}>
                <div className="flex items-center">
                  <PackagePlus className="w-4 h-4 text-white shrink-0" />
                  <span className="ml-2 text-xs">{t('rush_orders')}</span>
                </div>
                <div className="flex items-center space-x-1">
                  {pendingOrdersCount > 0 && <Badge variant="outline" className="bg-yellow-500 text-white border-0 font-medium text-[9px] px-1 h-4 min-w-4 flex items-center justify-center">
                      {pendingOrdersCount}
                    </Badge>}
                  {totalUnreadMessages > 0 && <Badge variant="outline" className="bg-red-500 text-white border-0 font-medium text-[9px] px-1 h-4 min-w-4 flex items-center justify-center">
                      {totalUnreadMessages}
                    </Badge>}
                </div>
              </NavLink>
            </li>}
          {canSeeTimeRegistrations && <li>
              <NavLink to={createLocalizedPath("/time-registrations")} className="flex items-center px-2 py-1.5 rounded-md hover:bg-sky-700 active:bg-sky-600 group transition-colors" onClick={handleItemClick}>
                <Clock className="w-4 h-4 text-white shrink-0" />
                <span className="ml-2 text-xs">{t('time_registrations')}</span>
              </NavLink>
            </li>}
          {canSeeInvoices && <li>
              <NavLink to={createLocalizedPath("/invoices")} className="flex items-center px-2 py-1.5 rounded-md hover:bg-sky-700 active:bg-sky-600 group transition-colors" onClick={handleItemClick}>
                <Receipt className="w-4 h-4 text-white shrink-0" />
                <span className="ml-2 text-xs">{t('inv_invoices')}</span>
              </NavLink>
            </li>}
          {(isDeveloper || (currentEmployee && ['admin', 'teamleader'].includes(currentEmployee.role))) && <li>
              <NavLink to={createLocalizedPath("/settings")} className="flex items-center px-2 py-1.5 rounded-md hover:bg-sky-700 active:bg-sky-600 group transition-colors" onClick={handleItemClick}>
                <Settings className="w-4 h-4 text-white shrink-0" />
                <span className="ml-2 text-xs">{t('settings')}</span>
              </NavLink>
            </li>}
        </ul>
      </ScrollArea>
        
      {/* Fixed Bottom Section */}
      <div className="mt-auto px-1.5 pb-2">
        <div className="flex justify-center items-center gap-1 mb-1 py-1 border-t border-b border-blue-600">
          <Button size="sm" variant={lang === 'nl' ? 'default' : 'ghost'} className={cn("text-[10px] font-medium h-5 px-2", lang === 'nl' ? 'bg-white text-sky-800 hover:bg-gray-100' : 'text-white hover:bg-sky-700 hover:text-white')} onClick={() => changeLang('nl')}>
            NL
          </Button>
          <Button size="sm" variant={lang === 'en' ? 'default' : 'ghost'} className={cn("text-[10px] font-medium h-5 px-2", lang === 'en' ? 'bg-white text-sky-800 hover:bg-gray-100' : 'text-white hover:bg-sky-700 hover:text-white')} onClick={() => changeLang('en')}>
            EN
          </Button>
          <Button size="sm" variant={lang === 'fr' ? 'default' : 'ghost'} className={cn("text-[10px] font-medium h-5 px-2", lang === 'fr' ? 'bg-white text-sky-800 hover:bg-gray-100' : 'text-white hover:bg-sky-700 hover:text-white')} onClick={() => changeLang('fr')}>
            FR
          </Button>
        </div>
        {currentEmployee && <div className="flex items-center justify-between px-2 py-1 mb-0.5">
            <div className="flex items-center min-w-0">
              <User className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="ml-1.5 text-[10px] truncate">{currentEmployee.name}</span>
            </div>
            <UserMenu />
          </div>}
        <button onClick={() => {
        logout();
        handleItemClick();
      }} className="flex w-full items-center px-2 py-1.5 rounded-md hover:bg-sky-700 active:bg-sky-600 group text-white transition-colors">
          <LogOut className="w-4 h-4 text-white shrink-0" />
          <span className="ml-2 text-xs">{t('logout')}</span>
        </button>
      </div>

      {/* Help Dialog */}
      <HelpDialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen} />
    </div>;
};
const Navbar = () => {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (isMobile) {
    return <Drawer direction="left" open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger asChild>
          <Button variant="outline" size="icon" className="fixed top-3 left-3 z-50 bg-sky-800 border-sky-600 text-white hover:bg-sky-700 active:bg-sky-600 h-10 w-10 rounded-xl shadow-lg">
            <Menu className="h-5 w-5" />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="h-full w-[280px] mt-0 rounded-none">
          <NavbarContent onItemClick={() => setDrawerOpen(false)} />
        </DrawerContent>
      </Drawer>;
  }
  return <div className="w-64 bg-sidebar fixed top-0 bottom-0">
      <NavbarContent />
    </div>;
};
export default Navbar;
