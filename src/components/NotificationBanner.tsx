
import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { notificationService, Notification } from '@/services/notificationService';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { X, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';

const NotificationBanner = () => {
  const { currentEmployee } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { createLocalizedPath, t } = useLanguage();
  const [latestUnread, setLatestUnread] = useState<Notification | null>(null);

  const { data: notifications, isSuccess } = useQuery({
    queryKey: ['notifications', currentEmployee?.id],
    queryFn: () => notificationService.getUserNotifications(currentEmployee!.id),
    enabled: !!currentEmployee,
    refetchInterval: 15000
  });

  useEffect(() => {
    if (isSuccess && notifications) {
      const unread = notifications.filter(n => !n.read);
      if (unread.length > 0) {
        const latest = unread.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        // Only update if it's a new notification
        if (latest.id !== latestUnread?.id) {
          setLatestUnread(latest);
        }
      } else {
        setLatestUnread(null);
      }
    }
  }, [notifications, isSuccess, latestUnread?.id]);

  const handleClose = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (latestUnread) {
      await notificationService.markAsRead(latestUnread.id);
      const currentLatestId = latestUnread.id;
      setLatestUnread(null); // Hide immediately
      queryClient.setQueryData(['notifications', currentEmployee?.id], (oldData: Notification[] | undefined) => {
        return oldData ? oldData.map(n => n.id === currentLatestId ? { ...n, read: true } : n) : [];
      });
      // To ensure dropdown is also updated
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  };

  const handleClick = () => {
    if (latestUnread) {
      if (latestUnread.rush_order_id) {
        navigate(createLocalizedPath(`/rush-orders/${latestUnread.rush_order_id}`));
      } else if (latestUnread.link) {
        navigate(createLocalizedPath(latestUnread.link));
      }
      handleClose();
    }
  };

  if (!latestUnread) {
    return null;
  }

  return (
    <Alert className="fixed top-4 right-4 w-auto max-w-sm z-50 bg-primary text-primary-foreground shadow-xl cursor-pointer animate-in fade-in-0 slide-in-from-top-5" onClick={handleClick}>
      <Bell className="h-4 w-4 text-primary-foreground" />
      <AlertTitle>{t('new_notification')}</AlertTitle>
      <AlertDescription>
        {latestUnread.message}
      </AlertDescription>
      <Button variant="ghost" size="icon" onClick={handleClose} className="absolute top-1 right-1 h-6 w-6 text-primary-foreground hover:bg-black/20 p-0 mx-[5px] text-base text-left">
        <X className="h-4 w-4" />
      </Button>
    </Alert>
  );
};

export default NotificationBanner;
