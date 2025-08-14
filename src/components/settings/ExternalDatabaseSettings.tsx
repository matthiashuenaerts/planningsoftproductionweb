import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Database, Key, Search, RefreshCw } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

const ExternalDatabaseSettings: React.FC = () => {
  const { toast } = useToast();
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

  const handleConfigChange = (field: string, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
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
    
    console.log('Starting manual project sync with connection configuration...');
    console.log('Using credentials:', { username: 'Matthias HUENAERTS', baseUrl: 'https://app.thonon.be/fmi/data/vLatest/databases/CrownBasePro-Thonon' });
    
    try {
      const response = await fetch('https://pqzfmphitzlgwnmexrbx.supabase.co/functions/v1/project-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxemZtcGhpdHpsZ3dubWV4cmJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNDcxMDIsImV4cCI6MjA2MDcyMzEwMn0.SmvaZXSXKXeru3vuQY8XBlcNmpHyaZmAUk-bObZQQC4`
        },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          config: {
            baseUrl: 'https://app.thonon.be/fmi/data/vLatest/databases/CrownBasePro-Thonon',
            username: 'Matthias HUENAERTS',
            password: '8pJ1A24z'
          }
        })
      });

      console.log('Sync response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Sync error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Sync response data:', data);
      setSyncResult(JSON.stringify(data, null, 2));
      
      toast({
        title: "Sync Completed",
        description: data.message || "Project synchronization completed successfully",
      });
    } catch (error) {
      console.error('Sync error details:', error);
      console.error('Error type:', typeof error);
      console.error('Error constructor:', error?.constructor?.name);
      
      const errorMessage = error instanceof Error ? error.message : "Failed to sync projects";
      const errorDetails = JSON.stringify(error, null, 2);
      
      setSyncResult(`Error: ${errorMessage}\n\nFull error details:\n${errorDetails}`);
      
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
      // Here you would typically save to your backend/Supabase
      // For now, we'll just simulate saving
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">External Database API Connection</h2>
        <p className="text-muted-foreground">
          Configure connection to external FileMaker database for data synchronization
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Connection Configuration
          </CardTitle>
          <CardDescription>
            Set up authentication details for the external FileMaker database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="baseUrl">Base URL</Label>
              <Input
                id="baseUrl"
                value={config.baseUrl}
                onChange={(e) => handleConfigChange('baseUrl', e.target.value)}
                placeholder="https://app.thonon.be/fmi/data/vLatest/databases/CrownBasePro-Thonon"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={config.username}
                onChange={(e) => handleConfigChange('username', e.target.value)}
                placeholder="Enter username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={config.password}
                onChange={(e) => handleConfigChange('password', e.target.value)}
                placeholder="Enter password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="testOrderNumber">Test Order Number</Label>
              <Input
                id="testOrderNumber"
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
              onClick={() => {
                setConfig(prev => ({ ...prev, testOrderNumber: '24000079' }));
                setTimeout(() => testQuery(), 100);
              }}
              disabled={testingQuery || !token}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Search className="h-4 w-4" />
              Query Order 24000079
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
                      return (
                        <div className="mt-4 p-4 bg-muted rounded-md">
                          <h4 className="font-semibold mb-2">Parsed Order Information:</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div><strong>Order Number:</strong> {orderData.order.ordernummer}</div>
                            <div><strong>Client:</strong> {orderData.order.klant}</div>
                            <div><strong>Order Type:</strong> {orderData.order.ordertype}</div>
                            <div><strong>Order Date:</strong> {orderData.order.orderdatum}</div>
                            <div><strong>Address:</strong> {orderData.order.adres}</div>
                            <div><strong>Processor:</strong> {orderData.order.orderverwerker}</div>
                            <div><strong>Placement Date:</strong> {orderData.order.plaatsingsdatum}</div>
                            <div><strong>Reference:</strong> {orderData.order.referentie}</div>
                          </div>
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
    </div>
  );
};

export default ExternalDatabaseSettings;