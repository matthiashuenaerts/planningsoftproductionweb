import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, XCircle, Database, Key, Search } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

const ExternalDatabaseSettings: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testingQuery, setTestingQuery] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [token, setToken] = useState<string>('');
  const [queryResult, setQueryResult] = useState<string>('');
  
  const [config, setConfig] = useState({
    baseUrl: 'https://app.thonon.be/fmi/data/vLatest/databases/CrownBasePro-Thonon',
    username: '',
    password: '',
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
    
    try {
      const response = await fetch(`${config.baseUrl}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${config.username}:${config.password}`)}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.response && data.response.token) {
        setToken(data.response.token);
        setConnectionStatus('success');
        toast({
          title: "Connection Successful",
          description: "Successfully authenticated and received token",
        });
      } else {
        throw new Error('No token received from API');
      }
    } catch (error) {
      setConnectionStatus('error');
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect to external database",
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
    
    try {
      const response = await fetch(
        `${config.baseUrl}/layouts/API_order/script/FindOrderNumber?script.param=${config.testOrderNumber}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setQueryResult(JSON.stringify(data, null, 2));
      
      toast({
        title: "Query Successful",
        description: "Successfully retrieved order data",
      });
    } catch (error) {
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
            <CardDescription>Response from the external database</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={queryResult}
              readOnly
              className="min-h-[200px] font-mono text-sm"
              placeholder="Query results will appear here..."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ExternalDatabaseSettings;