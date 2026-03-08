
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import WorkstationSettings from '@/components/settings/WorkstationSettings';
import EmployeeSettings from '@/components/settings/EmployeeSettings';
import StandardTasksSettings from '@/components/settings/StandardTasksSettings';
import HolidayPlanner from '@/components/settings/HolidayPlanner';
import SupplierSettings from '@/components/settings/SupplierSettings';
import ProductsSettings from '@/components/settings/ProductsSettings';
import CalculationRelationshipsSettings from '@/components/settings/CalculationRelationshipsSettings';
import ExternalDatabaseSettings from '@/components/settings/ExternalDatabaseSettings';
import { HelpManagement } from '@/components/help/HelpManagement';
import MailSettings from '@/components/settings/MailSettings';
import StockLocationsSettings from '@/components/settings/StockLocationsSettings';
import InstallationTeamsSettings from '@/components/settings/InstallationTeamsSettings';
import { CsvImportConfigSettings } from '@/components/CsvImportConfigSettings';
import ProductionRoutingSettings from '@/components/settings/ProductionRoutingSettings';
import OrderTaskGroupsSettings from '@/components/settings/OrderTaskGroupsSettings';
import MaterialSettings from '@/components/settings/MaterialSettings';
import SupabaseConnectionSettings from '@/components/settings/SupabaseConnectionSettings';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const tabConfig = [
  { value: 'workstations', labelKey: 'set_workstations' },
  { value: 'employees', labelKey: 'set_employees' },
  { value: 'production-routing', labelKey: 'set_production_routing' },
  { value: 'standard-tasks', labelKey: 'set_standard_tasks' },
  { value: 'calculation-relationships', labelKey: 'set_calculation_relationships' },
  { value: 'holiday-planner', labelKey: 'set_holiday_planner' },
  { value: 'suppliers', labelKey: 'set_suppliers' },
  { value: 'products', labelKey: 'set_products' },
  { value: 'stock', labelKey: 'set_stock_locations' },
  { value: 'materials', labelKey: 'set_materials' },
  { value: 'installation-teams', labelKey: 'set_installation_teams' },
  { value: 'external-database', labelKey: 'set_external_database' },
  
  { value: 'mail', labelKey: 'set_mail' },
  { value: 'help', labelKey: 'set_help_management' },
  { value: 'csv-import', labelKey: 'set_csv_import' },
  { value: 'order-task-groups', labelKey: 'set_order_task_groups' },
];

const Settings: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { currentEmployee } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();
  const isAdmin = currentEmployee?.role === 'admin';
  const defaultTab = searchParams.get('tab') || 'workstations';
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    if (currentEmployee && currentEmployee.role !== 'admin') {
      toast({
        title: t('set_access_denied'),
        description: t('set_no_permission'),
        variant: "destructive"
      });
    }
    setLoading(false);
  }, [currentEmployee, toast, t]);

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Navbar />
        <div className={`flex-1 min-w-0 p-6 flex justify-center items-center ${!isMobile ? 'ml-64' : 'pt-16'}`}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen bg-background">
        <Navbar />
        <div className={`flex-1 min-w-0 p-4 md:p-6 ${!isMobile ? 'ml-64' : 'pt-16'}`}>
          <div className="text-center py-12">
            <SettingsIcon className="mx-auto h-16 w-16 text-muted-foreground" />
            <h1 className="mt-4 text-2xl font-bold text-foreground">{t('set_access_denied')}</h1>
            <p className="mt-2 text-muted-foreground">{t('set_no_permission')}</p>
            <Button className="mt-6" onClick={() => window.history.back()}>
              {t('set_go_back')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const renderTabContent = (tab: string) => {
    switch (tab) {
      case 'workstations': return <WorkstationSettings />;
      case 'employees': return <EmployeeSettings />;
      case 'production-routing': return <ProductionRoutingSettings />;
      case 'standard-tasks': return <StandardTasksSettings />;
      case 'calculation-relationships': return <CalculationRelationshipsSettings />;
      case 'holiday-planner': return <HolidayPlanner />;
      case 'suppliers': return <SupplierSettings />;
      case 'products': return <ProductsSettings />;
      case 'stock': return <StockLocationsSettings />;
      case 'materials': return <MaterialSettings />;
      case 'installation-teams': return <InstallationTeamsSettings />;
      case 'external-database': return <ExternalDatabaseSettings />;
      
      case 'mail': return <MailSettings />;
      case 'help': return <HelpManagement />;
      case 'csv-import': return <CsvImportConfigSettings />;
      case 'order-task-groups': return <OrderTaskGroupsSettings />;
      default: return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Navbar />
      <div className={`flex-1 min-w-0 overflow-x-hidden p-4 md:p-6 ${!isMobile ? 'ml-64' : 'pt-16'}`}>
        <h1 className="text-2xl font-bold mb-4 md:mb-6">{t('set_system_settings')}</h1>

        {isMobile ? (
          /* Mobile: use a select dropdown instead of tabs */
          <div className="space-y-4">
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {t(tabConfig.find(tc => tc.value === activeTab)?.labelKey || 'set_workstations')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {tabConfig.map((tab) => (
                  <SelectItem key={tab.value} value={tab.value}>
                    {t(tab.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div>{renderTabContent(activeTab)}</div>
          </div>
        ) : (
          /* Desktop: scrollable tabs */
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 flex flex-wrap gap-1 h-auto p-1">
              {tabConfig.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="text-xs whitespace-nowrap">
                  {t(tab.labelKey)}
                </TabsTrigger>
              ))}
            </TabsList>

            {tabConfig.map((tab) => (
              <TabsContent key={tab.value} value={tab.value}>
                {renderTabContent(tab.value)}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default Settings;
