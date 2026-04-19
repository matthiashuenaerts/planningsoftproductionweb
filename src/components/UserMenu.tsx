import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { MoreVertical, CalendarDays, Plus, Users, Calendar, LifeBuoy, Bell, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { holidayRequestService } from '@/services/holidayRequestService';
import HolidayRequestDialog from './HolidayRequestDialog';
import HolidayRequestsList from './HolidayRequestsList';
import { useLanguage } from '@/context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import SupportDialog from './support/SupportDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { notificationService, Notification } from '@/services/notificationService';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQueryClient } from '@tanstack/react-query';

interface UserMenuProps {
  unreadCount?: number;
}

const UserMenu: React.FC<UserMenuProps> = ({ unreadCount: unreadCountProp = 0 }) => {
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showSupportDialog, setShowSupportDialog] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const { currentEmployee } = useAuth();
  const { createLocalizedPath, t } = useLanguage();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const canManageRequests = currentEmployee?.role === 'admin' || 
                           currentEmployee?.role === 'teamleader' || 
                           currentEmployee?.role === 'manager';

  const canViewGeneralSchedule = currentEmployee?.role === 'admin' || 
                                currentEmployee?.role === 'teamleader' || 
                                currentEmployee?.role === 'manager';

  const fetchNotifications = useCallback(async () => {
    if (!currentEmployee) {
      setNotifications([]);
      return;
    }

    setNotificationsLoading(true);
    try {
      const data = await notificationService.getUserNotifications(currentEmployee.id);
      setNotifications(data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setNotificationsLoading(false);
    }
  }, [currentEmployee]);

  useEffect(() => {
    const fetchPendingCount = async () => {
      if (!canManageRequests) return;

      try {
        const allRequests = await holidayRequestService.getAllRequests();
        const pending = allRequests.filter(request => request.status === 'pending');
        setPendingCount(pending.length);
      } catch (error) {
        console.error('Error fetching pending requests count:', error);
      }
    };

    if (canManageRequests) {
      fetchPendingCount();
    }
  }, [canManageRequests]);

  useEffect(() => {
    if (!currentEmployee) return;

    void fetchNotifications();
    const intervalId = window.setInterval(fetchNotifications, 15000);
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void fetchNotifications();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentEmployee, fetchNotifications]);

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.read),
    [notifications],
  );

  const displayUnreadCount = Math.max(unreadCountProp, unreadNotifications.length);

  const openHolidayModal = () => {
    setDropdownOpen(false);
    setTimeout(() => setShowHolidayModal(true), 0);
  };

  const openAdminModal = () => {
    setDropdownOpen(false);
    setTimeout(() => setShowAdminModal(true), 0);
  };

  const openSupportDialog = () => {
    setDropdownOpen(false);
    setTimeout(() => setShowSupportDialog(true), 0);
  };

  const handleNavigate = (path: string) => {
    setDropdownOpen(false);
    navigate(path);
  };

  const handleNotificationSelect = (notification: Notification) => {
    if (!currentEmployee) return;

    setDropdownOpen(false);
    setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    queryClient.setQueryData(['notifications', currentEmployee.id], (oldData: Notification[] | undefined) => {
      return oldData ? oldData.filter((n) => n.id !== notification.id) : [];
    });
    queryClient.invalidateQueries({ queryKey: ['notifications-unread-count', 'navbar', currentEmployee.id] });

    if (notification.rush_order_id) {
      navigate(createLocalizedPath(`/rush-orders/${notification.rush_order_id}`));
    } else if (notification.link) {
      navigate(createLocalizedPath(notification.link));
    } else {
      navigate(createLocalizedPath('/notes-and-tasks'));
    }

    void notificationService.deleteNotification(notification.id).finally(() => {
      queryClient.invalidateQueries({ queryKey: ['notifications', currentEmployee.id] });
    });
  };

  const getTimeString = (timestamp: string) => {
    const date = parseISO(timestamp);
    const now = new Date();

    if (date.toDateString() === now.toDateString()) {
      return formatDistanceToNow(date, { addSuffix: true });
    }

    return format(date, 'MMM d, HH:mm');
  };

  const dialogClass = isMobile
    ? 'max-w-[calc(100vw-1.5rem)] w-[calc(100vw-1.5rem)] p-4 max-h-[90vh] overflow-y-auto'
    : 'max-w-4xl max-h-[90vh] overflow-y-auto';

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={(open) => {
        setDropdownOpen(open);
        if (open) void fetchNotifications();
      }}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative text-white hover:bg-sky-700">
            <MoreVertical className="h-4 w-4" />
            {displayUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {displayUnreadCount > 9 ? '9+' : displayUnreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[380px] max-w-[calc(100vw-1rem)] p-0">
          <div className="px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Unread notifications</span>
              </div>
              {displayUnreadCount > 0 && <Badge variant="secondary">{displayUnreadCount}</Badge>}
            </div>
          </div>

          <DropdownMenuSeparator />

          <ScrollArea className="max-h-[260px]">
            <div className="p-1">
              {notificationsLoading ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">Loading notifications...</div>
              ) : unreadNotifications.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">No unread notifications</div>
              ) : (
                unreadNotifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleNotificationSelect(notification)}
                    className="w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-accent"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug line-clamp-2">{notification.message}</p>
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <span>{getTimeString(notification.created_at)}</span>
                          <ChevronRight className="h-3 w-3" />
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">Menu</DropdownMenuLabel>
          <div className="p-1">
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openHolidayModal(); }}>
              <CalendarDays className="mr-2 h-4 w-4" />
              {t('holiday')}
            </DropdownMenuItem>
            {canViewGeneralSchedule && (
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleNavigate(createLocalizedPath('/general-schedule')); }}>
                <Calendar className="mr-2 h-4 w-4" />
                {t('general_schedule')}
              </DropdownMenuItem>
            )}
            {canManageRequests && (
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openAdminModal(); }}>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center">
                    <Users className="mr-2 h-4 w-4" />
                    {t('manage_requests')}
                  </div>
                  {pendingCount > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                      {pendingCount}
                    </Badge>
                  )}
                </div>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openSupportDialog(); }}>
              <LifeBuoy className="mr-2 h-4 w-4" />
              Support
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showHolidayModal} onOpenChange={setShowHolidayModal}>
        <DialogContent className={dialogClass}>
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${isMobile ? 'text-base' : ''}`}>
              <CalendarDays className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
              {t('holiday_requests')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              View your holiday requests and create a new one.
            </DialogDescription>
          </DialogHeader>

          <div className={`space-y-${isMobile ? '4' : '6'}`}>
            <HolidayRequestsList showAllRequests={false} />

            <div className={`flex justify-center ${isMobile ? 'pt-3 border-t border-border' : 'pt-4 border-t'}`}>
              <HolidayRequestDialog>
                <Button className={`flex items-center gap-2 ${isMobile ? 'w-full h-10 text-sm' : ''}`}>
                  <Plus className="h-4 w-4" />
                  {t('add_new_holiday_request')}
                </Button>
              </HolidayRequestDialog>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {canManageRequests && (
        <Dialog open={showAdminModal} onOpenChange={setShowAdminModal}>
          <DialogContent className={dialogClass}>
            <DialogHeader>
              <DialogTitle className={`flex items-center gap-2 ${isMobile ? 'text-base' : ''}`}>
                <Users className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
                {t('manage_requests')}
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {t('pending_count', { count: pendingCount.toString() })}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Manage all employee holiday requests.
              </DialogDescription>
            </DialogHeader>

            <div className={`space-y-${isMobile ? '4' : '6'}`}>
              <HolidayRequestsList showAllRequests={true} />
            </div>
          </DialogContent>
        </Dialog>
      )}

      <SupportDialog open={showSupportDialog} onOpenChange={setShowSupportDialog} />
    </>
  );
};

export default UserMenu;
