import { useEffect, useRef, useCallback } from 'react';

export const useNativeNotifications = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Track which notification IDs we've already shown so we never popup the same one twice.
  const shownIdsRef = useRef<Set<string>>(new Set());

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

  /**
   * Show a native OS notification.
   * `dedupeKey` MUST be a stable id (e.g. the notification row id) so we never
   * fire the same toast twice — even across re-renders / refetches.
   */
  const showNotification = useCallback(
    (title: string, body: string, dedupeKey?: string) => {
      const key = dedupeKey ?? `${title}:${body}`;
      if (shownIdsRef.current.has(key)) return;
      shownIdsRef.current.add(key);
      // Cap the set so it doesn't grow forever
      if (shownIdsRef.current.size > 200) {
        const first = shownIdsRef.current.values().next().value;
        if (first) shownIdsRef.current.delete(first);
      }

      playSound();
      vibrate();

      if (!('Notification' in window)) return;

      const createNotification = () => {
        try {
          // NOTE: do NOT pass `vibrate` (deprecated, breaks on Windows Chrome)
          // and do NOT pass `silent: true` (suppresses Windows native popup sound
          // and on some builds suppresses the popup entirely).
          const notification = new Notification(title, {
            body,
            icon: '/favicon_New.ico',
            badge: '/favicon_New.ico',
            tag: key, // same key → OS replaces instead of stacking duplicates
            requireInteraction: false,
          });

          const autoClose = setTimeout(() => notification.close(), 6000);
          notification.onclick = () => {
            clearTimeout(autoClose);
            window.focus();
            notification.close();
          };
        } catch {
          // Safari can throw on the constructor — in-app banner still shows.
        }
      };

      if (Notification.permission === 'granted') {
        createNotification();
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') createNotification();
        }).catch(() => {});
      }
    },
    [playSound, vibrate],
  );

  return { showNotification };
};
