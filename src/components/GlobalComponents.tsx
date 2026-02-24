
import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from 'react-router-dom';
import TaskTimer from './TaskTimer';
import NotificationBanner from './NotificationBanner';

const GlobalComponents = () => {
  const { currentEmployee } = useAuth();
  const location = useLocation();

  // Global fix: Radix UI can leave pointer-events: none on document.body
  // when dialogs/dropdowns/drawers unmount unexpectedly. This observer
  // reverts it immediately whenever it's detected.
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (document.body.style.pointerEvents === 'none') {
        document.body.style.pointerEvents = '';
      }
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['style'],
    });
    return () => observer.disconnect();
  }, []);

  if (!currentEmployee) {
    return null;
  }

  // Hide on control panel and marketing site pages
  const isControlPanel = location.pathname.includes('/control-panel');
  const isMarketingSite = location.pathname.startsWith('/site');

  if (isMarketingSite) {
    return null;
  }

  return (
    <>
      {!isControlPanel && <TaskTimer />}
      <NotificationBanner />
    </>
  );
};

export default GlobalComponents;
