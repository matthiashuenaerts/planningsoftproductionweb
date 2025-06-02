
import React, { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Notification {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  timestamp: Date;
  read: boolean;
}

const NotificationBox = () => {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      message: 'New rush order created',
      type: 'warning',
      timestamp: new Date(),
      read: false
    },
    {
      id: '2',
      message: 'Project deadline approaching',
      type: 'info',
      timestamp: new Date(Date.now() - 3600000),
      read: false
    }
  ]);
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const getTypeColor = (type: Notification['type']) => {
    switch (type) {
      case 'error':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'warning':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'success':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs">
            {unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <Card className="absolute top-full right-0 mt-2 w-80 max-h-96 overflow-y-auto z-50 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm">Notifications</CardTitle>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    className="text-xs h-6"
                  >
                    Mark all read
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No notifications
              </p>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      notification.read 
                        ? 'bg-gray-50 border-gray-200' 
                        : getTypeColor(notification.type)
                    }`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-medium flex-1">
                        {notification.message}
                      </p>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full ml-2 mt-1 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {notification.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NotificationBox;
