
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
    <>
      <TaskTimer />
      <NotificationBanner />
    </>
  );
};

export default GlobalComponents;
