
import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from 'react-router-dom';
import TaskTimer from './TaskTimer';
import NotificationBanner from './NotificationBanner';
import GeneralMessageBanner from './GeneralMessageBanner';

const GlobalComponents = () => {
  const { currentEmployee } = useAuth();
  const location = useLocation();

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

  const isControlPanel = location.pathname.includes('/control-panel');
  const isMarketingSite = location.pathname.startsWith('/site');

  if (isMarketingSite) {
    return null;
  }

  return (
    <>
      <GeneralMessageBanner />
      {!isControlPanel && <TaskTimer />}
      <NotificationBanner />
    </>
  );
};

export default GlobalComponents;
