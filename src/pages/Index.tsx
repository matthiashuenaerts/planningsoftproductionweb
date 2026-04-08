import React from 'react';
import Dashboard from '@/components/Dashboard';
import { useAuth } from '@/context/AuthContext';
import UserManagement from '@/components/UserManagement';
import Navbar from '@/components/Navbar';
import WorkstationDashboard from '@/components/WorkstationDashboard';
import InstallationTeamDashboard from '@/components/installation/InstallationTeamDashboard';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/context/LanguageContext';
import NotificationDropdown from '@/components/NotificationDropdown';
import { useDrawerLayout } from '@/hooks/useDrawerLayout';

const Index = () => {
  const { currentEmployee } = useAuth();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const drawerLayout = useDrawerLayout();

  if (currentEmployee?.role === 'workstation') {
    return <WorkstationDashboard />;
  }

  if (currentEmployee?.role === 'installation_team') {
    return <InstallationTeamDashboard />;
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('good_morning');
    if (hour < 18) return t('good_afternoon');
    return t('good_evening');
  };

  return (
    <div className="flex min-h-screen bg-muted/30">
      {!drawerLayout && (
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
      )}
      {drawerLayout && <Navbar />}
      <div className={`w-full ${!drawerLayout ? 'ml-64 p-6' : 'px-3 pt-16 pb-4'}`}>
        <div className="max-w-7xl mx-auto">
          {/* Modern Header */}
          <div className={`mb-6 ${isMobile ? 'mb-4' : 'mb-8'}`}>
            <div className="flex items-center justify-between">
              <div>
                {currentEmployee && (
                  <p className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
                    {getGreeting()}, {currentEmployee.name?.split(' ')[0]}
                  </p>
                )}
                <h1 className={`font-bold tracking-tight ${isMobile ? 'text-xl' : 'text-3xl'}`}>
                  {t('dashboard')}
                </h1>
              </div>
            </div>
          </div>
          <Dashboard />
        </div>
      </div>
    </div>
  );
};
export default Index;
