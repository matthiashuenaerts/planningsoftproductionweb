import { useMemo, useState } from 'react';
import { ParametricPanel } from '@/types/cabinet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface CabinetFront {
  id: string;
  name: string;
  front_type: string;
  position_x: string;
  position_y: string;
  position_z: string;
  width: string;
  height: string;
  thickness: string;
  hinge_side?: string;
  quantity: number;
  material_type: string;
  visible: boolean;
}

interface CompartmentItem {
  id: string;
  item_type: string;
  position_y: string;
  position_x: string;
  thickness: string;
  quantity: number;
  legrabox_id?: string;
  legrabox_height_type?: string;
  has_antislip_mat?: boolean;
  has_tip_on?: boolean;
}

interface CompartmentData {
  id: string;
  name: string;
  position_x: string;
  position_y: string;
  position_z: string;
  width: string;
  height: string;
  depth: string;
  items: CompartmentItem[];
}

interface LegraboxConfig {
  id: string;
  name: string;
  height_type: string;
  height_mm: number;
  price: number;
  antislip_mat_cost?: number;
  tip_on_cost?: number;
}

interface Enhanced2DVisualizerProps {
  config: {
    width: number;
    height: number;
    depth: number;
    material_config: {
      body_thickness?: number;
      door_thickness?: number;
      shelf_thickness?: number;
    };
  };
  panels?: ParametricPanel[];
  fronts?: CabinetFront[];
  compartments?: CompartmentData[];
  onCompartmentSelect?: (compartmentId: string) => void;
  selectedCompartmentId?: string;
  legraboxConfigs?: LegraboxConfig[];
  onItemUpdate?: (compartmentId: string, itemId: string, updates: Partial<CompartmentItem>) => void;
}

interface SelectedItem {
  compartmentId: string;
  item: CompartmentItem;
  type: 'drawer' | 'shelf' | 'divider';
}

function evaluateExpression(expr: string | number, variables: Record<string, number>): number {
  if (typeof expr === 'number') return expr;
  
  let evaluated = String(expr);
  const sortedKeys = Object.keys(variables).sort((a, b) => b.length - a.length);
  
  sortedKeys.forEach((key) => {
    evaluated = evaluated.replace(new RegExp(`\\b${key}\\b`, 'g'), String(variables[key]));
  });
  
  try {
    return Function(`"use strict"; return (${evaluated})`)();
  } catch (e) {
    return 0;
  }
}

