
import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { notificationService, Notification } from '@/services/notificationService';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { X, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const NotificationBanner = () => {
  const { currentEmployee } = useAuth();
  const { createLocalizedPath } = useLanguage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [latestUnread, setLatestUnread] = useState<Notification | null>(null);

  const { data: notifications, isSuccess } = useQuery({
    queryKey: ['notifications', currentEmployee?.id],
    queryFn: () => notificationService.getUserNotifications(currentEmployee!.id),
    enabled: !!currentEmployee,
    refetchInterval: 15000
  });

  useEffect(() => {
    console.log('NotificationBanner: notifications update', { isSuccess, notifications, currentEmployee: currentEmployee?.id });
    
    if (isSuccess && notifications) {
      const unread = notifications.filter(n => !n.read);
      console.log('NotificationBanner: unread notifications', unread);
      
      if (unread.length > 0) {
        const latest = unread.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        // Only update if it's a new notification
        if (latest.id !== latestUnread?.id) {
          console.log('NotificationBanner: setting latest unread', latest);
          setLatestUnread(latest);
        }
      } else {
        console.log('NotificationBanner: no unread notifications, hiding banner');
        setLatestUnread(null);
      }
    }
  }, [notifications, isSuccess, latestUnread?.id]);

  const handleClose = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (latestUnread) {
      console.log('NotificationBanner: closing notification', latestUnread.id);
      await notificationService.markAsRead(latestUnread.id);
      const currentLatestId = latestUnread.id;
      setLatestUnread(null); // Hide immediately
      queryClient.setQueryData(['notifications', currentEmployee?.id], (oldData: Notification[] | undefined) => {
        return oldData ? oldData.map(n => n.id === currentLatestId ? {
          ...n,
          read: true
        } : n) : [];
      });
      // To ensure dropdown is also updated
      queryClient.invalidateQueries({
        queryKey: ['notifications']
      });
    }
  };

  const handleClick = () => {
    console.log('NotificationBanner: clicked, navigating to', latestUnread?.rush_order_id);
    if (latestUnread) {
      if (latestUnread.rush_order_id) {
        navigate(createLocalizedPath(`/rush-orders/${latestUnread.rush_order_id}`));
      }
      handleClose();
    }
  };

  console.log('NotificationBanner: render state', { latestUnread: !!latestUnread, currentEmployee: !!currentEmployee });

  if (!latestUnread) {
    return null;
  }

  return (
    <Alert className="fixed bottom-4 right-4 w-auto max-w-sm z-[9999] bg-primary text-primary-foreground shadow-2xl cursor-pointer animate-in fade-in-0 slide-in-from-bottom-5 border-2 border-primary-foreground/20" onClick={handleClick}>
      <Bell className="h-4 w-4 text-primary-foreground" />
      <AlertTitle className="text-primary-foreground font-bold">New Notification!</AlertTitle>
      <AlertDescription className="text-primary-foreground/90">
        {latestUnread.message}
      </AlertDescription>
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={handleClose} 
        className="absolute top-1 right-1 h-6 w-6 text-primary-foreground hover:bg-primary-foreground/20 p-0 mx-[5px] text-base"
      >
        <X className="h-4 w-4" />
      </Button>
    </Alert>
  );
};

export default NotificationBanner;
