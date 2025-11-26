import { useMemo } from 'react';

interface CabinetVisualizerProps {
  config: {
    width: number;
    height: number;
    depth: number;
    horizontal_divisions: number;
    vertical_divisions: number;
    drawer_count: number;
    door_type: string;
  };
}

export function CabinetVisualizer({ config }: CabinetVisualizerProps) {
  const scale = useMemo(() => {
    const maxDimension = Math.max(config.width, config.height);
    return 400 / maxDimension;
  }, [config.width, config.height]);

  const scaledWidth = config.width * scale;
  const scaledHeight = config.height * scale;

  return (
    <div className="space-y-6">
      {/* Front View */}
      <div>
        <h3 className="text-sm font-medium mb-3">Front View</h3>
        <div className="border rounded-lg p-4 bg-muted/20">
          <svg
            width={scaledWidth + 40}
            height={scaledHeight + 40}
            viewBox={`0 0 ${scaledWidth + 40} ${scaledHeight + 40}`}
            className="mx-auto"
          >
            {/* Cabinet body */}
            <rect
              x="20"
              y="20"
              width={scaledWidth}
              height={scaledHeight}
              fill="hsl(var(--muted))"
              stroke="hsl(var(--foreground))"
              strokeWidth="2"
            />

            {/* Horizontal divisions */}
            {Array.from({ length: config.horizontal_divisions }).map((_, i) => {
              const y = 20 + ((i + 1) * scaledHeight) / (config.horizontal_divisions + 1);
              return (
                <line
                  key={`h-${i}`}
                  x1="20"
                  y1={y}
                  x2={20 + scaledWidth}
                  y2={y}
                  stroke="hsl(var(--foreground))"
                  strokeWidth="1"
                />
              );
            })}

            {/* Vertical divisions */}
            {Array.from({ length: config.vertical_divisions }).map((_, i) => {
              const x = 20 + ((i + 1) * scaledWidth) / (config.vertical_divisions + 1);
              return (
                <line
                  key={`v-${i}`}
                  x1={x}
                  y1="20"
                  x2={x}
                  y2={20 + scaledHeight}
                  stroke="hsl(var(--foreground))"
                  strokeWidth="1"
                />
              );
            })}

            {/* Drawers */}
            {config.drawer_count > 0 && Array.from({ length: config.drawer_count }).map((_, i) => {
              const drawerHeight = scaledHeight / config.drawer_count;
              const y = 20 + i * drawerHeight;
              return (
                <g key={`drawer-${i}`}>
                  <rect
                    x="20"
                    y={y}
                    width={scaledWidth}
                    height={drawerHeight}
                    fill="none"
                    stroke="hsl(var(--foreground))"
                    strokeWidth="2"
                  />
                  {/* Drawer handle */}
                  <circle
                    cx={20 + scaledWidth / 2}
                    cy={y + drawerHeight / 2}
                    r="3"
                    fill="hsl(var(--foreground))"
                  />
                </g>
              );
            })}

            {/* Door indication */}
            {config.door_type === 'hinged' && (
              <line
                x1={20 + scaledWidth / 2}
                y1="20"
                x2={20 + scaledWidth / 2}
                y2={20 + scaledHeight}
                stroke="hsl(var(--foreground))"
                strokeWidth="1"
                strokeDasharray="4"
              />
            )}

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

      {/* Side View */}
      <div>
        <h3 className="text-sm font-medium mb-3">Side View</h3>
        <div className="border rounded-lg p-4 bg-muted/20">
          <svg
            width={config.depth * scale + 40}
            height={scaledHeight + 40}
            viewBox={`0 0 ${config.depth * scale + 40} ${scaledHeight + 40}`}
            className="mx-auto"
          >
            {/* Cabinet body */}
            <rect
              x="20"
              y="20"
              width={config.depth * scale}
              height={scaledHeight}
              fill="hsl(var(--muted))"
              stroke="hsl(var(--foreground))"
              strokeWidth="2"
            />

            {/* Horizontal divisions */}
            {Array.from({ length: config.horizontal_divisions }).map((_, i) => {
              const y = 20 + ((i + 1) * scaledHeight) / (config.horizontal_divisions + 1);
              return (
                <line
                  key={`side-h-${i}`}
                  x1="20"
                  y1={y}
                  x2={20 + config.depth * scale}
                  y2={y}
                  stroke="hsl(var(--foreground))"
                  strokeWidth="1"
                />
              );
            })}

            {/* Dimensions */}
            <text
              x={20 + (config.depth * scale) / 2}
              y="15"
              textAnchor="middle"
              fontSize="10"
              fill="hsl(var(--foreground))"
            >
              {config.depth} mm
            </text>
            <text
              x={config.depth * scale + 30}
              y={20 + scaledHeight / 2}
              textAnchor="start"
              fontSize="10"
              fill="hsl(var(--foreground))"
              transform={`rotate(90, ${config.depth * scale + 30}, ${20 + scaledHeight / 2})`}
            >
              {config.height} mm
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
}
