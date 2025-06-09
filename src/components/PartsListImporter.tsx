
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { partsListService } from '@/services/partsListService';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface PartsListImporterProps {
  projectId: string;
  tasks: any[];
  onImportComplete?: () => void;
}

export const PartsListImporter: React.FC<PartsListImporterProps> = ({
  projectId,
  tasks,
  onImportComplete
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('none');
  const [isImporting, setIsImporting] = useState(false);
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const { toast } = useToast();
  const { currentEmployee } = useAuth();

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
      const lines = text.split('\n').slice(0, 6); // First 6 lines for preview
      const rows = lines.map(line => line.split('\t').map(cell => cell.trim()));
      
      setPreviewData(rows);
      
      // Basic validation
      const errors: string[] = [];
      if (rows.length < 2) {
        errors.push('CSV must contain at least a header row and one data row');
      }
      
      const expectedHeaders = ['Materiaal', 'Dikte', 'Nerf', 'Lengte', 'Breedte', 'Aantal'];
      const headers = rows[0] || [];
      const missingHeaders = expectedHeaders.filter(header => 
        !headers.some(h => h.toLowerCase().includes(header.toLowerCase()))
      );
      
      if (missingHeaders.length > 0) {
        errors.push(`Missing recommended headers: ${missingHeaders.join(', ')}`);
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
      
      await partsListService.importPartsFromCSV(
        projectId,
        selectedTaskId === 'none' ? null : selectedTaskId,
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
      setSelectedTaskId('none');
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

  const expectedHeaders = [
    'Materiaal', 'Dikte', 'Nerf', 'Lengte', 'Breedte', 'Aantal', 
    'CNC pos', 'Wand Naam', 'Afplak Boven', 'Afplak Onder', 
    'Afplak Links', 'Afplak Rechts', 'Commentaar', 'Commentaar 2',
    'CNCPRG1', 'CNCPRG2', 'ABD', 'Afbeelding', 'Doorlopende nerf'
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Parts List from CSV
          </CardTitle>
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
              Maximum file size: 5MB. Tab-separated values preferred.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-select">Associate with Task (Optional)</Label>
            <Select value={selectedTaskId} onValueChange={setSelectedTaskId} disabled={isImporting}>
              <SelectTrigger>
                <SelectValue placeholder="Select a task (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific task</SelectItem>
                {tasks.map(task => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      {/* Expected Format Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Expected CSV Format</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Your CSV should include these headers (tab-separated):
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-xs">
              {expectedHeaders.map(header => (
                <Badge key={header} variant="outline" className="text-xs">
                  {header}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Required fields: Materiaal, Aantal. Other fields are optional but recommended.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
