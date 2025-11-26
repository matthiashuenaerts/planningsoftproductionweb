import { useMemo, useState } from 'react';
import { Compartment, Module } from '@/types/cabinet';

interface InteractiveCabinetVisualizerProps {
  config: {
    width: number;
    height: number;
    depth: number;
    compartments: Compartment[];
    material_config: {
      body_material: string;
      door_material: string;
      shelf_material: string;
      body_thickness?: number;
      door_thickness?: number;
      shelf_thickness?: number;
    };
  };
  selectedCompartmentId?: string;
  onCompartmentSelect: (compartmentId: string) => void;
}

export function InteractiveCabinetVisualizer({ 
  config, 
  selectedCompartmentId,
  onCompartmentSelect 
}: InteractiveCabinetVisualizerProps) {
  const [view, setView] = useState<'front' | 'side' | '3d'>('front');
  
  const scale = useMemo(() => {
    const maxDimension = Math.max(config.width, config.height);
    return 500 / maxDimension;
  }, [config.width, config.height]);

  const scaledWidth = config.width * scale;
  const scaledHeight = config.height * scale;
  const bodyThickness = config.material_config.body_thickness || 18;

  const renderModule = (module: Module, compartment: Compartment) => {
    const scaledModulePos = module.position * scale;
    
    switch (module.type) {
      case 'horizontal_division':
        const divY = compartment.y * scale + scaledModulePos;
        return (
          <line
            key={module.id}
            x1={compartment.x * scale + 20}
            y1={divY + 20}
            x2={compartment.x * scale + compartment.width * scale + 20}
            y2={divY + 20}
            stroke="hsl(var(--primary))"
            strokeWidth="2"
          />
        );
      
      case 'vertical_division':
        const divX = compartment.x * scale + scaledModulePos;
        return (
          <line
            key={module.id}
            x1={divX + 20}
            y1={compartment.y * scale + 20}
            x2={divX + 20}
            y2={compartment.y * scale + compartment.height * scale + 20}
            stroke="hsl(var(--primary))"
            strokeWidth="2"
          />
        );
      
      case 'drawer':
        const drawerY = compartment.y * scale + scaledModulePos;
        const drawerHeight = (module.height || 100) * scale;
        return (
          <g key={module.id}>
            <rect
              x={compartment.x * scale + 20}
              y={drawerY + 20}
              width={compartment.width * scale}
              height={drawerHeight}
              fill="hsl(var(--muted))"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
            />
            <circle
              cx={compartment.x * scale + (compartment.width * scale) / 2 + 20}
              cy={drawerY + drawerHeight / 2 + 20}
              r="4"
              fill="hsl(var(--foreground))"
            />
          </g>
        );
      
      case 'shelf':
        const shelfY = compartment.y * scale + scaledModulePos;
        return (
          <line
            key={module.id}
            x1={compartment.x * scale + 20}
            y1={shelfY + 20}
            x2={compartment.x * scale + compartment.width * scale + 20}
            y2={shelfY + 20}
            stroke="hsl(var(--accent))"
            strokeWidth="3"
            strokeDasharray="5,5"
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* View Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('front')}
          className={`px-4 py-2 rounded ${
            view === 'front' ? 'bg-primary text-primary-foreground' : 'bg-secondary'
          }`}
        >
          Front View
        </button>
        <button
          onClick={() => setView('side')}
          className={`px-4 py-2 rounded ${
            view === 'side' ? 'bg-primary text-primary-foreground' : 'bg-secondary'
          }`}
        >
          Side View
        </button>
        <button
          onClick={() => setView('3d')}
          className={`px-4 py-2 rounded ${
            view === '3d' ? 'bg-primary text-primary-foreground' : 'bg-secondary'
          }`}
        >
          3D View
        </button>
      </div>

      {/* Front View */}
      {view === 'front' && (
        <div>
          <h3 className="text-sm font-medium mb-3">Front View (Click compartment to edit)</h3>
          <div className="border rounded-lg p-4 bg-muted/20">
            <svg
              width={scaledWidth + 40}
              height={scaledHeight + 40}
              viewBox={`0 0 ${scaledWidth + 40} ${scaledHeight + 40}`}
              className="mx-auto"
            >
              {/* Cabinet body outline */}
              <rect
                x="20"
                y="20"
                width={scaledWidth}
                height={scaledHeight}
                fill="hsl(var(--muted))"
                stroke="hsl(var(--foreground))"
                strokeWidth="2"
              />

              {/* Compartments */}
              {config.compartments.map((compartment) => (
                <g key={compartment.id}>
                  <rect
                    x={compartment.x * scale + 20}
                    y={compartment.y * scale + 20}
                    width={compartment.width * scale}
                    height={compartment.height * scale}
                    fill={selectedCompartmentId === compartment.id ? 'hsl(var(--primary) / 0.2)' : 'transparent'}
                    stroke="hsl(var(--border))"
                    strokeWidth="1"
                    className="cursor-pointer hover:fill-primary/10 transition-colors"
                    onClick={() => onCompartmentSelect(compartment.id)}
                  />
                  
                  {/* Render modules within this compartment */}
                  {compartment.modules.map(module => renderModule(module, compartment))}
                </g>
              ))}

              {/* Dimensions */}
              <text
                x={20 + scaledWidth / 2}
                y="15"
                textAnchor="middle"
                fontSize="10"
                fill="hsl(var(--foreground))"
              >
                {config.width} mm
              </text>
              <text
                x={scaledWidth + 30}
                y={20 + scaledHeight / 2}
                textAnchor="start"
                fontSize="10"
                fill="hsl(var(--foreground))"
                transform={`rotate(90, ${scaledWidth + 30}, ${20 + scaledHeight / 2})`}
              >
                {config.height} mm
              </text>
            </svg>
          </div>
        </div>
      )}

      {/* Side View */}
      {view === 'side' && (
        <div>
          <h3 className="text-sm font-medium mb-3">Side View</h3>
          <div className="border rounded-lg p-4 bg-muted/20">
            <svg
              width={config.depth * scale + 40}
              height={scaledHeight + 40}
              viewBox={`0 0 ${config.depth * scale + 40} ${scaledHeight + 40}`}
              className="mx-auto"
            >
              <rect
                x="20"
                y="20"
                width={config.depth * scale}
                height={scaledHeight}
                fill="hsl(var(--muted))"
                stroke="hsl(var(--foreground))"
                strokeWidth="2"
              />
              
              {/* Show body thickness */}
              <rect
                x="20"
                y="20"
                width={bodyThickness * scale}
                height={scaledHeight}
                fill="hsl(var(--accent) / 0.3)"
                stroke="hsl(var(--accent))"
                strokeWidth="1"
              />
              <rect
                x={20 + config.depth * scale - bodyThickness * scale}
                y="20"
                width={bodyThickness * scale}
                height={scaledHeight}
                fill="hsl(var(--accent) / 0.3)"
                stroke="hsl(var(--accent))"
                strokeWidth="1"
              />

              <text
                x={20 + (config.depth * scale) / 2}
                y="15"
                textAnchor="middle"
                fontSize="10"
                fill="hsl(var(--foreground))"
              >
                {config.depth} mm (Thickness: {bodyThickness}mm)
              </text>
            </svg>
          </div>
        </div>
      )}

      {/* 3D View Placeholder */}
      {view === '3d' && (
        <div className="border rounded-lg p-8 bg-muted/20 text-center">
          <p className="text-muted-foreground">3D view will be implemented with Three.js</p>
        </div>
      )}
    </div>
  );
}
