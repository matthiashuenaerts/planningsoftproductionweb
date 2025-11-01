import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import Navbar from '@/components/Navbar';

const MigrateAuth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const runMigration = async () => {
    if (!confirm('Are you sure you want to migrate all employees to Supabase Auth? This action will create auth users for all employees that don\'t have one yet.')) {
      return;
    }

    try {
      setLoading(true);
      setResults(null);

      const { data, error } = await supabase.functions.invoke('migrate-employees-to-auth', {
        body: {}
      });

      if (error) {
        throw error;
      }

      setResults(data);
      
      if (data.failed.length === 0) {
        toast({
          title: "Migration Successful",
          description: `Successfully migrated ${data.migrated} employees to Supabase Auth`
        });
      } else {
        toast({
          title: "Migration Completed with Errors",
          description: `Migrated ${data.migrated} employees, ${data.failed.length} failed`,
          variant: "destructive"
        });
      }

    } catch (error: any) {
      console.error('Migration error:', error);
      toast({
        title: "Migration Failed",
        description: error.message || "An error occurred during migration",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      <div className="w-full p-6 ml-64">
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold mb-6">Migrate to Supabase Authentication</h1>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> This tool will migrate all existing employees to use proper Supabase authentication. 
              Each employee will be assigned their email (or a generated one) and will keep their current password.
              After migration, all logins will use Supabase Auth, which is more secure and enables RLS policies.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Migration Steps</CardTitle>
              <CardDescription>
                This migration will perform the following actions:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-2">
                <li>Find all employees without a Supabase auth account</li>
                <li>Create a Supabase Auth user for each employee</li>
                <li>Link the auth user to the employee record via auth_user_id</li>
                <li>Ensure each employee has an email address (generate if missing)</li>
                <li>Keep existing passwords for seamless transition</li>
              </ol>

              <Button 
                onClick={runMigration} 
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Migrating...
                  </>
                ) : (
                  'Run Migration'
                )}
              </Button>
            </CardContent>
          </Card>

          {results && (
            <Card>
              <CardHeader>
                <CardTitle>Migration Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium text-green-900">Migrated</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600 mt-2">{results.migrated}</p>
                  </div>
                  
                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="text-sm font-medium text-red-900">Failed</span>
                    </div>
                    <p className="text-2xl font-bold text-red-600 mt-2">{results.failed}</p>
                  </div>
                  
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-5 w-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">Skipped</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600 mt-2">{results.skipped}</p>
                  </div>
                </div>

                {results.results && (
                  <div className="space-y-4">
                    {results.results.success && results.results.success.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-green-700 mb-2">Successfully Migrated:</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {results.results.success.map((name: string, index: number) => (
                            <li key={index} className="text-sm text-gray-700">{name}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {results.results.failed && results.results.failed.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-red-700 mb-2">Failed Migrations:</h4>
                        <ul className="space-y-2">
                          {results.results.failed.map((failure: any, index: number) => (
                            <li key={index} className="text-sm">
                              <span className="font-medium">{failure.name}:</span>{' '}
                              <span className="text-red-600">{failure.error}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {results.results.skipped && results.results.skipped.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-blue-700 mb-2">Skipped (Already Migrated):</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {results.results.skipped.map((name: string, index: number) => (
                            <li key={index} className="text-sm text-gray-700">{name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {results.migrated > 0 && (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <strong>Success!</strong> You can now enable RLS on all tables. 
                      All migrated employees can now log in using their email addresses and existing passwords.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle>Next Steps After Migration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ol className="list-decimal list-inside space-y-2">
                <li>Test logging in with a migrated employee account</li>
                <li>Enable RLS on all tables in your database</li>
                <li>Test all major features to ensure policies work correctly</li>
                <li>Remove the old <code>authenticate_employee</code> RPC function if no longer needed</li>
                <li>Update password management to use Supabase's built-in password reset</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MigrateAuth;