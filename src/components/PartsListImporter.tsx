
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { partsListService } from '@/services/partsListService';
import { csvImportConfigService, CsvImportConfig } from '@/services/csvImportConfigService';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface PartsListImporterProps {
  projectId: string;
  onImportComplete?: () => void;
}

export const PartsListImporter: React.FC<PartsListImporterProps> = ({
  projectId,
  onImportComplete
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<CsvImportConfig[]>([]);
  const [showMappings, setShowMappings] = useState(false);
  const { toast } = useToast();
  const { currentEmployee } = useAuth();
  const isAdmin = currentEmployee?.role === 'admin';

  useEffect(() => {
    loadMappings();
  }, []);

  const loadMappings = async () => {
    try {
      const configs = await csvImportConfigService.getConfigs();
      setColumnMappings(configs);
    } catch (error) {
      console.error('Error loading CSV mappings:', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setValidationErrors([]);
    setPreviewData([]);
    
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        setValidationErrors(['Please select a CSV file']);
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setValidationErrors(['File size must be less than 5MB']);
        return;
      }
      
      setSelectedFile(file);
      previewCSV(file);
    }
  };

  const previewCSV = async (file: File) => {
    try {
      const text = await file.text();
      // Use semicolon as delimiter
      const lines = text.split('\n').slice(0, 6); // First 6 lines for preview
      const rows = lines.map(line => line.split(';').map(cell => cell.trim()));
      
      setPreviewData(rows);
      
      // Basic validation using dynamic config
      const errors: string[] = [];
      if (rows.length < 2) {
        errors.push('CSV must contain at least a header row and one data row');
      }
      
      // Get required headers from config
      const requiredHeaders = columnMappings.filter(c => c.is_required).map(c => c.csv_header);
      const headers = rows[0] || [];
      const missingHeaders = requiredHeaders.filter(header => 
        !headers.some(h => h.toLowerCase() === header.toLowerCase())
      );
      
      if (missingHeaders.length > 0) {
        errors.push(`Missing required headers: ${missingHeaders.join(', ')}`);
      }
      
      setValidationErrors(errors);
    } catch (error) {
      setValidationErrors(['Failed to read CSV file']);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast({
        title: 'No file selected',
        description: 'Please select a CSV file to import',
        variant: 'destructive'
      });
      return;
    }

    setIsImporting(true);

    try {
      const csvContent = await selectedFile.text();
      
      // Import as project-wide parts list (no specific task)
      await partsListService.importPartsFromCSV(
        projectId,
        null, // No specific task - project-wide
        csvContent,
        selectedFile.name,
        currentEmployee?.id
      );

      toast({
        title: 'Import successful',
        description: `Parts list "${selectedFile.name}" has been imported successfully`
      });

      // Reset form
      setSelectedFile(null);
      setPreviewData([]);
      setValidationErrors([]);
      
      // Reset file input
      const fileInput = document.getElementById('csv-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      onImportComplete?.();
    } catch (error) {
      console.error('Error importing parts list:', error);
      toast({
        title: 'Import failed',
        description: 'Failed to import parts list. Please check the file format.',
        variant: 'destructive'
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Get headers from dynamic config
  const expectedHeaders = columnMappings.map(c => c.csv_header);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Parts List from CSV (Project-wide)
          </CardTitle>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/settings?tab=csv-import'}
            >
              <Settings className="h-4 w-4 mr-1" />
              Configure Mappings
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csv-file-input">CSV File</Label>
            <Input
              id="csv-file-input"
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              disabled={isImporting}
            />
            <p className="text-sm text-muted-foreground">
              Maximum file size: 5MB. Semicolon-separated values (;) required.
            </p>
          </div>

          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {selectedFile && validationErrors.length === 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                File validated successfully. Ready to import.
              </AlertDescription>
            </Alert>
          )}

          {selectedFile && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded border">
              <FileText className="h-4 w-4" />
              <div className="flex-1">
                <span className="text-sm font-medium">{selectedFile.name}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            </div>
          )}

          <Button 
            onClick={handleImport} 
            disabled={!selectedFile || isImporting || validationErrors.length > 0}
            className="w-full"
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import Parts List
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* CSV Preview */}
      {previewData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>CSV Preview (First 5 rows)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-gray-300">
                <tbody>
                  {previewData.map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex === 0 ? 'bg-muted font-medium' : ''}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="border border-gray-300 px-2 py-1 max-w-32 truncate">
                          {cell || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expected Format Guide - Admin sees full mapping details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Expected CSV Format</span>
            {isAdmin && columnMappings.length > 0 && (
              <Collapsible open={showMappings} onOpenChange={setShowMappings}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {showMappings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    <span className="ml-1">{showMappings ? 'Hide' : 'Show'} Mappings</span>
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your CSV should include these headers (semicolon-separated):
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-xs">
              {expectedHeaders.map(header => {
                const mapping = columnMappings.find(m => m.csv_header === header);
                return (
                  <Badge 
                    key={header} 
                    variant={mapping?.is_required ? 'default' : 'outline'} 
                    className="text-xs"
                  >
                    {header}
                    {mapping?.is_required && ' *'}
                  </Badge>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              * Required fields. Other fields are optional but recommended.
            </p>

            {/* Admin-only: Detailed mapping table */}
            {isAdmin && (
              <Collapsible open={showMappings} onOpenChange={setShowMappings}>
                <CollapsibleContent>
                  <div className="mt-4 rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>CSV Header</TableHead>
                          <TableHead>Database Column</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-center">Required</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {columnMappings.map((mapping) => (
                          <TableRow key={mapping.id}>
                            <TableCell className="font-medium">{mapping.csv_header}</TableCell>
                            <TableCell className="font-mono text-xs">{mapping.db_column}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {mapping.description || '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              {mapping.is_required ? (
                                <Badge variant="default" className="text-xs">Required</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">Optional</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
