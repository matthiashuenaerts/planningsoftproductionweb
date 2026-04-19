import { useEffect, useRef, useCallback } from 'react';

const shownNotificationKeys = new Set<string>();

export const useNativeNotifications = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('/notification-sound.mp3');
    audioRef.current.volume = 0.6;

    if ('Notification' in window && Notification.permission === 'default') {
      const timer = setTimeout(() => {
        Notification.requestPermission().catch(() => {});
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const playSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, []);

  const vibrate = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  }, []);

  const showNotification = useCallback(
    (title: string, body: string, dedupeKey?: string) => {
      const key = dedupeKey ?? `${title}:${body}`;
      if (shownNotificationKeys.has(key)) return;
      shownNotificationKeys.add(key);

      if (shownNotificationKeys.size > 200) {
        const first = shownNotificationKeys.values().next().value;
        if (first) shownNotificationKeys.delete(first);
      }

      playSound();
      vibrate();

      if (!('Notification' in window)) return;

      const createNotification = () => {
        try {
          const notification = new Notification(title, {
            body,
            icon: '/favicon_New.ico',
            tag: key,
            requireInteraction: false,
          });

          const autoClose = setTimeout(() => notification.close(), 6000);
          notification.onclick = () => {
            clearTimeout(autoClose);
            window.focus();
            notification.close();
          };
        } catch {
          // Browser rejected native popup; in-app banner remains available.
        }
      };

      if (Notification.permission === 'granted') {
        createNotification();
      } else if (Notification.permission === 'default') {
        Notification.requestPermission()
          .then((perm) => {
            if (perm === 'granted') createNotification();
          })
          .catch(() => {});
      }
    },
    [playSound, vibrate],
  );

  return { showNotification };
};
