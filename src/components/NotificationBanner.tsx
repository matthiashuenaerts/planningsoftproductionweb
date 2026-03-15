
import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { notificationService, Notification } from '@/services/notificationService';
import { X, Bell, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useNativeNotifications } from '@/hooks/useNativeNotifications';



const NotificationBanner = () => {
  const { currentEmployee } = useAuth();
  const { createLocalizedPath } = useLanguage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [latestUnread, setLatestUnread] = useState<Notification | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const { showNotification } = useNativeNotifications();

  const { data: notifications, isSuccess } = useQuery({
    queryKey: ['notifications', currentEmployee?.id],
    queryFn: () => notificationService.getUserNotifications(currentEmployee!.id),
    enabled: !!currentEmployee,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        queryClient.invalidateQueries({ queryKey: ['notifications', currentEmployee?.id] });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [currentEmployee?.id, queryClient]);

  useEffect(() => {
    if (isSuccess && notifications) {
      const unread = notifications.filter(n => !n.read);
      if (unread.length > 0) {
        const latest = unread.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        if (latest.id !== latestUnread?.id) {
          setLatestUnread(latest);
          setIsExiting(false);
          setProgress(100);
          showNotification('AutoMattiOn Compass', latest.message);
        }
      } else {
        setLatestUnread(null);
      }
    }
  }, [notifications, isSuccess, latestUnread?.id, showNotification]);

  // Auto-dismiss with progress bar
  useEffect(() => {
    if (!latestUnread) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        const next = prev - (100 / (AUTO_DISMISS_MS / 50));
        if (next <= 0) {
          clearInterval(interval);
          triggerClose();
          return 0;
        }
        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [latestUnread?.id]);

  const triggerClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      if (latestUnread) {
        notificationService.markAsRead(latestUnread.id);
        const currentLatestId = latestUnread.id;
        setLatestUnread(null);
        setIsExiting(false);
        queryClient.setQueryData(['notifications', currentEmployee?.id], (oldData: Notification[] | undefined) => {
          return oldData ? oldData.map(n => n.id === currentLatestId ? { ...n, read: true } : n) : [];
        });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }
    }, 300);
  }, [latestUnread, currentEmployee?.id, queryClient]);

  const handleClose = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    triggerClose();
  };

  const handleClick = () => {
    if (latestUnread) {
      if (latestUnread.rush_order_id) {
        navigate(createLocalizedPath(`/rush-orders/${latestUnread.rush_order_id}`));
      } else if (latestUnread.link) {
        navigate(createLocalizedPath(latestUnread.link));
      } else {
        navigate(createLocalizedPath('/notes-and-tasks'));
      }
      handleClose();
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (!latestUnread) return null;

  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  return (
    <div
      className={`fixed z-50 cursor-pointer
        top-4 right-4 w-[360px] max-w-[calc(100vw-2rem)]
        max-[767px]:top-auto max-[767px]:bottom-4 max-[767px]:left-4 max-[767px]:right-4 max-[767px]:w-auto
        ${isExiting ? 'animate-out fade-out-0 slide-out-to-right-5 max-[767px]:slide-out-to-bottom-5 duration-300' : 'animate-in fade-in-0 slide-in-from-right-5 max-[767px]:slide-in-from-bottom-5 duration-500'}
      `}
      onClick={handleClick}
      role="alert"
    >
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-card shadow-2xl shadow-primary/10 backdrop-blur-sm">
        {/* Progress bar */}
        <div className="absolute top-0 left-0 h-[3px] w-full bg-muted/30">
          <div
            className="h-full bg-primary transition-all duration-50 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-4 pt-5">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
              <Bell className="h-5 w-5 text-primary animate-in zoom-in-50 duration-500" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                  New Notification
                </p>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {getTimeAgo(latestUnread.created_at)}
                </span>
              </div>
              <p className="text-sm text-foreground leading-snug line-clamp-2">
                {latestUnread.message}
              </p>
              {unreadCount > 1 && (
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                    {unreadCount}
                  </span>
                  <span>unread notifications</span>
                  <ChevronRight className="h-3 w-3" />
                </div>
              )}
            </div>

            {/* Close */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="flex-shrink-0 h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationBanner;
