
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
    if (isSuccess && notifications) {
      console.log('Notifications received:', notifications.length, 'total');
      const unread = notifications.filter(n => !n.read);
      console.log('Unread notifications:', unread.length);
      
      if (unread.length > 0) {
        const latest = unread.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        // Only update if it's a new notification
        if (latest.id !== latestUnread?.id) {
          console.log('Setting new notification banner:', latest.message);
          setLatestUnread(latest);
        }
      } else {
        if (latestUnread) {
          console.log('Clearing notification banner - no unread notifications');
        }
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
    if (latestUnread) {
      if (latestUnread.rush_order_id) {
        navigate(createLocalizedPath(`/rush-orders/${latestUnread.rush_order_id}`));
      }
      handleClose();
    }
  };

  if (!latestUnread) {
    return null;
  }

  console.log('Rendering notification banner:', latestUnread.message);

  return (
    <Alert className="fixed bottom-6 right-6 w-auto max-w-sm z-[9999] bg-primary text-primary-foreground shadow-2xl cursor-pointer animate-in fade-in slide-in-from-bottom-5 border-2 border-primary-foreground/20" onClick={handleClick}>
      <Bell className="h-4 w-4 text-primary-foreground" />
      <AlertTitle className="text-primary-foreground font-semibold">New Notification!</AlertTitle>
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
