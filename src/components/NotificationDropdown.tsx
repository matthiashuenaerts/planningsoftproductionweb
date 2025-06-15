import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/context/AuthContext';
import { notificationService, Notification } from '@/services/notificationService';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

const NotificationDropdown: React.FC = () => {
  const { currentEmployee } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const fetchNotifications = async () => {
    if (!currentEmployee) return;
    
    setLoading(true);
    try {
      const data = await notificationService.getUserNotifications(currentEmployee.id);
      setNotifications(data);
      
      const count = data.filter(n => !n.read).length;
      setUnreadCount(count);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Initial fetch
  useEffect(() => {
    fetchNotifications();
    
    // Set up polling for notifications
    const intervalId = setInterval(fetchNotifications, 60000); // Every minute
    
    return () => clearInterval(intervalId);
  }, [currentEmployee]);
  
  const handleNotificationClick = async (notification: Notification) => {
    try {
      // Mark notification as read
      if (!notification.read) {
        await notificationService.markAsRead(notification.id);
        
        // Update local state
        setNotifications(prev => 
          prev.map(n => 
            n.id === notification.id ? { ...n, read: true } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
      // Navigate to rush order if applicable
      if (notification.rush_order_id) {
        navigate(`/rush-orders/${notification.rush_order_id}`);
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
    }
  };
  
  const markAllAsRead = async () => {
    if (!currentEmployee) return;
    
    try {
      await notificationService.markAllAsRead(currentEmployee.id);
      
      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };
  
  const getTimeString = (timestamp: string) => {
    const date = parseISO(timestamp);
    const now = new Date();
    
    // If it's today, show relative time (e.g., "2 hours ago")
    if (date.toDateString() === now.toDateString()) {
      return formatDistanceToNow(date, { addSuffix: true });
    }
    
    // Otherwise, show the date
    return format(date, 'MMM d, HH:mm');
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end">
        <div className="flex items-center justify-between py-2 px-4">
          <h2 className="text-sm font-medium">Notifications</h2>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-auto py-1 px-2 text-xs"
              onClick={markAllAsRead}
            >
              Mark all as read
            </Button>
          )}
        </div>
        
        <DropdownMenuSeparator />
        
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="py-4 px-4 text-center text-sm text-gray-500">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-4 px-4 text-center text-sm text-gray-500">
              No notifications
            </div>
          ) : (
            notifications.map((notification, i) => (
              <React.Fragment key={notification.id}>
                <DropdownMenuItem
                  className={`py-3 px-4 cursor-pointer ${!notification.read ? 'bg-blue-50' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex justify-between items-start w-full">
                      <span className="text-sm font-medium">
                        {notification.message}
                      </span>
                      {!notification.read && (
                        <Badge variant="outline" className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0 h-5">
                          New
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {getTimeString(notification.created_at)}
                    </span>
                  </div>
                </DropdownMenuItem>
                {i < notifications.length - 1 && <Separator />}
              </React.Fragment>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationDropdown;
