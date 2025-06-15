
import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import WorkstationSettings from '@/components/settings/WorkstationSettings';
import EmployeeSettings from '@/components/settings/EmployeeSettings';
import StandardTasksSettings from '@/components/settings/StandardTasksSettings';
import HolidayPlanner from '@/components/settings/HolidayPlanner';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Settings: React.FC = () => {
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const isAdmin = currentEmployee?.role === 'admin';
  const { t } = useTranslation();

  // Redirect non-admin users
  useEffect(() => {
    if (currentEmployee && currentEmployee.role !== 'admin') {
      toast({
        title: t('settingsPage.toasts.accessDeniedTitle'),
        description: t('settingsPage.toasts.accessDeniedDescription'),
        variant: "destructive"
      });
    }
    setLoading(false);
  }, [currentEmployee, toast, t]);

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
        <div className="ml-64 w-full p-6 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
        <div className="ml-64 w-full p-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center py-12">
              <SettingsIcon className="mx-auto h-16 w-16 text-gray-400" />
              <h1 className="mt-4 text-2xl font-bold text-gray-900">{t('settingsPage.accessDenied')}</h1>
              <p className="mt-2 text-gray-600">{t('settingsPage.permissionDenied')}</p>
              <Button
                className="mt-6"
                onClick={() => window.history.back()}
              >
                {t('settingsPage.goBack')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      <div className="ml-64 w-full p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">{t('settingsPage.title')}</h1>
          
          <Tabs defaultValue="workstations">
            <TabsList className="mb-4">
              <TabsTrigger value="workstations">{t('settingsPage.tabs.workstations')}</TabsTrigger>
              <TabsTrigger value="employees">{t('settingsPage.tabs.employees')}</TabsTrigger>
              <TabsTrigger value="standard-tasks">{t('settingsPage.tabs.standardTasks')}</TabsTrigger>
              <TabsTrigger value="holiday-planner">{t('settingsPage.tabs.holidayPlanner')}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="workstations">
              <WorkstationSettings />
            </TabsContent>
            
            <TabsContent value="employees">
              <EmployeeSettings />
            </TabsContent>

            <TabsContent value="standard-tasks">
              <StandardTasksSettings />
            </TabsContent>

            <TabsContent value="holiday-planner">
              <HolidayPlanner />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Settings;
