
import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  Home, 
  ListChecks, 
  LayoutDashboard, 
  Settings, 
  Users, 
  PackagePlus, 
  Truck, 
  LogOut, 
  User, 
  AlertTriangle, 
  Clock 
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { rushOrderService } from '@/services/rushOrderService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/LanguageContext';
import { cn } from '@/lib/utils';
import UserMenu from './UserMenu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
  useSidebar,
} from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';

export function AppSidebar() {
  const { currentEmployee, logout } = useAuth();
  const { t, lang, changeLang, createLocalizedPath } = useLanguage();
  const { state } = useSidebar();

  // Allow admin, manager, installation_team, and worker roles to see the Rush Orders menu
  const canSeeRushOrders = currentEmployee && ['admin', 'manager', 'installation_team', 'worker'].includes(currentEmployee.role);

  // Allow admin and manager to see time registrations
  const canSeeTimeRegistrations = currentEmployee && ['admin', 'manager'].includes(currentEmployee.role);

  // Query rush orders to get counts for pending orders and unread messages
  const { data: rushOrders } = useQuery({
    queryKey: ['rushOrders', 'navbar'],
    queryFn: rushOrderService.getAllRushOrders,
    enabled: !!canSeeRushOrders,
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  // Calculate counts
  const pendingOrdersCount = rushOrders?.filter(order => order.status === 'pending').length || 0;
  const totalUnreadMessages = rushOrders?.reduce((total, order) => {
    return total + (order.unread_messages_count || 0);
  }, 0) || 0;

  const navigationItems = [
    {
      title: t('dashboard'),
      url: createLocalizedPath("/"),
      icon: Home,
    },
    {
      title: t('projects'),
      url: createLocalizedPath("/projects"),
      icon: LayoutDashboard,
    },
    {
      title: t('workstations'),
      url: createLocalizedPath("/workstations"),
      icon: Truck,
    },
    {
      title: t('broken_parts'),
      url: createLocalizedPath("/broken-parts"),
      icon: AlertTriangle,
    },
    {
      title: t('personal_tasks'),
      url: createLocalizedPath("/personal-tasks"),
      icon: ListChecks,
    },
    {
      title: t('installation_planning'),
      url: createLocalizedPath("/daily-tasks"),
      icon: ListChecks,
    },
  ];

  const adminItems = [
    ...(currentEmployee && ['admin', 'manager', 'installation_team', 'teamleader'].includes(currentEmployee.role) ? [{
      title: t('planning'),
      url: createLocalizedPath("/planning"),
      icon: Users,
    }] : []),
    ...(currentEmployee && ['admin', 'manager', 'installation_team', 'teamleader', 'preparater'].includes(currentEmployee.role) ? [
      {
        title: t('orders'),
        url: createLocalizedPath("/orders"),
        icon: PackagePlus,
      },
      {
        title: t('logistics'),
        url: createLocalizedPath("/logistics"),
        icon: Truck,
      },
      {
        title: t('logistics_out'),
        url: createLocalizedPath("/logistics-out"),
        icon: Truck,
      }
    ] : []),
    ...(canSeeRushOrders ? [{
      title: t('rush_orders'),
      url: createLocalizedPath("/rush-orders"),
      icon: PackagePlus,
      badges: [
        ...(pendingOrdersCount > 0 ? [{ count: pendingOrdersCount, variant: 'outline' as const, className: 'bg-yellow-500 text-white border-0' }] : []),
        ...(totalUnreadMessages > 0 ? [{ count: totalUnreadMessages, variant: 'outline' as const, className: 'bg-red-500 text-white border-0' }] : [])
      ]
    }] : []),
    ...(canSeeTimeRegistrations ? [{
      title: t('time_registrations'),
      url: createLocalizedPath("/time-registrations"),
      icon: Clock,
    }] : []),
    ...(currentEmployee?.role === 'admin' ? [{
      title: t('settings'),
      url: createLocalizedPath("/settings"),
      icon: Settings,
    }] : []),
  ];

  return (
    <Sidebar className="border-r border-sky-600 bg-sky-800 text-white">
      <SidebarHeader className="border-b border-sky-600 p-4">
        <div className="flex items-center justify-center">
          <h2 className={cn(
            "font-semibold text-white transition-all duration-200",
            state === "collapsed" ? "text-sm" : "text-lg"
          )}>
            {state === "collapsed" ? "Demo" : t('demo_account')}
          </h2>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex-1">
        <ScrollArea className="flex-1 px-2">
          <SidebarGroup>
            <SidebarGroupLabel className="text-sky-200 font-medium">
              {state === "collapsed" ? "" : "Navigation"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigationItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      className="hover:bg-sky-700 text-white hover:text-white data-[active=true]:bg-sky-600 data-[active=true]:text-white"
                    >
                      <NavLink to={item.url} className="flex items-center gap-3">
                        <item.icon className="h-5 w-5" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {adminItems.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel className="text-sky-200 font-medium">
                {state === "collapsed" ? "" : "Management"}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className="hover:bg-sky-700 text-white hover:text-white data-[active=true]:bg-sky-600 data-[active=true]:text-white"
                      >
                        <NavLink to={item.url} className="flex items-center gap-3">
                          <item.icon className="h-5 w-5" />
                          <span>{item.title}</span>
                          {item.badges && item.badges.map((badge, index) => (
                            <SidebarMenuBadge key={index} className={badge.className}>
                              {badge.count}
                            </SidebarMenuBadge>
                          ))}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="border-t border-sky-600 p-2 space-y-2">
        {/* Language Switcher - Always visible */}
        <div className="flex justify-center items-center gap-1 p-2">
          <Button 
            size="sm" 
            variant={lang === 'nl' ? 'default' : 'ghost'} 
            className={cn(
              "text-xs font-medium",
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
              "text-xs font-medium",
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
              "text-xs font-medium",
              lang === 'fr' 
                ? 'bg-white text-sky-800 hover:bg-gray-100' 
                : 'text-white hover:bg-sky-700 hover:text-white'
            )}
            onClick={() => changeLang('fr')}
          >
            FR
          </Button>
        </div>

        {/* User Info - Always visible */}
        {currentEmployee && (
          <div className="flex items-center justify-between p-2">
            <div className="flex items-center gap-2 min-w-0">
              <User className="h-4 w-4 text-white flex-shrink-0" />
              {state !== "collapsed" && (
                <span className="text-sm text-white truncate">{currentEmployee.name}</span>
              )}
            </div>
            <UserMenu />
          </div>
        )}

        {/* Logout Button - Always visible */}
        <Button
          onClick={logout}
          variant="ghost"
          className="w-full justify-start text-white hover:bg-sky-700 hover:text-white p-2"
        >
          <LogOut className="h-4 w-4" />
          {state !== "collapsed" && <span className="ml-2">{t('logout')}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
