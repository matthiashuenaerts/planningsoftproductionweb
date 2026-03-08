import { useEffect, useRef, useCallback } from 'react';

export const useNativeNotifications = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastNotifiedRef = useRef<string>('');

  useEffect(() => {
    // Pre-load audio
    audioRef.current = new Audio('/notification-sound.mp3');
    audioRef.current.volume = 0.6;

    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      // Delay request to avoid browser blocking it
      const timer = setTimeout(() => {
        Notification.requestPermission();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const playSound = useCallback(() => {
    if (audioRef.current) {
      // Reset to start for rapid re-plays
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, []);

  const vibrate = useCallback(() => {
    // Works on Android Chrome and some other mobile browsers
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  }, []);

  const showNotification = useCallback((title: string, body: string, icon?: string) => {
    // Deduplicate rapid-fire same notifications
    const key = `${title}:${body}`;
    if (key === lastNotifiedRef.current) return;
    lastNotifiedRef.current = key;
    setTimeout(() => { lastNotifiedRef.current = ''; }, 5000);

    // Always play sound + vibrate (works even without Notification API permission)
    playSound();
    vibrate();

    if (!('Notification' in window)) return;

    const createNotification = () => {
      try {
        const notification = new Notification(title, {
          body,
          icon: icon || '/favicon_New.ico',
          badge: '/favicon_New.ico',
          tag: `app-notification-${Date.now()}`,
          requireInteraction: false,
          silent: true, // We handle sound ourselves
          // @ts-ignore - vibrate is supported on Android
          vibrate: [200, 100, 200],
        });

        // Auto-close after 6 seconds (helps on Windows where notifications persist)
        const autoClose = setTimeout(() => notification.close(), 6000);

        notification.onclick = () => {
          clearTimeout(autoClose);
          window.focus();
          notification.close();
        };
      } catch {
        // Safari sometimes throws on Notification constructor
        // Fall back to nothing — in-app banner is still shown
      }
    };

    if (Notification.permission === 'granted') {
      createNotification();
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') createNotification();
      });
    }
  }, [playSound, vibrate]);

  return { showNotification };
};
