import { useMemo, useState } from 'react';
import { ParametricPanel } from '@/types/cabinet';
import { Button } from '@/components/ui/button';

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
}: Enhanced2DVisualizerProps) {
  const [view, setView] = useState<'front' | 'side'>('front');
  
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

    // Render compartment items (shelves, dividers)
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

      // Render shelves and dividers
      (comp.items || []).forEach((item, idx) => {
        if (item.item_type === 'shelf' || item.item_type === 'horizontal_divider') {
          const posY = evaluateExpression(item.position_y, variables);
          const qty = item.quantity || 1;

          for (let i = 0; i < qty; i++) {
            const yOffset = qty > 1 ? (compH / (qty + 1)) * (i + 1) : posY;
            compartmentElements.push(
              <line
                key={`shelf-${item.id}-${i}`}
                x1={20 + compX * scale}
                y1={20 + (config.height - compY - yOffset) * scale}
                x2={20 + (compX + compW) * scale}
                y2={20 + (config.height - compY - yOffset) * scale}
                stroke="hsl(var(--primary))"
                strokeWidth="2"
              />
            );
          }
        } else if (item.item_type === 'vertical_divider') {
          const posX = evaluateExpression(item.position_x, variables);
          compartmentElements.push(
            <line
              key={`divider-${item.id}`}
              x1={20 + (compX + posX) * scale}
              y1={20 + (config.height - compY - compH) * scale}
              x2={20 + (compX + posX) * scale}
              y2={20 + (config.height - compY) * scale}
              stroke="hsl(var(--accent))"
              strokeWidth="2"
            />
          );
        } else if (item.item_type === 'legrabox_drawer') {
          const posY = evaluateExpression(item.position_y, variables);
          compartmentElements.push(
            <rect
              key={`drawer-${item.id}`}
              x={20 + (compX + 2) * scale}
              y={20 + (config.height - compY - posY - 100) * scale}
              width={(compW - 4) * scale}
              height={80 * scale}
              fill="hsl(var(--muted))"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              rx="2"
            />
          );
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

    // Render compartment shelves in side view
    compartments.forEach((comp) => {
      const compY = evaluateExpression(comp.position_y, variables);
      const compH = evaluateExpression(comp.height, variables);
      const compD = evaluateExpression(comp.depth, variables);

      (comp.items || []).forEach((item) => {
        if (item.item_type === 'shelf' || item.item_type === 'horizontal_divider') {
          const posY = evaluateExpression(item.position_y, variables);
          const qty = item.quantity || 1;

          for (let i = 0; i < qty; i++) {
            const yOffset = qty > 1 ? (compH / (qty + 1)) * (i + 1) : posY;
            elements.push(
              <rect
                key={`shelf-side-${item.id}-${i}`}
                x={20 + bodyThickness * scale}
                y={20 + (config.height - compY - yOffset) * scale - shelfThickness * scale / 2}
                width={(compD - bodyThickness * 2) * scale}
                height={shelfThickness * scale}
                fill="hsl(var(--primary) / 0.5)"
                stroke="hsl(var(--primary))"
                strokeWidth="1"
              />
            );
          }
        }
      });
    });

    // Door front (if visible)
    if (fronts.some(f => f.visible)) {
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

      <div className="border rounded-lg p-4 bg-muted/20 overflow-auto">
        <svg
          width={viewWidth}
          height={viewHeight}
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          className="mx-auto"
        >
          {view === 'front' ? renderFrontView() : renderSideView()}
        </svg>
      </div>
    </div>
  );
}
