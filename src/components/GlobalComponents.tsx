
import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from 'react-router-dom';
import TaskTimer from './TaskTimer';
import NotificationBanner from './NotificationBanner';

const GlobalComponents = () => {
  const { currentEmployee } = useAuth();
  const location = useLocation();

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
