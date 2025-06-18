
import React from 'react';
import { useAuth } from '@/context/AuthContext';
import TaskTimer from './TaskTimer';
import NotificationBanner from './NotificationBanner';

const GlobalComponents = () => {
  const { currentEmployee } = useAuth();

  if (!currentEmployee) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="pointer-events-auto">
        <TaskTimer />
      </div>
      <div className="pointer-events-auto">
        <NotificationBanner />
      </div>
    </div>
  );
};

export default GlobalComponents;