export function Enhanced2DVisualizer({
  config,
  panels = [],
  fronts = [],
  compartments = [],
  onCompartmentSelect,
  selectedCompartmentId,
  legraboxConfigs = [],
  onItemUpdate,
}: Enhanced2DVisualizerProps) {
  const [view, setView] = useState<'front' | 'side'>('front');
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  
  const bodyThickness = config.material_config.body_thickness || 18;
  const doorThickness = config.material_config.door_thickness || 18;
  const shelfThickness = config.material_config.shelf_thickness || 18;

  const variables = useMemo(() => ({
    width: config.width,
    height: config.height,
    depth: config.depth,
    body_thickness: bodyThickness,
    door_thickness: doorThickness,
    shelf_thickness: shelfThickness,
  }), [config, bodyThickness, doorThickness, shelfThickness]);

  const scale = useMemo(() => {
    const maxDimension = Math.max(config.width, config.height);
    return 400 / maxDimension;
  }, [config.width, config.height]);

  const scaledWidth = config.width * scale;
  const scaledHeight = config.height * scale;
  const scaledDepth = config.depth * scale;

  const handleItemClick = (compartmentId: string, item: CompartmentItem, type: 'drawer' | 'shelf' | 'divider') => {
    setSelectedItem({ compartmentId, item, type });
  };

  const handleItemPropertyChange = (property: 'has_antislip_mat' | 'has_tip_on', value: boolean) => {
    if (!selectedItem || !onItemUpdate) return;
    onItemUpdate(selectedItem.compartmentId, selectedItem.item.id, { [property]: value });
    setSelectedItem(prev => prev ? {
      ...prev,
      item: { ...prev.item, [property]: value }
    } : null);
  };

  const getLegraboxInfo = (legraboxId?: string) => {
    if (!legraboxId) return null;
    return legraboxConfigs.find(c => c.id === legraboxId);
  };

  // Render front view with actual panels and fronts
  const renderFrontView = () => {
    const panelElements: JSX.Element[] = [];
    const frontElements: JSX.Element[] = [];
    const compartmentElements: JSX.Element[] = [];

    // Render body panels (only show vertical panels in front view)
    panels.filter(p => p.visible).forEach((panel) => {
      const x = evaluateExpression(panel.x, variables);
      const y = evaluateExpression(panel.y, variables);
      const length = evaluateExpression(panel.length, variables);
      const width = evaluateExpression(panel.width, variables);
      const thickness = evaluateExpression(panel.thickness, variables);

      // Determine if panel is horizontal or vertical
      const isHorizontal = length > thickness * 2;
      const isVertical = width < thickness * 3;

      if (panel.material_type === 'body') {
        // Side panels (vertical)
        if (isVertical || panel.name?.toLowerCase().includes('side') || panel.name?.toLowerCase().includes('zij')) {
          panelElements.push(
            <rect
              key={`panel-${panel.id}`}
              x={20 + x * scale}
              y={20 + (config.height - y - thickness) * scale}
              width={thickness * scale}
              height={length * scale}
              fill="hsl(var(--muted))"
              stroke="hsl(var(--border))"
              strokeWidth="1"
            />
          );
        }
        // Top/bottom panels (horizontal)
        else if (isHorizontal || panel.name?.toLowerCase().includes('top') || panel.name?.toLowerCase().includes('bottom') || panel.name?.toLowerCase().includes('boven') || panel.name?.toLowerCase().includes('onder')) {
          panelElements.push(
            <rect
              key={`panel-${panel.id}`}
              x={20 + x * scale}
              y={20 + (config.height - y - thickness) * scale}
              width={length * scale}
              height={thickness * scale}
              fill="hsl(var(--muted))"
              stroke="hsl(var(--border))"
              strokeWidth="1"
            />
          );
        }
      }
    });

    // Render compartment items (shelves, dividers, drawers)
    compartments.forEach((comp) => {
      const compX = evaluateExpression(comp.position_x, variables);
      const compY = evaluateExpression(comp.position_y, variables);
      const compW = evaluateExpression(comp.width, variables);
      const compH = evaluateExpression(comp.height, variables);

      // Compartment boundary
      compartmentElements.push(
        <rect
          key={`comp-${comp.id}`}
          x={20 + compX * scale}
          y={20 + (config.height - compY - compH) * scale}
          width={compW * scale}
          height={compH * scale}
          fill={selectedCompartmentId === comp.id ? 'hsl(var(--primary) / 0.1)' : 'transparent'}
          stroke="hsl(var(--border) / 0.5)"
          strokeWidth="1"
          strokeDasharray="4,4"
          className="cursor-pointer"
          onClick={() => onCompartmentSelect?.(comp.id)}
        />
      );

      // Render shelves, dividers, and drawers
      (comp.items || []).forEach((item, idx) => {
        const isItemSelected = selectedItem?.item.id === item.id;

        if (item.item_type === 'shelf' || item.item_type === 'horizontal_divider') {
          const posY = evaluateExpression(item.position_y, variables);
          const qty = item.quantity || 1;

          for (let i = 0; i < qty; i++) {
            const yOffset = qty > 1 ? (compH / (qty + 1)) * (i + 1) : posY;
            compartmentElements.push(
              <g
                key={`shelf-${item.id}-${i}`}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleItemClick(comp.id, item, 'shelf');
                }}
              >
                <rect
                  x={20 + compX * scale}
                  y={20 + (config.height - compY - yOffset) * scale - 4}
                  width={compW * scale}
                  height={8}
                  fill={isItemSelected ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.7)'}
                  stroke={isItemSelected ? 'hsl(var(--foreground))' : 'hsl(var(--primary))'}
                  strokeWidth={isItemSelected ? 2 : 1}
                  rx="1"
                />
              </g>
            );
          }
        } else if (item.item_type === 'vertical_divider') {
          const posX = evaluateExpression(item.position_x, variables);
          compartmentElements.push(
            <g
              key={`divider-${item.id}`}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                handleItemClick(comp.id, item, 'divider');
              }}
            >
              <rect
                x={20 + (compX + posX) * scale - 4}
                y={20 + (config.height - compY - compH) * scale}
                width={8}
                height={compH * scale}
                fill={isItemSelected ? 'hsl(var(--accent))' : 'hsl(var(--accent) / 0.7)'}
                stroke={isItemSelected ? 'hsl(var(--foreground))' : 'hsl(var(--accent))'}
                strokeWidth={isItemSelected ? 2 : 1}
                rx="1"
              />
            </g>
          );
        } else if (item.item_type === 'legrabox_drawer') {
          const posY = evaluateExpression(item.position_y, variables);
          const legrabox = getLegraboxInfo(item.legrabox_id);
          const drawerHeight = legrabox?.height_mm || 100;
          const qty = item.quantity || 1;

          for (let i = 0; i < qty; i++) {
            const yOffset = qty > 1 ? posY + (drawerHeight + 10) * i : posY;
            compartmentElements.push(
              <g
                key={`drawer-${item.id}-${i}`}
                className="cursor-pointer transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  handleItemClick(comp.id, item, 'drawer');
                }}
              >
                {/* Drawer body */}
                <rect
                  x={20 + (compX + 4) * scale}
                  y={20 + (config.height - compY - yOffset - drawerHeight) * scale}
                  width={(compW - 8) * scale}
                  height={drawerHeight * scale}
                  fill={isItemSelected ? 'hsl(var(--primary) / 0.3)' : 'hsl(var(--muted))'}
                  stroke={isItemSelected ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                  strokeWidth={isItemSelected ? 3 : 2}
                  rx="3"
                />
                {/* Drawer front */}
                <rect
                  x={20 + (compX + 2) * scale}
                  y={20 + (config.height - compY - yOffset - drawerHeight) * scale}
                  width={(compW - 4) * scale}
                  height={drawerHeight * scale}
                  fill={isItemSelected ? 'hsl(var(--background))' : 'hsl(var(--card))'}
                  stroke={isItemSelected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))'}
                  strokeWidth={isItemSelected ? 3 : 2}
                  rx="2"
                />
                {/* Handle */}
                <line
                  x1={20 + (compX + compW * 0.35) * scale}
                  y1={20 + (config.height - compY - yOffset - drawerHeight / 2) * scale}
                  x2={20 + (compX + compW * 0.65) * scale}
                  y2={20 + (config.height - compY - yOffset - drawerHeight / 2) * scale}
                  stroke={isItemSelected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))'}
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                {/* Accessory indicators */}
                {item.has_antislip_mat && (
                  <circle
                    cx={20 + (compX + 12) * scale}
                    cy={20 + (config.height - compY - yOffset - drawerHeight + 12) * scale}
                    r="5"
                    fill="hsl(var(--chart-1))"
                  />
                )}
                {item.has_tip_on && (
                  <circle
                    cx={20 + (compX + compW - 12) * scale}
                    cy={20 + (config.height - compY - yOffset - drawerHeight + 12) * scale}
                    r="5"
                    fill="hsl(var(--chart-2))"
                  />
                )}
              </g>
            );
          }
        }
      });
    });

    // Render fronts (doors/drawer fronts)
    fronts.filter(f => f.visible).forEach((front) => {
      const x = evaluateExpression(front.position_x, variables);
      const y = evaluateExpression(front.position_y, variables);
      const w = evaluateExpression(front.width, variables);
      const h = evaluateExpression(front.height, variables);

      // Door/front outline
      frontElements.push(
        <rect
          key={`front-${front.id}`}
          x={20 + x * scale}
          y={20 + (config.height - y - h) * scale}
          width={w * scale}
          height={h * scale}
          fill="hsl(var(--background))"
          stroke="hsl(var(--foreground))"
          strokeWidth="2"
          rx="2"
        />
      );

      // Door handle indicator
      if (front.front_type === 'hinged_door') {
        const handleX = front.hinge_side === 'left' 
          ? x + w - 20 
          : x + 20;
        frontElements.push(
          <line
            key={`handle-${front.id}`}
            x1={20 + handleX * scale}
            y1={20 + (config.height - y - h * 0.4) * scale}
            x2={20 + handleX * scale}
            y2={20 + (config.height - y - h * 0.6) * scale}
            stroke="hsl(var(--foreground))"
            strokeWidth="3"
            strokeLinecap="round"
          />
        );
      } else if (front.front_type === 'drawer_front') {
        // Drawer handle (centered horizontal line)
        frontElements.push(
          <line
            key={`handle-${front.id}`}
            x1={20 + (x + w * 0.3) * scale}
            y1={20 + (config.height - y - h * 0.5) * scale}
            x2={20 + (x + w * 0.7) * scale}
            y2={20 + (config.height - y - h * 0.5) * scale}
            stroke="hsl(var(--foreground))"
            strokeWidth="3"
            strokeLinecap="round"
          />
        );
      }
    });

    return (
      <>
        {/* Cabinet outline */}
        <rect
          x="20"
          y="20"
          width={scaledWidth}
          height={scaledHeight}
          fill="none"
          stroke="hsl(var(--foreground))"
          strokeWidth="2"
        />
        {panelElements}
        {compartmentElements}
        {frontElements}
        
        {/* Dimensions */}
        <text x={20 + scaledWidth / 2} y="12" textAnchor="middle" fontSize="11" fill="hsl(var(--foreground))">
          {config.width} mm
        </text>
        <text
          x={scaledWidth + 32}
          y={20 + scaledHeight / 2}
          textAnchor="middle"
          fontSize="11"
          fill="hsl(var(--foreground))"
          transform={`rotate(90, ${scaledWidth + 32}, ${20 + scaledHeight / 2})`}
        >
          {config.height} mm
        </text>
      </>
    );
  };

  // Render side view
  const renderSideView = () => {
    const elements: JSX.Element[] = [];

    // Cabinet body outline
    elements.push(
      <rect
        key="body"
        x="20"
        y="20"
        width={scaledDepth}
        height={scaledHeight}
        fill="hsl(var(--muted) / 0.3)"
        stroke="hsl(var(--foreground))"
        strokeWidth="2"
      />
    );

    // Side panels (left side thickness)
    elements.push(
      <rect
        key="left-side"
        x="20"
        y="20"
        width={bodyThickness * scale}
        height={scaledHeight}
        fill="hsl(var(--muted))"
        stroke="hsl(var(--border))"
        strokeWidth="1"
      />
    );

    // Back panel
    elements.push(
      <rect
        key="back"
        x={20 + scaledDepth - bodyThickness * scale}
        y="20"
        width={bodyThickness * scale}
        height={scaledHeight}
        fill="hsl(var(--muted))"
        stroke="hsl(var(--border))"
        strokeWidth="1"
      />
    );

    // Top panel
    elements.push(
      <rect
        key="top"
        x="20"
        y="20"
        width={scaledDepth}
        height={bodyThickness * scale}
        fill="hsl(var(--muted))"
        stroke="hsl(var(--border))"
        strokeWidth="1"
      />
    );

    // Bottom panel
    elements.push(
      <rect
        key="bottom"
        x="20"
        y={20 + scaledHeight - bodyThickness * scale}
        width={scaledDepth}
        height={bodyThickness * scale}
        fill="hsl(var(--muted))"
        stroke="hsl(var(--border))"
        strokeWidth="1"
      />
    );

    // Render compartment items in side view
    compartments.forEach((comp) => {
      const compY = evaluateExpression(comp.position_y, variables);
      const compH = evaluateExpression(comp.height, variables);
      const compD = evaluateExpression(comp.depth, variables);

      (comp.items || []).forEach((item) => {
        const isItemSelected = selectedItem?.item.id === item.id;

        if (item.item_type === 'shelf' || item.item_type === 'horizontal_divider') {
          const posY = evaluateExpression(item.position_y, variables);
          const qty = item.quantity || 1;

          for (let i = 0; i < qty; i++) {
            const yOffset = qty > 1 ? (compH / (qty + 1)) * (i + 1) : posY;
            elements.push(
              <g
                key={`shelf-side-${item.id}-${i}`}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleItemClick(comp.id, item, 'shelf');
                }}
              >
                <rect
                  x={20 + bodyThickness * scale}
                  y={20 + (config.height - compY - yOffset) * scale - shelfThickness * scale / 2}
                  width={(compD - bodyThickness * 2) * scale}
                  height={shelfThickness * scale}
                  fill={isItemSelected ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.5)'}
                  stroke={isItemSelected ? 'hsl(var(--foreground))' : 'hsl(var(--primary))'}
                  strokeWidth={isItemSelected ? 2 : 1}
                />
              </g>
            );
          }
        } else if (item.item_type === 'legrabox_drawer') {
          const posY = evaluateExpression(item.position_y, variables);
          const legrabox = getLegraboxInfo(item.legrabox_id);
          const drawerHeight = legrabox?.height_mm || 100;
          const drawerDepth = Math.max(270, config.depth - 50); // Auto-calculated depth
          const qty = item.quantity || 1;

          for (let i = 0; i < qty; i++) {
            const yOffset = qty > 1 ? posY + (drawerHeight + 10) * i : posY;
            elements.push(
              <g
                key={`drawer-side-${item.id}-${i}`}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleItemClick(comp.id, item, 'drawer');
                }}
              >
                {/* Drawer side rail */}
                <rect
                  x={20 + bodyThickness * scale}
                  y={20 + (config.height - compY - yOffset - drawerHeight) * scale}
                  width={drawerDepth * scale}
                  height={drawerHeight * scale}
                  fill={isItemSelected ? 'hsl(var(--primary) / 0.2)' : 'hsl(var(--muted) / 0.5)'}
                  stroke={isItemSelected ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                  strokeWidth={isItemSelected ? 2 : 1}
                  rx="2"
                />
                {/* Drawer front (side view) */}
                <rect
                  x="16"
                  y={20 + (config.height - compY - yOffset - drawerHeight) * scale}
                  width={doorThickness * scale}
                  height={drawerHeight * scale}
                  fill={isItemSelected ? 'hsl(var(--background))' : 'hsl(var(--card))'}
                  stroke={isItemSelected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))'}
                  strokeWidth={isItemSelected ? 2 : 1}
                />
              </g>
            );
          }
        }
      });
    });

    // Door front (if visible doors exist)
    const hasDoors = fronts.some(f => f.visible && f.front_type === 'hinged_door');
    if (hasDoors) {
      elements.push(
        <rect
          key="door-front"
          x="16"
          y="20"
          width={doorThickness * scale}
          height={scaledHeight}
          fill="hsl(var(--background))"
          stroke="hsl(var(--foreground))"
          strokeWidth="2"
        />
      );
    }

    return (
      <>
        {elements}
        
        {/* Dimensions */}
        <text x={20 + scaledDepth / 2} y="12" textAnchor="middle" fontSize="11" fill="hsl(var(--foreground))">
          {config.depth} mm
        </text>
        <text
          x={scaledDepth + 32}
          y={20 + scaledHeight / 2}
          textAnchor="middle"
          fontSize="11"
          fill="hsl(var(--foreground))"
          transform={`rotate(90, ${scaledDepth + 32}, ${20 + scaledHeight / 2})`}
        >
          {config.height} mm
        </text>
      </>
    );
  };

  const viewWidth = view === 'front' ? scaledWidth + 50 : scaledDepth + 50;
  const viewHeight = scaledHeight + 50;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={view === 'front' ? 'default' : 'outline'}
          onClick={() => setView('front')}
        >
          Front View
        </Button>
        <Button
          size="sm"
          variant={view === 'side' ? 'default' : 'outline'}
          onClick={() => setView('side')}
        >
          Side View
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* SVG Drawing */}
        <div className="lg:col-span-2 border rounded-lg p-4 bg-muted/20 overflow-auto">
          <svg
            width={viewWidth}
            height={viewHeight}
            viewBox={`0 0 ${viewWidth} ${viewHeight}`}
            className="mx-auto"
          >
            {view === 'front' ? renderFrontView() : renderSideView()}
          </svg>
          
          {/* Legend */}
          <div className="flex gap-4 mt-4 text-xs text-muted-foreground justify-center">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-[hsl(var(--chart-1))]" />
              <span>Anti-slip Mat</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-[hsl(var(--chart-2))]" />
              <span>TIP-ON</span>
            </div>
          </div>
        </div>

        {/* Selected Item Panel */}
        <div className="lg:col-span-1">
          {selectedItem ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base capitalize">
                    {selectedItem.type === 'drawer' ? 'Drawer' : 
                     selectedItem.type === 'shelf' ? 'Shelf' : 'Divider'} Properties
                  </CardTitle>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => setSelectedItem(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedItem.type === 'drawer' && (
                  <>
                    {/* Drawer Info */}
                    {(() => {
                      const legrabox = getLegraboxInfo(selectedItem.item.legrabox_id);
                      return (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Configuration</span>
                            <span className="font-medium">{legrabox?.name || 'Not set'}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Height Type</span>
                            <Badge variant="secondary">
                              {selectedItem.item.legrabox_height_type || legrabox?.height_type || '-'}
                            </Badge>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Height</span>
                            <span>{legrabox?.height_mm || '-'} mm</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Auto Depth</span>
                            <span>{Math.max(270, config.depth - 50)} mm</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Base Price</span>
                            <span className="font-medium">€{legrabox?.price?.toFixed(2) || '0.00'}</span>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="border-t pt-4 space-y-4">
                      <h4 className="font-medium text-sm">Accessories</h4>
                      
                      {/* Anti-slip Mat Toggle */}
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm">Anti-slip Fiber Mat</Label>
                          <p className="text-xs text-muted-foreground">
                            +€{(getLegraboxInfo(selectedItem.item.legrabox_id)?.antislip_mat_cost || 0).toFixed(2)}
                          </p>
                        </div>
                        <Switch
                          checked={selectedItem.item.has_antislip_mat || false}
                          onCheckedChange={(checked) => handleItemPropertyChange('has_antislip_mat', checked)}
                          disabled={!onItemUpdate}
                        />
                      </div>

                      {/* TIP-ON Toggle */}
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm">TIP-ON (Touch to Open)</Label>
                          <p className="text-xs text-muted-foreground">
                            +€{(getLegraboxInfo(selectedItem.item.legrabox_id)?.tip_on_cost || 0).toFixed(2)}
                          </p>
                        </div>
                        <Switch
                          checked={selectedItem.item.has_tip_on || false}
                          onCheckedChange={(checked) => handleItemPropertyChange('has_tip_on', checked)}
                          disabled={!onItemUpdate}
                        />
                      </div>
                    </div>

                    {/* Total Cost */}
                    {(() => {
                      const legrabox = getLegraboxInfo(selectedItem.item.legrabox_id);
                      const basePrice = legrabox?.price || 0;
                      const matCost = selectedItem.item.has_antislip_mat ? (legrabox?.antislip_mat_cost || 0) : 0;
                      const tipOnCost = selectedItem.item.has_tip_on ? (legrabox?.tip_on_cost || 0) : 0;
                      const total = basePrice + matCost + tipOnCost;
                      
                      return (
                        <div className="border-t pt-4">
                          <div className="flex justify-between font-medium">
                            <span>Total (per drawer)</span>
                            <span className="text-primary">€{total.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}

                {selectedItem.type === 'shelf' && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Type</span>
                      <span className="capitalize">{selectedItem.item.item_type.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Quantity</span>
                      <span>{selectedItem.item.quantity || 1}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Position Y</span>
                      <span>{selectedItem.item.position_y}</span>
                    </div>
                  </div>
                )}

                {selectedItem.type === 'divider' && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Type</span>
                      <span>Vertical Divider</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Position X</span>
                      <span>{selectedItem.item.position_x}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                Click on a drawer, shelf, or divider in the drawing to view and edit its properties
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
