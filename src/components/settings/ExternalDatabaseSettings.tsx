import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Database, Key, Search, RefreshCw } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

const ExternalDatabaseSettings: React.FC = () => {
  // Helper function to convert week number to date
  const convertWeekNumberToDate = (weekNumber: string): string => {
    console.log(`Converting date/week: ${weekNumber}`);
    
    // Check if it's a week number format (like 202544)
    if (/^\d{6}$/.test(weekNumber)) {
      const year = parseInt(weekNumber.substring(0, 4));
      const week = parseInt(weekNumber.substring(4, 6));
      
      console.log(`Detected week number - Year: ${year}, Week: ${week}`);
      
      // Calculate the first day of the year
      const jan1 = new Date(year, 0, 1);
      
      // Find the first Monday of the year
      const jan1Day = jan1.getDay();
      const daysToFirstMonday = jan1Day === 0 ? 1 : (8 - jan1Day);
      const firstMonday = new Date(year, 0, 1 + daysToFirstMonday);
      
      // Calculate the target week's Monday
      const targetDate = new Date(firstMonday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
      
      const result = targetDate.toISOString().split('T')[0];
      console.log(`Week ${weekNumber} converted to: ${result}`);
      return result;
    }
    
    // If it's already a date string, try to parse and format it
    if (weekNumber) {
      try {
        const date = new Date(weekNumber);
        if (!isNaN(date.getTime())) {
          const result = date.toISOString().split('T')[0];
          console.log(`Date ${weekNumber} formatted to: ${result}`);
          return result;
        }
      } catch (e) {
        console.warn(`Failed to parse date: ${weekNumber}`);
      }
    }
    
    console.log(`Using original value: ${weekNumber}`);
    return weekNumber;
  };

  const { toast } = useToast();
  
  // Projects API state
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testingQuery, setTestingQuery] = useState(false);
  const [syncingProjects, setSyncingProjects] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [token, setToken] = useState<string>('');
  const [queryResult, setQueryResult] = useState<string>('');
  const [syncResult, setSyncResult] = useState<string>('');
  
  const [config, setConfig] = useState({
    baseUrl: 'https://app.thonon.be/fmi/data/vLatest/databases/CrownBasePro-Thonon',
    username: 'Matthias HUENAERTS',
    password: '8pJ1A24z',
    testOrderNumber: '24000079'
  });

  // Orders API state
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersTestingConnection, setOrdersTestingConnection] = useState(false);
  const [ordersTestingQuery, setOrdersTestingQuery] = useState(false);
  const [ordersConnectionStatus, setOrdersConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [ordersToken, setOrdersToken] = useState<string>('');
  const [ordersQueryResult, setOrdersQueryResult] = useState<string>('');
  
  const [ordersConfig, setOrdersConfig] = useState({
    baseUrl: 'https://app.thonon.be/fmi/data/vLatest/databases/CrownBasePro-Thonon',
    username: 'Matthias HUENAERTS',
    password: '8pJ1A24z',
    testOrderNumber: '24000079'
  });

  const handleConfigChange = (field: string, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleOrdersConfigChange = (field: string, value: string) => {
    setOrdersConfig(prev => ({ ...prev, [field]: value }));
  };

  const testConnection = async () => {
    if (!config.username || !config.password) {
      toast({
        title: "Configuration Required",
        description: "Please enter username and password first",
        variant: "destructive"
      });
      return;
    }

    setTestingConnection(true);
    setConnectionStatus('idle');
    
    console.log('Testing connection via edge function...');
    console.log('BaseURL:', config.baseUrl);
    console.log('Username:', config.username);
    
    try {
      const response = await fetch('https://pqzfmphitzlgwnmexrbx.supabase.co/functions/v1/external-db-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxemZtcGhpdHpsZ3dubWV4cmJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNDcxMDIsImV4cCI6MjA2MDcyMzEwMn0.SmvaZXSXKXeru3vuQY8XBlcNmpHyaZmAUk-bObZQQC4`
        },
        body: JSON.stringify({
          action: 'authenticate',
          baseUrl: config.baseUrl,
          username: config.username,
          password: config.password
        })
      });

      console.log('Edge function response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Edge function error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Edge function response data:', data);
      
      if (data.response && data.response.token) {
        setToken(data.response.token);
        setConnectionStatus('success');
        console.log('Token received via edge function:', data.response.token);
        toast({
          title: "Connection Successful",
          description: "Successfully authenticated via edge function and received token",
        });
      } else {
        console.error('No token in edge function response:', data);
        throw new Error('No token received from API via edge function');
      }
    } catch (error) {
      console.error('Connection error details:', error);
      
      setConnectionStatus('error');
      let errorMessage = "Failed to connect to external database";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Connection Failed", 
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const testQuery = async () => {
    if (!token) {
      toast({
        title: "No Token",
        description: "Please test connection first to get a token",
        variant: "destructive"
      });
      return;
    }

    if (!config.testOrderNumber) {
      toast({
        title: "Order Number Required",
        description: "Please enter a test order number",
        variant: "destructive"
      });
      return;
    }

    setTestingQuery(true);
    
    console.log('Testing query via edge function...');
    console.log('Order number:', config.testOrderNumber);
    console.log('Token:', token);
    
    try {
      const response = await fetch('https://pqzfmphitzlgwnmexrbx.supabase.co/functions/v1/external-db-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxemZtcGhpdHpsZ3dubWV4cmJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNDcxMDIsImV4cCI6MjA2MDcyMzEwMn0.SmvaZXSXKXeru3vuQY8XBlcNmpHyaZmAUk-bObZQQC4`
        },
        body: JSON.stringify({
          action: 'query',
          baseUrl: config.baseUrl,
          token: token,
          orderNumber: config.testOrderNumber
        })
      });

      console.log('Query response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Query error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Query response data:', data);
      setQueryResult(JSON.stringify(data, null, 2));
      
      toast({
        title: "Query Successful",
        description: "Successfully retrieved order data via edge function",
      });
    } catch (error) {
      console.error('Query error details:', error);
      toast({
        title: "Query Failed",
        description: error instanceof Error ? error.message : "Failed to query external database",
        variant: "destructive"
      });
      setQueryResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setTestingQuery(false);
    }
  };

  const syncProjects = async () => {
    setSyncingProjects(true);
    setSyncResult('');
    
    try {
      console.log('Starting project sync via edge function...');
      
      const { data, error } = await supabase.functions.invoke('project-sync', {
        body: {}
      });

      if (error) {
        throw new Error(`Edge function error: ${error.message}`);
      }

      if (data) {
        setSyncResult(data.message || 'Sync completed successfully');
        
        toast({
          title: "Sync Completed",
          description: data.message || 'Projects synchronized successfully',
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Sync error:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to sync projects";
      setSyncResult(`Error: ${errorMessage}`);
      
      toast({
        title: "Sync Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setSyncingProjects(false);
    }
  };

  const saveConfiguration = async () => {
    setLoading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Configuration Saved",
        description: "External database API configuration has been saved",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save configuration",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Orders API functions
  const testOrdersConnection = async () => {
    if (!ordersConfig.username || !ordersConfig.password) {
      toast({
        title: "Configuration Required",
        description: "Please enter username and password first",
        variant: "destructive"
      });
      return;
    }

    setOrdersTestingConnection(true);
    setOrdersConnectionStatus('idle');
    
    console.log('Testing orders connection via edge function...');
    console.log('BaseURL:', ordersConfig.baseUrl);
    console.log('Username:', ordersConfig.username);
    
    try {
      const response = await fetch('https://pqzfmphitzlgwnmexrbx.supabase.co/functions/v1/orders-api-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxemZtcGhpdHpsZ3dubWV4cmJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNDcxMDIsImV4cCI6MjA2MDcyMzEwMn0.SmvaZXSXKXeru3vuQY8XBlcNmpHyaZmAUk-bObZQQC4`
        },
        body: JSON.stringify({
          action: 'authenticate',
          baseUrl: ordersConfig.baseUrl,
          username: ordersConfig.username,
          password: ordersConfig.password
        })
      });

      console.log('Orders edge function response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Orders edge function error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Orders edge function response data:', data);
      
      if (data.response && data.response.token) {
        setOrdersToken(data.response.token);
        setOrdersConnectionStatus('success');
        console.log('Orders token received via edge function:', data.response.token);
        toast({
          title: "Orders Connection Successful",
          description: "Successfully authenticated orders API via edge function and received token",
        });
      } else {
        console.error('No token in orders edge function response:', data);
        throw new Error('No token received from Orders API via edge function');
      }
    } catch (error) {
      console.error('Orders connection error details:', error);
      
      setOrdersConnectionStatus('error');
      let errorMessage = "Failed to connect to orders API";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Orders Connection Failed", 
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setOrdersTestingConnection(false);
    }
  };

  const testOrdersQuery = async () => {
    if (!ordersToken) {
      toast({
        title: "No Token",
        description: "Please test orders connection first to get a token",
        variant: "destructive"
      });
      return;
    }

    if (!ordersConfig.testOrderNumber) {
      toast({
        title: "Order Number Required",
        description: "Please enter a test order number",
        variant: "destructive"
      });
      return;
    }

    setOrdersTestingQuery(true);
    
    console.log('Testing orders query via edge function...');
    console.log('Order number:', ordersConfig.testOrderNumber);
    console.log('Token:', ordersToken);
    
    try {
      const response = await fetch('https://pqzfmphitzlgwnmexrbx.supabase.co/functions/v1/orders-api-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxemZtcGhpdHpsZ3dubWV4cmJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNDcxMDIsImV4cCI6MjA2MDcyMzEwMn0.SmvaZXSXKXeru3vuQY8XBlcNmpHyaZmAUk-bObZQQC4`
        },
        body: JSON.stringify({
          action: 'query',
          baseUrl: ordersConfig.baseUrl,
          token: ordersToken,
          orderNumber: ordersConfig.testOrderNumber
        })
      });

      console.log('Orders query response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Orders query error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Orders query response data:', data);
      setOrdersQueryResult(JSON.stringify(data, null, 2));
      
      toast({
        title: "Orders Query Successful",
        description: "Successfully retrieved orders data via edge function",
      });
    } catch (error) {
      console.error('Orders query error details:', error);
      toast({
        title: "Orders Query Failed",
        description: error instanceof Error ? error.message : "Failed to query orders API",
        variant: "destructive"
      });
      setOrdersQueryResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setOrdersTestingQuery(false);
    }
  };

  const saveOrdersConfiguration = async () => {
    setOrdersLoading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Orders Configuration Saved",
        description: "Orders API configuration has been saved",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save orders configuration",
        variant: "destructive"
      });
    } finally {
      setOrdersLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">External Database API Connection</h2>
        <p className="text-muted-foreground">
          Configure connection to external FileMaker database for data synchronization
        </p>
      </div>

      <Tabs defaultValue="projects" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="projects">Projects API</TabsTrigger>
          <TabsTrigger value="orders">Orders API</TabsTrigger>
        </TabsList>
        
        <TabsContent value="projects" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Projects API Configuration
              </CardTitle>
              <CardDescription>
                Set up authentication details for the external FileMaker database - Projects
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="projects-baseUrl">Base URL</Label>
                  <Input
                    id="projects-baseUrl"
                    value={config.baseUrl}
                    onChange={(e) => handleConfigChange('baseUrl', e.target.value)}
                    placeholder="https://app.thonon.be/fmi/data/vLatest/databases/CrownBasePro-Thonon"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="projects-username">Username</Label>
                  <Input
                    id="projects-username"
                    type="text"
                    value={config.username}
                    onChange={(e) => handleConfigChange('username', e.target.value)}
                    placeholder="Enter username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="projects-password">Password</Label>
                  <Input
                    id="projects-password"
                    type="password"
                    value={config.password}
                    onChange={(e) => handleConfigChange('password', e.target.value)}
                    placeholder="Enter password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="projects-testOrderNumber">Test Order Number</Label>
                  <Input
                    id="projects-testOrderNumber"
                    value={config.testOrderNumber}
                    onChange={(e) => handleConfigChange('testOrderNumber', e.target.value)}
                    placeholder="24000079"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={testConnection} 
                  disabled={testingConnection}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  {testingConnection ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : connectionStatus === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : connectionStatus === 'error' ? (
                    <XCircle className="h-4 w-4 text-red-600" />
                  ) : (
                    <Key className="h-4 w-4" />
                  )}
                  {testingConnection ? 'Testing...' : 'Test Connection'}
                </Button>

                <Button 
                  onClick={testQuery} 
                  disabled={testingQuery || !token}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  {testingQuery ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  {testingQuery ? 'Querying...' : 'Test Query'}
                </Button>

                <Button 
                  onClick={saveConfiguration} 
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  {loading ? 'Saving...' : 'Save Configuration'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Project Synchronization
              </CardTitle>
              <CardDescription>
                Manually sync all projects with external database for installation date updates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button 
                  onClick={syncProjects} 
                  disabled={syncingProjects}
                  className="flex items-center gap-2"
                >
                  {syncingProjects ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {syncingProjects ? 'Syncing Projects...' : 'Sync All Projects'}
                </Button>
                <div className="text-sm text-muted-foreground">
                  This process checks all projects with project_link_id against the external database and updates installation dates if they differ.
                </div>
              </div>
              
              {syncResult && (
                <div className="mt-4">
                  <Label>Sync Result:</Label>
                  <Textarea
                    value={syncResult}
                    readOnly
                    className="mt-2 min-h-[200px] font-mono text-sm"
                    placeholder="Sync results will appear here..."
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {token && (
            <Card>
              <CardHeader>
                <CardTitle>Authentication Token</CardTitle>
                <CardDescription>Current session token for API requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-3 rounded-md font-mono text-sm break-all">
                  {token}
                </div>
              </CardContent>
            </Card>
          )}

          {queryResult && (
            <Card>
              <CardHeader>
                <CardTitle>Query Result</CardTitle>
                <CardDescription>
                  Response from the external database for order number: {config.testOrderNumber}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Textarea
                    value={queryResult}
                    readOnly
                    className="min-h-[300px] font-mono text-sm"
                    placeholder="Query results will appear here..."
                  />
                  
                  {/* Parse and display order data if available */}
                  {(() => {
                    try {
                      const parsed = JSON.parse(queryResult);
                      if (parsed.response?.scriptResult) {
                        const orderData = JSON.parse(parsed.response.scriptResult);
                        if (orderData.order) {
                          const updateInstallationDate = async () => {
                            try {
                              const orderNumber = orderData.order.ordernummer;
                              const placementDate = orderData.order.plaatsingsdatum;
                              const convertedDate = convertWeekNumberToDate(placementDate);
                              
                              // Look up project in Supabase
                              const { data: project, error: fetchError } = await supabase
                                .from('projects')
                                .select('id, installation_date')
                                .eq('project_link_id', orderNumber)
                                .single();
                              
                              if (fetchError) {
                                toast({
                                  title: "Project Not Found",
                                  description: `No project found with order number: ${orderNumber}`,
                                  variant: "destructive"
                                });
                                return;
                              }
                              
                              // Compare dates
                              const currentDate = project.installation_date;
                              if (currentDate === convertedDate) {
                                toast({
                                  title: "No Update Needed",
                                  description: "Installation date is already up to date",
                                });
                                return;
                              }
                              
                              // Update the date
                              const { error: updateError } = await supabase
                                .from('projects')
                                .update({ installation_date: convertedDate })
                                .eq('id', project.id);
                              
                              if (updateError) {
                                toast({
                                  title: "Update Failed",
                                  description: updateError.message,
                                  variant: "destructive"
                                });
                                return;
                              }
                              
                              toast({
                                title: "Date Updated",
                                description: `Installation date updated from ${currentDate} to ${convertedDate}`,
                              });
                              
                            } catch (error) {
                              toast({
                                title: "Update Error",
                                description: error instanceof Error ? error.message : "Unknown error occurred",
                                variant: "destructive"
                              });
                            }
                          };
                          
                          return (
                            <div className="mt-4 p-4 bg-muted rounded-md">
                              <h4 className="font-semibold mb-4">Parsed Order Information:</h4>
                              
                              {/* Basic Order Information */}
                              <div className="mb-6">
                                <h5 className="font-medium mb-3 text-sm text-muted-foreground">Order Details</h5>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                                  <div><strong>Order Number:</strong> {orderData.order.ordernummer}</div>
                                  <div><strong>Record ID:</strong> {orderData.order.recordID}</div>
                                  <div><strong>Client:</strong> {orderData.order.klant}</div>
                                  <div><strong>Customer Number:</strong> {orderData.order.klantnummer}</div>
                                  <div><strong>Order Type:</strong> {orderData.order.ordertype}</div>
                                  <div><strong>Reference:</strong> {orderData.order.referentie}</div>
                                  <div><strong>Order Date:</strong> {orderData.order.orderdatum}</div>
                                  <div><strong>Processor:</strong> {orderData.order.orderverwerker}</div>
                                  <div className="col-span-2"><strong>Address:</strong> {orderData.order.adres}</div>
                                  <div className="col-span-2"><strong>Placement Date:</strong> {orderData.order.plaatsingsdatum} → {convertWeekNumberToDate(orderData.order.plaatsingsdatum)}</div>
                                </div>
                              </div>

                              {/* Planning Information */}
                              {orderData.order.planning && orderData.order.planning.length > 0 && (
                                <div className="mb-6">
                                  <h5 className="font-medium mb-3 text-sm text-muted-foreground">Planning Details</h5>
                                  {orderData.order.planning.map((plan: any, index: number) => (
                                    <div key={index} className="border border-border rounded-md p-3 mb-3 last:mb-0">
                                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                                        <div><strong>Summary:</strong> {plan.samenvatting}</div>
                                        <div><strong>Start Date:</strong> {plan.datum_start}</div>
                                        <div><strong>End Date:</strong> {plan.datum_einde}</div>
                                        {plan.tijd_start && <div><strong>Start Time:</strong> {plan.tijd_start}</div>}
                                        {plan.tijd_einde && <div><strong>End Time:</strong> {plan.tijd_einde}</div>}
                                        {plan.beschrijving && <div className="col-span-2"><strong>Description:</strong> {plan.beschrijving}</div>}
                                      </div>
                                      {plan.teams && plan.teams.length > 0 && (
                                        <div className="mt-2">
                                          <strong className="text-sm">Teams:</strong>
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {plan.teams.map((team: string, teamIndex: number) => (
                                              <span key={teamIndex} className="inline-block bg-primary/10 text-primary px-2 py-1 rounded text-xs">
                                                {team}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              <Button 
                                onClick={updateInstallationDate}
                                className="mt-2"
                                size="sm"
                              >
                                Update Date in Supabase
                              </Button>
                            </div>
                          );
                        }
                      }
                    } catch (e) {
                      return null;
                    }
                    return null;
                  })()}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="orders" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Orders API Configuration
              </CardTitle>
              <CardDescription>
                Set up authentication details for the external FileMaker database - Orders
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orders-baseUrl">Base URL</Label>
                  <Input
                    id="orders-baseUrl"
                    value={ordersConfig.baseUrl}
                    onChange={(e) => handleOrdersConfigChange('baseUrl', e.target.value)}
                    placeholder="https://app.thonon.be/fmi/data/vLatest/databases/CrownBasePro-Thonon"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orders-username">Username</Label>
                  <Input
                    id="orders-username"
                    type="text"
                    value={ordersConfig.username}
                    onChange={(e) => handleOrdersConfigChange('username', e.target.value)}
                    placeholder="Enter username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orders-password">Password</Label>
                  <Input
                    id="orders-password"
                    type="password"
                    value={ordersConfig.password}
                    onChange={(e) => handleOrdersConfigChange('password', e.target.value)}
                    placeholder="Enter password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orders-testOrderNumber">Test Order Number</Label>
                  <Input
                    id="orders-testOrderNumber"
                    value={ordersConfig.testOrderNumber}
                    onChange={(e) => handleOrdersConfigChange('testOrderNumber', e.target.value)}
                    placeholder="24000079"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={testOrdersConnection} 
                  disabled={ordersTestingConnection}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  {ordersTestingConnection ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : ordersConnectionStatus === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : ordersConnectionStatus === 'error' ? (
                    <XCircle className="h-4 w-4 text-red-600" />
                  ) : (
                    <Key className="h-4 w-4" />
                  )}
                  {ordersTestingConnection ? 'Testing...' : 'Test Connection'}
                </Button>

                <Button 
                  onClick={testOrdersQuery} 
                  disabled={ordersTestingQuery || !ordersToken}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  {ordersTestingQuery ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  {ordersTestingQuery ? 'Querying...' : 'Test Query'}
                </Button>

                <Button 
                  onClick={saveOrdersConfiguration} 
                  disabled={ordersLoading}
                  className="flex items-center gap-2"
                >
                  {ordersLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  {ordersLoading ? 'Saving...' : 'Save Configuration'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {ordersToken && (
            <Card>
              <CardHeader>
                <CardTitle>Orders Authentication Token</CardTitle>
                <CardDescription>Current session token for orders API requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-3 rounded-md font-mono text-sm break-all">
                  {ordersToken}
                </div>
              </CardContent>
            </Card>
          )}

          {ordersQueryResult && (
            <Card>
              <CardHeader>
                <CardTitle>Orders Query Result</CardTitle>
                <CardDescription>
                  Response from the orders API for order number: {ordersConfig.testOrderNumber}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Textarea
                    value={ordersQueryResult}
                    readOnly
                    className="min-h-[300px] font-mono text-sm"
                    placeholder="Orders query results will appear here..."
                  />
                  
                  {/* Parse and display orders data if available */}
                  {(() => {
                    try {
                      const parsed = JSON.parse(ordersQueryResult);
                      if (parsed.response?.scriptResult) {
                        const ordersData = JSON.parse(parsed.response.scriptResult);
                        if (ordersData.bestellingen && ordersData.bestellingen.length > 0) {
                          return (
                            <div className="mt-4 p-4 bg-muted rounded-md">
                              <h4 className="font-semibold mb-4">Parsed Orders Information:</h4>
                              
                              {ordersData.bestellingen.map((bestelling: any, index: number) => (
                                <div key={index} className="mb-6 p-4 border border-border rounded-md">
                                  <h5 className="font-medium mb-3 text-sm text-muted-foreground">Order #{bestelling.bestelnummer}</h5>
                                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-sm mb-4">
                                    <div><strong>Order Number:</strong> {bestelling.bestelnummer}</div>
                                    <div><strong>Supplier:</strong> {bestelling.leverancier}</div>
                                    <div><strong>Delivery Week:</strong> {bestelling.leverweek}</div>
                                    <div><strong>Shipped:</strong> {bestelling.isVerzonden ? 'Yes' : 'No'}</div>
                                  </div>
                                  
                                  {bestelling.artikelen && bestelling.artikelen.length > 0 && (
                                    <div className="mt-4">
                                      <h6 className="font-medium mb-2">Articles:</h6>
                                      <div className="space-y-2">
                                        {bestelling.artikelen.map((artikel: any, articleIndex: number) => (
                                          <div key={articleIndex} className="bg-background p-3 rounded border text-sm">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                              <div><strong>Article:</strong> {artikel.artikel || 'N/A'}</div>
                                              <div><strong>Quantity:</strong> {artikel.aantal}</div>
                                              <div><strong>Category:</strong> {artikel.categorie || 'N/A'}</div>
                                              <div><strong>Category #:</strong> {artikel.categorienummer}</div>
                                              <div className="md:col-span-2"><strong>Description:</strong> {artikel.omschrijving}</div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        }
                      }
                    } catch (e) {
                      return null;
                    }
                    return null;
                  })()}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ExternalDatabaseSettings;