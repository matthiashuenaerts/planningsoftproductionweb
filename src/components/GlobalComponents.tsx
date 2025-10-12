
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

  // Hide TaskTimer on control panel pages
  const isControlPanel = location.pathname.includes('/control-panel');

  return (
    <>
      {!isControlPanel && <TaskTimer />}
      <NotificationBanner />
    </>
  );
};

export default GlobalComponents;
