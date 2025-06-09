
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { partsListService } from '@/services/partsListService';
import { Upload, FileText, Loader2 } from 'lucide-react';
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
  const { toast } = useToast();
  const { currentEmployee } = useAuth();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        toast({
          title: 'Invalid file type',
          description: 'Please select a CSV file',
          variant: 'destructive'
        });
        return;
      }
      setSelectedFile(file);
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

      setSelectedFile(null);
      setSelectedTaskId('none');
      
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Import Parts List
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
            Expected format: Materiaal, Dikte, Nerf, Lengte, Breedte, Aantal, CNC pos, Wand Naam, etc.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-select">Link to Task (Optional)</Label>
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

        {selectedFile && (
          <div className="flex items-center gap-2 p-2 bg-muted rounded">
            <FileText className="h-4 w-4" />
            <span className="text-sm">{selectedFile.name}</span>
          </div>
        )}

        <Button 
          onClick={handleImport} 
          disabled={!selectedFile || isImporting}
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
  );
};
