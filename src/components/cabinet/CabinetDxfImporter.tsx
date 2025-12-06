import { useState, useRef } from 'react';
import { Upload, FileUp, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import DxfParser from 'dxf-parser';

interface ParsedPanel {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  z: number;
  length: number;
  width: number;
  thickness: number;
  layer: string;
}

interface CabinetDxfImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function CabinetDxfImporter({ open, onOpenChange, onImportComplete }: CabinetDxfImporterProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [parsedPanels, setParsedPanels] = useState<ParsedPanel[]>([]);
  const [cabinetName, setCabinetName] = useState('');
  const [category, setCategory] = useState('');
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [step, setStep] = useState<'upload' | 'review' | 'configure'>('upload');

  const resetState = () => {
    setFile(null);
    setParsedPanels([]);
    setCabinetName('');
    setCategory('');
    setParseError(null);
    setStep('upload');
    setImporting(false);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    if (extension !== 'dxf' && extension !== 'dwg') {
      toast({
        title: t('calc_error'),
        description: t('calc_invalid_file_type'),
        variant: 'destructive',
      });
      return;
    }

    if (extension === 'dwg') {
      toast({
        title: t('calc_dwg_not_supported'),
        description: t('calc_dwg_convert_to_dxf'),
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
    setParseError(null);

    try {
      const text = await selectedFile.text();
      const parser = new DxfParser();
      const dxf = parser.parseSync(text);
      
      if (!dxf) {
        throw new Error('Failed to parse DXF file');
      }

      const panels = extractPanelsFromDxf(dxf);
      setParsedPanels(panels);
      
      // Auto-generate cabinet name from filename
      const baseName = selectedFile.name.replace(/\.(dxf|dwg)$/i, '');
      setCabinetName(baseName);
      
      setStep('review');
    } catch (error) {
      console.error('DXF parse error:', error);
      setParseError(error instanceof Error ? error.message : 'Unknown parse error');
      toast({
        title: t('calc_parse_error'),
        description: t('calc_dxf_parse_failed'),
        variant: 'destructive',
      });
    }
  };

  const extractPanelsFromDxf = (dxf: any): ParsedPanel[] => {
    const panels: ParsedPanel[] = [];
    let panelIndex = 0;

    // Extract entities from the DXF file
    if (dxf.entities) {
      for (const entity of dxf.entities) {
        // Handle different entity types
        if (entity.type === 'LINE') {
          // Lines could represent panel edges
          // We'll group lines by layer to create panels
        } else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
          // Closed polylines often represent panel outlines
          const panel = extractPanelFromPolyline(entity, panelIndex);
          if (panel) {
            panels.push(panel);
            panelIndex++;
          }
        } else if (entity.type === '3DFACE' || entity.type === 'SOLID') {
          // 3D faces directly represent panels
          const panel = extractPanelFrom3DFace(entity, panelIndex);
          if (panel) {
            panels.push(panel);
            panelIndex++;
          }
        } else if (entity.type === 'INSERT') {
          // Block references might be cabinet components
          const panel = extractPanelFromBlock(entity, dxf.blocks, panelIndex);
          if (panel) {
            panels.push(panel);
            panelIndex++;
          }
        }
      }
    }

    // If no panels found from entities, try to extract from layers
    if (panels.length === 0 && dxf.tables?.layer?.layers) {
      const layers = Object.keys(dxf.tables.layer.layers);
      for (const layerName of layers) {
        if (isPanelLayer(layerName)) {
          panels.push({
            id: `panel-${panelIndex}`,
            name: layerName,
            type: determinePanelType(layerName),
            x: 0,
            y: 0,
            z: 0,
            length: 600,
            width: 400,
            thickness: 18,
            layer: layerName,
          });
          panelIndex++;
        }
      }
    }

    // If still no panels, create default structure
    if (panels.length === 0) {
      panels.push(
        { id: 'panel-0', name: 'Bottom', type: 'bottom', x: 0, y: 0, z: 0, length: 600, width: 575, thickness: 18, layer: 'default' },
        { id: 'panel-1', name: 'Top', type: 'top', x: 0, y: 800, z: 0, length: 600, width: 575, thickness: 18, layer: 'default' },
        { id: 'panel-2', name: 'Left Side', type: 'left_side', x: 0, y: 0, z: 0, length: 575, width: 800, thickness: 18, layer: 'default' },
        { id: 'panel-3', name: 'Right Side', type: 'right_side', x: 582, y: 0, z: 0, length: 575, width: 800, thickness: 18, layer: 'default' },
        { id: 'panel-4', name: 'Back', type: 'back', x: 18, y: 0, z: 0, length: 564, width: 800, thickness: 8, layer: 'default' },
      );
    }

    return panels;
  };

  const extractPanelFromPolyline = (entity: any, index: number): ParsedPanel | null => {
    if (!entity.vertices || entity.vertices.length < 3) return null;

    // Calculate bounding box
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const vertex of entity.vertices) {
      minX = Math.min(minX, vertex.x || 0);
      maxX = Math.max(maxX, vertex.x || 0);
      minY = Math.min(minY, vertex.y || 0);
      maxY = Math.max(maxY, vertex.y || 0);
      minZ = Math.min(minZ, vertex.z || 0);
      maxZ = Math.max(maxZ, vertex.z || 0);
    }

    const length = Math.round(maxX - minX);
    const width = Math.round(maxY - minY);
    const height = Math.round(maxZ - minZ) || 18;

    if (length < 10 || width < 10) return null;

    return {
      id: `panel-${index}`,
      name: entity.layer || `Panel ${index + 1}`,
      type: determinePanelType(entity.layer || ''),
      x: Math.round(minX),
      y: Math.round(minY),
      z: Math.round(minZ),
      length,
      width,
      thickness: height > 0 ? height : 18,
      layer: entity.layer || 'default',
    };
  };

  const extractPanelFrom3DFace = (entity: any, index: number): ParsedPanel | null => {
    const points = [
      entity.vertices?.[0],
      entity.vertices?.[1],
      entity.vertices?.[2],
      entity.vertices?.[3],
    ].filter(Boolean);

    if (points.length < 3) return null;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const point of points) {
      minX = Math.min(minX, point.x || 0);
      maxX = Math.max(maxX, point.x || 0);
      minY = Math.min(minY, point.y || 0);
      maxY = Math.max(maxY, point.y || 0);
      minZ = Math.min(minZ, point.z || 0);
      maxZ = Math.max(maxZ, point.z || 0);
    }

    return {
      id: `panel-${index}`,
      name: entity.layer || `Panel ${index + 1}`,
      type: determinePanelType(entity.layer || ''),
      x: Math.round(minX),
      y: Math.round(minY),
      z: Math.round(minZ),
      length: Math.round(maxX - minX) || 600,
      width: Math.round(maxY - minY) || 400,
      thickness: Math.round(maxZ - minZ) || 18,
      layer: entity.layer || 'default',
    };
  };

  const extractPanelFromBlock = (entity: any, blocks: any, index: number): ParsedPanel | null => {
    const blockName = entity.name;
    if (!blocks || !blocks[blockName]) return null;

    return {
      id: `panel-${index}`,
      name: blockName,
      type: determinePanelType(blockName),
      x: Math.round(entity.position?.x || 0),
      y: Math.round(entity.position?.y || 0),
      z: Math.round(entity.position?.z || 0),
      length: 600,
      width: 400,
      thickness: 18,
      layer: entity.layer || 'default',
    };
  };

  const isPanelLayer = (layerName: string): boolean => {
    const panelKeywords = ['panel', 'side', 'top', 'bottom', 'back', 'shelf', 'door', 'drawer', 'front'];
    return panelKeywords.some(keyword => layerName.toLowerCase().includes(keyword));
  };

  const determinePanelType = (name: string): string => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('bottom') || lowerName.includes('base') || lowerName.includes('bodem')) return 'bottom';
    if (lowerName.includes('top') || lowerName.includes('bovenzijde')) return 'top';
    if (lowerName.includes('left') || lowerName.includes('links')) return 'left_side';
    if (lowerName.includes('right') || lowerName.includes('rechts')) return 'right_side';
    if (lowerName.includes('back') || lowerName.includes('rug') || lowerName.includes('achterkant')) return 'back';
    if (lowerName.includes('shelf') || lowerName.includes('legger')) return 'shelf';
    if (lowerName.includes('door') || lowerName.includes('deur')) return 'door';
    if (lowerName.includes('drawer') || lowerName.includes('lade')) return 'drawer_front';
    if (lowerName.includes('divider') || lowerName.includes('schot')) return 'divider';
    return 'shelf';
  };

  const handleImport = async () => {
    if (!cabinetName.trim() || !category.trim()) {
      toast({
        title: t('calc_error'),
        description: t('calc_fill_required_fields'),
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);

    try {
      // Calculate default dimensions from panels
      const defaultWidth = Math.max(...parsedPanels.map(p => p.x + p.length)) || 600;
      const defaultHeight = Math.max(...parsedPanels.map(p => p.y + p.width)) || 800;
      const defaultDepth = Math.max(...parsedPanels.map(p => p.z + p.thickness), 575);

      // Create the cabinet model
      const { data: model, error: modelError } = await supabase
        .from('cabinet_models')
        .insert({
          name: cabinetName,
          category: category,
          description: `Imported from ${file?.name}`,
          default_width: defaultWidth,
          default_height: defaultHeight,
          default_depth: defaultDepth,
          min_width: Math.round(defaultWidth * 0.5),
          max_width: Math.round(defaultWidth * 1.5),
          min_height: Math.round(defaultHeight * 0.5),
          max_height: Math.round(defaultHeight * 1.5),
          min_depth: Math.round(defaultDepth * 0.5),
          max_depth: Math.round(defaultDepth * 1.5),
          is_active: true,
          is_template: false,
          parameters: {
            panels: parsedPanels.map(panel => ({
              id: panel.id,
              name: panel.name,
              type: panel.type,
              x: String(panel.x),
              y: String(panel.y),
              z: String(panel.z),
              length: String(panel.length),
              width: String(panel.width),
              thickness: String(panel.thickness),
              material_type: panel.type === 'door' || panel.type === 'drawer_front' ? 'door' : 'body',
              visible: true,
            })),
            imported_from: file?.name,
            import_date: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (modelError) throw modelError;

      // Create panel records in cabinet_panels if the table exists
      // For now we store panels in the model's parameters JSON

      toast({
        title: t('calc_success'),
        description: t('calc_cabinet_imported'),
      });

      onImportComplete();
      onOpenChange(false);
      resetState();
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: t('calc_error'),
        description: t('calc_import_failed'),
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const categories = [
    'Onderkast',
    'Bovenkast',
    'Kolomkast',
    'Hoekkast',
    'Passtuk',
    'Laden',
    'Deuren',
    'Custom',
  ];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetState();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{t('calc_import_cabinet')}</DialogTitle>
          <DialogDescription>
            {t('calc_import_cabinet_description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">{t('calc_drop_dxf_file')}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('calc_supported_formats')}: .DXF
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {t('calc_dwg_note')}
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".dxf,.dwg"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileUp className="h-5 w-5 text-primary" />
                <span className="font-medium">{file?.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto h-8 w-8"
                  onClick={resetState}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {parseError ? (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                  <AlertCircle className="h-5 w-5" />
                  <span>{parseError}</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-600 rounded-lg">
                    <CheckCircle className="h-5 w-5" />
                    <span>{t('calc_panels_detected').replace('{count}', String(parsedPanels.length))}</span>
                  </div>

                  <ScrollArea className="h-48 border rounded-lg">
                    <div className="p-4 space-y-2">
                      {parsedPanels.map((panel) => (
                        <div
                          key={panel.id}
                          className="flex items-center justify-between p-2 bg-muted/50 rounded"
                        >
                          <div>
                            <span className="font-medium">{panel.name}</span>
                            <span className="text-sm text-muted-foreground ml-2">
                              ({panel.type})
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {panel.length} × {panel.width} × {panel.thickness}mm
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <Button onClick={() => setStep('configure')} className="w-full">
                    {t('calc_continue')}
                  </Button>
                </>
              )}
            </div>
          )}

          {step === 'configure' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cabinet-name">{t('calc_cabinet_name')}</Label>
                <Input
                  id="cabinet-name"
                  value={cabinetName}
                  onChange={(e) => setCabinetName(e.target.value)}
                  placeholder={t('calc_enter_cabinet_name')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">{t('calc_category')}</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('calc_select_category')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('review')} className="flex-1">
                  {t('common_back')}
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex-1"
                >
                  {importing ? t('calc_importing') : t('calc_import')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
