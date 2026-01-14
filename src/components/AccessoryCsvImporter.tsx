import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { accessoriesService, Accessory } from '@/services/accessoriesService';
import { csvImportConfigService, CsvImportConfig } from '@/services/csvImportConfigService';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface AccessoryCsvImporterProps {
  projectId: string;
  onImportSuccess: () => void;
}

type CsvAccessory = Partial<Omit<Accessory, 'id' | 'created_at' | 'updated_at' | 'project_id'>>;

const AccessoryCsvImporter: React.FC<AccessoryCsvImporterProps> = ({ projectId, onImportSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [columnMappings, setColumnMappings] = useState<CsvImportConfig[]>([]);
  const [showMappings, setShowMappings] = useState(false);
  const { toast } = useToast();
  const { currentEmployee } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = currentEmployee?.role === 'admin';

  useEffect(() => {
    loadMappings();
  }, []);

  const loadMappings = async () => {
    try {
      const configs = await csvImportConfigService.getConfigs('accessories');
      setColumnMappings(configs);
    } catch (error) {
      console.error('Error loading CSV mappings:', error);
    }
  };

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
        
        // Get headers and build dynamic mapping
        const headerMap = await csvImportConfigService.getHeaderMap('accessories');
        
        // Convert to json with raw headers
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, {
          raw: true,
          defval: null,
        });

        if (rawJson.length === 0) {
          toast({ title: 'Warning', description: 'CSV file is empty or invalid.', variant: 'default' });
          setLoading(false);
          return;
        }

        // Map CSV columns to database columns using dynamic config
        const mappedJson: CsvAccessory[] = rawJson.map(row => {
          const mappedRow: any = {};
          for (const [csvHeader, dbColumn] of Object.entries(headerMap)) {
            // Check for exact match first, then case-insensitive
            let value = row[csvHeader];
            if (value === undefined) {
              // Try case-insensitive match
              const matchingKey = Object.keys(row).find(
                key => key.toLowerCase() === csvHeader.toLowerCase()
              );
              if (matchingKey) {
                value = row[matchingKey];
              }
            }
            if (value !== undefined && value !== null) {
              mappedRow[dbColumn] = value;
            }
          }
          return mappedRow;
        });

        // Fetch all products first to check against article codes
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('*');

        if (productsError) {
          console.error('Error fetching products:', productsError);
        }

        // Fetch all product groups with their items
        const { data: groups, error: groupsError } = await supabase
          .from('product_groups')
          .select('*');

        if (groupsError) {
          console.error('Error fetching product groups:', groupsError);
        }

        const { data: groupItems, error: groupItemsError } = await supabase
          .from('product_group_items')
          .select('group_id, product_id, quantity');

        if (groupItemsError) {
          console.error('Error fetching group items:', groupItemsError);
        }

        // Build maps for quick lookup
        const productsByCode = new Map();
        const productsById = new Map();
        if (products) {
          products.forEach(product => {
            productsById.set(product.id, product);
            if (product.article_code) {
              productsByCode.set(product.article_code.toLowerCase(), product);
            }
          });
        }

        // Build group lookup by article_code and name
        const groupsByCode = new Map();
        const groupsByName = new Map();
        if (groups) {
          groups.forEach(group => {
            if (group.article_code) {
              groupsByCode.set(group.article_code.toLowerCase(), group);
            }
            groupsByName.set(group.name.toLowerCase(), group);
          });
        }

        // Build group items map
        const groupItemsMap = new Map<string, Array<{ product_id: string; quantity: number }>>();
        if (groupItems) {
          groupItems.forEach(item => {
            if (!groupItemsMap.has(item.group_id)) {
              groupItemsMap.set(item.group_id, []);
            }
            groupItemsMap.get(item.group_id)!.push({ product_id: item.product_id, quantity: item.quantity });
          });
        }

        const accessoriesToCreate: Array<Omit<Accessory, 'id' | 'created_at' | 'updated_at'>> = [];
        
        // Map to aggregate quantities for identical article codes that match database products
        const productAggregator = new Map<string, {
          product: any;
          quantity: number;
          stockLocation?: string;
          status?: string;
        }>();

        for (const item of mappedJson) {
          const importedQuantity = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
          const articleCode = item.article_code ? String(item.article_code).toLowerCase() : '';
          const articleName = item.article_name ? String(item.article_name).toLowerCase() : '';

          // First check if it's a group product (by article_code or name)
          const matchedGroup = articleCode && groupsByCode.has(articleCode) 
            ? groupsByCode.get(articleCode) 
            : articleName && groupsByName.has(articleName) 
              ? groupsByName.get(articleName) 
              : null;

          if (matchedGroup) {
            // It's a group - add all products from the group
            const items = groupItemsMap.get(matchedGroup.id) || [];
            for (const groupItem of items) {
              const product = productsById.get(groupItem.product_id);
              if (product) {
                const productKey = product.article_code?.toLowerCase() || product.id;
                const existing = productAggregator.get(productKey);
                const newQuantity = groupItem.quantity * importedQuantity;
                
                if (existing) {
                  existing.quantity += newQuantity;
                } else {
                  productAggregator.set(productKey, {
                    product: {
                      ...product,
                      description: product.description || `From group: ${matchedGroup.name}`,
                    },
                    quantity: newQuantity,
                    stockLocation: product.location || item.stock_location,
                    status: item.status || 'to_check',
                  });
                }
              }
            }
          } else if (articleCode && productsByCode.has(articleCode)) {
            // Check if article_code exists in products database - aggregate quantities
            const product = productsByCode.get(articleCode);
            const existing = productAggregator.get(articleCode);
            
            if (existing) {
              // Add to existing quantity
              existing.quantity += importedQuantity;
            } else {
              // First occurrence - add to aggregator
              productAggregator.set(articleCode, {
                product,
                quantity: importedQuantity,
                stockLocation: item.stock_location || product.location,
                status: item.status || 'to_check',
              });
            }
          } else {
            // Use CSV data as-is (no aggregation for non-database items)
            accessoriesToCreate.push({
              project_id: projectId,
              article_name: item.article_name || '',
              article_description: item.article_description,
              article_code: item.article_code,
              quantity: importedQuantity,
              stock_location: item.stock_location,
              status: item.status || 'to_check',
              supplier: item.supplier,
              qr_code_text: item.qr_code_text,
            });
          }
        }
        
        // Convert aggregated product entries to accessories
        for (const [, entry] of productAggregator) {
          accessoriesToCreate.push({
            project_id: projectId,
            article_name: entry.product.name,
            article_description: entry.product.description,
            article_code: entry.product.article_code,
            quantity: entry.quantity,
            stock_location: entry.stockLocation,
            status: (entry.status || 'to_check') as 'to_check' | 'to_order' | 'ordered' | 'in_stock' | 'delivered',
            supplier: entry.product.supplier,
            qr_code_text: entry.product.qr_code,
          });
        }

        for (const acc of accessoriesToCreate) {
          if (!acc.article_name) {
            throw new Error("CSV is missing required 'article_name' column or some rows have an empty value for it.");
          }
        }

        await accessoriesService.createMany(accessoriesToCreate);

        // Count matches
        const groupMatchCount = mappedJson.filter(item => {
          const code = item.article_code ? String(item.article_code).toLowerCase() : '';
          const name = item.article_name ? String(item.article_name).toLowerCase() : '';
          return (code && groupsByCode.has(code)) || (name && groupsByName.has(name));
        }).length;

        const productMatchCount = mappedJson.filter(item => {
          const code = item.article_code ? String(item.article_code).toLowerCase() : '';
          return code && productsByCode.has(code) && !groupsByCode.has(code);
        }).length;

        let successMessage = `${accessoriesToCreate.length} accessories imported successfully.`;
        if (groupMatchCount > 0 || productMatchCount > 0) {
          const parts = [];
          if (productMatchCount > 0) parts.push(`${productMatchCount} matched with products`);
          if (groupMatchCount > 0) parts.push(`${groupMatchCount} expanded from group products`);
          successMessage += ` ${parts.join(', ')}.`;
        }

        toast({ title: 'Success', description: successMessage });
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

  const expectedHeaders = columnMappings.map(c => c.csv_header);

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-8 w-8 text-gray-500" />
          <Label>Import Accessories from CSV/Excel</Label>
          
          {/* Show expected headers from config */}
          <div className="flex flex-wrap gap-1 justify-center max-w-md">
            {expectedHeaders.slice(0, 4).map(header => {
              const mapping = columnMappings.find(m => m.csv_header === header);
              return (
                <Badge 
                  key={header} 
                  variant={mapping?.is_required ? 'default' : 'outline'} 
                  className="text-xs"
                >
                  {header}{mapping?.is_required && ' *'}
                </Badge>
              );
            })}
            {expectedHeaders.length > 4 && (
              <Badge variant="outline" className="text-xs">+{expectedHeaders.length - 4} more</Badge>
            )}
          </div>
          
          <Input 
            id="csv-importer" 
            type="file" 
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
            onChange={handleFileChange}
            ref={fileInputRef}
            className="hidden"
          />
          <div className="flex gap-2 mt-2">
            <Button onClick={() => fileInputRef.current?.click()} disabled={loading}>
              {loading ? 'Importing...' : 'Select File'}
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/settings?tab=csv-import')}
              >
                <Settings className="h-4 w-4 mr-1" />
                Configure
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Admin-only: Show current mappings */}
      {isAdmin && columnMappings.length > 0 && (
        <Collapsible open={showMappings} onOpenChange={setShowMappings}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              <span>View Current Column Mappings</span>
              {showMappings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CSV Header</TableHead>
                    <TableHead>Database Column</TableHead>
                    <TableHead className="text-center">Required</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {columnMappings.map((mapping) => (
                    <TableRow key={mapping.id}>
                      <TableCell className="font-medium">{mapping.csv_header}</TableCell>
                      <TableCell className="font-mono text-xs">{mapping.db_column}</TableCell>
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
  );
};

export default AccessoryCsvImporter;
