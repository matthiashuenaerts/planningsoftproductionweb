import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Database, Save, RotateCcw, AlertTriangle, ExternalLink, CheckCircle, Copy } from 'lucide-react';

interface SupabaseConfig {
  url: string;
  anonKey: string;
}

const DEFAULT_CONFIG: SupabaseConfig = {
  url: 'https://pqzfmphitzlgwnmexrbx.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxemZtcGhpdHpsZ3dubWV4cmJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNDcxMDIsImV4cCI6MjA2MDcyMzEwMn0.SmvaZXSXKXeru3vuQY8XBlcNmpHyaZmAUk-bObZQQC4'
};

const STORAGE_KEY = 'supabase_connection_config';

const SupabaseConnectionSettings: React.FC = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState<SupabaseConfig>(DEFAULT_CONFIG);
  const [savedConfig, setSavedConfig] = useState<SupabaseConfig>(DEFAULT_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);
  const [isCustomConfig, setIsCustomConfig] = useState(false);

  useEffect(() => {
    // Load saved configuration from localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as SupabaseConfig;
        setConfig(parsed);
        setSavedConfig(parsed);
        setIsCustomConfig(parsed.url !== DEFAULT_CONFIG.url || parsed.anonKey !== DEFAULT_CONFIG.anonKey);
      } catch (e) {
        console.error('Failed to parse saved Supabase config:', e);
      }
    }
  }, []);

  useEffect(() => {
    // Check if there are unsaved changes
    setHasChanges(
      config.url !== savedConfig.url || 
      config.anonKey !== savedConfig.anonKey
    );
  }, [config, savedConfig]);

  const handleSave = () => {
    // Validate URL format
    try {
      new URL(config.url);
    } catch {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid Supabase URL',
        variant: 'destructive'
      });
      return;
    }

    // Validate anon key (basic check)
    if (!config.anonKey || config.anonKey.length < 50) {
      toast({
        title: 'Invalid Anon Key',
        description: 'Please enter a valid Supabase anon key',
        variant: 'destructive'
      });
      return;
    }

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    setSavedConfig(config);
    setIsCustomConfig(config.url !== DEFAULT_CONFIG.url || config.anonKey !== DEFAULT_CONFIG.anonKey);

    toast({
      title: 'Configuration Saved',
      description: 'Supabase connection settings have been saved. Please refresh the page to apply changes.',
    });
  };

  const handleResetToDefault = () => {
    setConfig(DEFAULT_CONFIG);
    localStorage.removeItem(STORAGE_KEY);
    setSavedConfig(DEFAULT_CONFIG);
    setIsCustomConfig(false);

    toast({
      title: 'Reset to Default',
      description: 'Supabase connection has been reset to the default configuration. Please refresh the page to apply changes.',
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: `${label} copied to clipboard`,
    });
  };

  const extractProjectRef = (url: string) => {
    try {
      const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
      return match ? match[1] : 'Unknown';
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Supabase Connection
          </CardTitle>
          <CardDescription>
            Configure the Supabase database connection. Changes require a page refresh to take effect.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Status */}
          <div className="p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center gap-2 mb-2">
              {isCustomConfig ? (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              <span className="font-medium">
                {isCustomConfig ? 'Custom Configuration' : 'Default Configuration'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Project Reference: <code className="bg-background px-1 rounded">{extractProjectRef(savedConfig.url)}</code>
            </p>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> Changing the Supabase connection will switch to a different database. 
              Make sure the new database has the same schema structure, or the application may not work correctly.
            </AlertDescription>
          </Alert>

          {/* Configuration Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supabase-url">Supabase URL</Label>
              <div className="flex gap-2">
                <Input
                  id="supabase-url"
                  type="url"
                  placeholder="https://your-project.supabase.co"
                  value={config.url}
                  onChange={(e) => setConfig({ ...config, url: e.target.value })}
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(config.url, 'URL')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The URL of your Supabase project (e.g., https://xxxx.supabase.co)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="anon-key">Anon Key (Public)</Label>
              <div className="flex gap-2">
                <Input
                  id="anon-key"
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  value={config.anonKey}
                  onChange={(e) => setConfig({ ...config, anonKey: e.target.value })}
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(config.anonKey, 'Anon Key')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The anonymous (public) API key for your Supabase project
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button 
              onClick={handleSave} 
              disabled={!hasChanges}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Configuration
            </Button>
            <Button 
              variant="outline" 
              onClick={handleResetToDefault}
              disabled={!isCustomConfig}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset to Default
            </Button>
          </div>

          {hasChanges && (
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                You have unsaved changes. Save and refresh the page to apply the new configuration.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How to Connect a Different Database</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Go to your Supabase project dashboard</li>
            <li>Navigate to <strong>Settings → API</strong></li>
            <li>Copy the <strong>Project URL</strong> and <strong>anon public</strong> key</li>
            <li>Paste them in the fields above and save</li>
            <li>Refresh the page to connect to the new database</li>
          </ol>
          
          <div className="pt-4">
            <Button variant="outline" asChild>
              <a 
                href="https://supabase.com/dashboard" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open Supabase Dashboard
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupabaseConnectionSettings;
