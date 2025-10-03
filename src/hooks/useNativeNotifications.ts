import { useEffect, useRef } from 'react';

export const useNativeNotifications = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio element for notification sound
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTWH0fPTgjMGHm7A7+OZURE');
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const showNotification = (title: string, body: string, icon?: string) => {
    // Check if notifications are supported and permitted
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return;
    }

    if (Notification.permission === 'granted') {
      // Play sound
      if (audioRef.current) {
        audioRef.current.play().catch(err => console.log('Could not play sound:', err));
      }

      // Show native notification
      const notification = new Notification(title, {
        body,
        icon: icon || '/favicon_New.ico',
        badge: '/favicon_New.ico',
        tag: 'app-notification',
        requireInteraction: true, // Keep notification visible until user interacts
        silent: false, // Use system sound
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } else if (Notification.permission === 'default') {
      // Request permission and retry
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          showNotification(title, body, icon);
        }
      });
    }
  };

  return { showNotification };
};
