
import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { rushOrderService } from '@/services/rushOrderService';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
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
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  Clock,
} from 'lucide-react';
import UserMenu from './UserMenu';

const AppSidebar = () => {
  const { currentEmployee, logout } = useAuth();
  const { t, lang, changeLang, createLocalizedPath } = useLanguage();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  // Role permissions
  const canSeeRushOrders = currentEmployee && ['admin', 'manager', 'installation_team', 'worker'].includes(currentEmployee.role);
  const canSeeTimeRegistrations = currentEmployee && ['admin', 'manager'].includes(currentEmployee.role);
  const canSeePlanning = currentEmployee && ['admin', 'manager', 'installation_team', 'teamleader'].includes(currentEmployee.role);
  const canSeeOrders = currentEmployee && ['admin', 'manager', 'installation_team', 'teamleader', 'preparater'].includes(currentEmployee.role);

  // Query rush orders for notifications
  const { data: rushOrders } = useQuery({
    queryKey: ['rushOrders', 'navbar'],
    queryFn: rushOrderService.getAllRushOrders,
    enabled: !!canSeeRushOrders,
    refetchInterval: 30000,
  });

  const pendingOrdersCount = rushOrders?.filter(order => order.status === 'pending').length || 0;
  const totalUnreadMessages = rushOrders?.reduce((total, order) => {
    return total + (order.unread_messages_count || 0);
  }, 0) || 0;

  // Main navigation items
  const mainNavItems = [
    {
      title: t('dashboard'),
      url: createLocalizedPath('/'),
      icon: Home,
    },
    {
      title: t('projects'),
      url: createLocalizedPath('/projects'),
      icon: LayoutDashboard,
    },
    {
      title: t('workstations'),
      url: createLocalizedPath('/workstations'),
      icon: Truck,
    },
    {
      title: t('broken_parts'),
      url: createLocalizedPath('/broken-parts'),
      icon: AlertTriangle,
    },
  ];

  // Task management items
  const taskNavItems = [
    {
      title: t('personal_tasks'),
      url: createLocalizedPath('/personal-tasks'),
      icon: ListChecks,
    },
    {
      title: t('installation_planning'),
      url: createLocalizedPath('/daily-tasks'),
      icon: ListChecks,
    },
  ];

  // Operations items (role-based)
  const operationsNavItems = [
    ...(canSeePlanning ? [{
      title: t('planning'),
      url: createLocalizedPath('/planning'),
      icon: Users,
    }] : []),
    ...(canSeeOrders ? [{
      title: t('orders'),
      url: createLocalizedPath('/orders'),
      icon: PackagePlus,
    }] : []),
    ...(canSeeOrders ? [{
      title: t('logistics'),
      url: createLocalizedPath('/logistics'),
      icon: Truck,
    }] : []),
    ...(canSeeOrders ? [{
      title: t('logistics_out'),
      url: createLocalizedPath('/logistics-out'),
      icon: Truck,
    }] : []),
    ...(canSeeRushOrders ? [{
      title: t('rush_orders'),
      url: createLocalizedPath('/rush-orders'),
      icon: PackagePlus,
      badges: [
        ...(pendingOrdersCount > 0 ? [{
          label: pendingOrdersCount.toString(),
          variant: 'outline' as const,
          className: 'bg-yellow-500 text-white border-0',
        }] : []),
        ...(totalUnreadMessages > 0 ? [{
          label: totalUnreadMessages.toString(),
          variant: 'outline' as const,
          className: 'bg-red-500 text-white border-0',
        }] : []),
      ],
    }] : []),
    ...(canSeeTimeRegistrations ? [{
      title: t('time_registrations'),
      url: createLocalizedPath('/time-registrations'),
      icon: Clock,
    }] : []),
  ];

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b px-3 py-4">
        <div className="flex items-center gap-2">
          {!isCollapsed && (
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-sidebar-foreground">
                {t('demo_account')}
              </h2>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="flex flex-col">
        <ScrollArea className="flex-1">
          <div className="space-y-4 p-2">
            {/* Main Navigation */}
            <SidebarGroup>
              <SidebarGroupLabel>{!isCollapsed && t('main')}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {mainNavItems.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild tooltip={item.title}>
                        <NavLink 
                          to={item.url}
                          className={({ isActive }) => cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                            isActive ? "bg-muted text-primary" : "text-muted-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {!isCollapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Task Management */}
            <SidebarGroup>
              <SidebarGroupLabel>{!isCollapsed && t('tasks')}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {taskNavItems.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild tooltip={item.title}>
                        <NavLink 
                          to={item.url}
                          className={({ isActive }) => cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                            isActive ? "bg-muted text-primary" : "text-muted-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {!isCollapsed && <span>{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Operations */}
            {operationsNavItems.length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel>{!isCollapsed && t('operations')}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {operationsNavItems.map((item) => (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild tooltip={item.title}>
                          <NavLink 
                            to={item.url}
                            className={({ isActive }) => cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                              isActive ? "bg-muted text-primary" : "text-muted-foreground"
                            )}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <item.icon className="h-4 w-4" />
                              {!isCollapsed && <span>{item.title}</span>}
                            </div>
                            {!isCollapsed && item.badges && item.badges.length > 0 && (
                              <div className="flex items-center gap-1">
                                {item.badges.map((badge, index) => (
                                  <Badge
                                    key={index}
                                    variant={badge.variant}
                                    className={cn("text-xs", badge.className)}
                                  >
                                    {badge.label}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {/* Settings (Admin only) */}
            {currentEmployee?.role === 'admin' && (
              <SidebarGroup>
                <SidebarGroupLabel>{!isCollapsed && t('administration')}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild tooltip={t('settings')}>
                        <NavLink 
                          to={createLocalizedPath('/settings')}
                          className={({ isActive }) => cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                            isActive ? "bg-muted text-primary" : "text-muted-foreground"
                          )}
                        >
                          <Settings className="h-4 w-4" />
                          {!isCollapsed && <span>{t('settings')}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </div>
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="border-t p-3">
        <div className="space-y-3">
          {/* Language Switcher */}
          {!isCollapsed && (
            <div className="flex justify-center items-center gap-1 p-2 border rounded-lg bg-muted/50">
              <Button 
                size="sm" 
                variant={lang === 'nl' ? 'default' : 'ghost'} 
                className="text-xs h-7 px-2"
                onClick={() => changeLang('nl')}
              >
                NL
              </Button>
              <Button 
                size="sm" 
                variant={lang === 'en' ? 'default' : 'ghost'} 
                className="text-xs h-7 px-2"
                onClick={() => changeLang('en')}
              >
                EN
              </Button>
              <Button 
                size="sm" 
                variant={lang === 'fr' ? 'default' : 'ghost'} 
                className="text-xs h-7 px-2"
                onClick={() => changeLang('fr')}
              >
                FR
              </Button>
            </div>
          )}

          {/* User Info */}
          {currentEmployee && (
            <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
              <User className="h-4 w-4 text-muted-foreground" />
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{currentEmployee.name}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground capitalize">{currentEmployee.role}</p>
                    <UserMenu />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Logout */}
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="w-full justify-start gap-3 text-muted-foreground hover:text-primary"
          >
            <LogOut className="h-4 w-4" />
            {!isCollapsed && <span>{t('logout')}</span>}
          </Button>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
};

export default AppSidebar;
