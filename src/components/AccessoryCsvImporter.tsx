
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { accessoriesService, Accessory } from '@/services/accessoriesService';
import { Upload } from 'lucide-react';

interface AccessoryCsvImporterProps {
  projectId: string;
  onImportSuccess: () => void;
}

type CsvAccessory = Partial<Omit<Accessory, 'id' | 'created_at' | 'updated_at' | 'project_id'>>;

const AccessoryCsvImporter: React.FC<AccessoryCsvImporterProps> = ({ projectId, onImportSuccess }) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: CsvAccessory[] = XLSX.utils.sheet_to_json(worksheet, {
          raw: true,
          defval: null,
        });

        if (json.length === 0) {
          toast({ title: 'Warning', description: 'CSV file is empty or invalid.', variant: 'default' });
          setLoading(false);
          return;
        }

        const accessoriesToCreate = json.map(item => ({
          project_id: projectId,
          article_name: item.article_name || '',
          article_description: item.article_description,
          article_code: item.article_code,
          quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
          stock_location: item.stock_location,
          status: item.status || 'to_check',
          supplier: item.supplier,
          qr_code_text: item.qr_code_text,
        }));

        for (const acc of accessoriesToCreate) {
          if (!acc.article_name) {
            throw new Error("CSV is missing required 'article_name' column or some rows have an empty value for it.");
          }
        }

        const accessoriesToInsert = accessoriesToCreate as Omit<Accessory, 'id' | 'created_at' | 'updated_at'>[];

        await accessoriesService.createMany(accessoriesToInsert);

        toast({ title: 'Success', description: `${accessoriesToCreate.length} accessories imported successfully.` });
        onImportSuccess();
      } catch (error: any) {
        console.error('CSV Import Error:', error);
        toast({
          title: 'Error',
          description: `Failed to import accessories: ${error.message}`,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <Upload className="h-8 w-8 text-gray-500" />
        <Label>Import Accessories from CSV/Excel</Label>
        <p className="text-xs text-muted-foreground">Required: article_name. Optional: article_description, article_code, quantity, stock_location, status, supplier, qr_code_text.</p>
        <Input 
          id="csv-importer" 
          type="file" 
          accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
          onChange={handleFileChange}
          ref={fileInputRef}
          className="hidden"
        />
        <Button onClick={() => fileInputRef.current?.click()} disabled={loading} className="mt-2">
          {loading ? 'Importing...' : 'Select File'}
        </Button>
      </div>
    </div>
  );
};

export default AccessoryCsvImporter;
