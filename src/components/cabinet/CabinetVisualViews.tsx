import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Database } from '@/integrations/supabase/types';

type CabinetConfiguration = Database['public']['Tables']['cabinet_configurations']['Row'];

interface CabinetVisualViewsProps {
  configuration: CabinetConfiguration | null;
}

export function CabinetVisualViews({ configuration }: CabinetVisualViewsProps) {
  if (!configuration) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No cabinet selected. Create or select a configuration to view.
        </CardContent>
      </Card>
    );
  }

  const width = Number(configuration.width);
  const height = Number(configuration.height);
  const depth = Number(configuration.depth);
  const shelves = configuration.horizontal_divisions || 0;
  const dividers = configuration.vertical_divisions || 0;

  return (
    <Tabs defaultValue="front" className="space-y-4">
      <TabsList>
        <TabsTrigger value="front">Front View</TabsTrigger>
        <TabsTrigger value="side">Side View</TabsTrigger>
        <TabsTrigger value="cross">Cross Section</TabsTrigger>
      </TabsList>

      <TabsContent value="front">
        <Card>
          <CardHeader>
            <CardTitle>Front View</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center bg-muted/20 rounded-lg p-8">
              <svg
                viewBox={`0 0 ${width} ${height}`}
                className="max-w-full max-h-[600px] border border-border"
                style={{ aspectRatio: `${width}/${height}` }}
              >
                {/* Cabinet outline */}
                <rect
                  x="0"
                  y="0"
                  width={width}
                  height={height}
                  fill="hsl(var(--card))"
                  stroke="hsl(var(--border))"
                  strokeWidth="3"
                />

                {/* Horizontal shelves */}
                {Array.from({ length: shelves }).map((_, i) => {
                  const y = ((i + 1) * height) / (shelves + 1);
                  return (
                    <line
                      key={`shelf-${i}`}
                      x1="0"
                      y1={y}
                      x2={width}
                      y2={y}
                      stroke="hsl(var(--border))"
                      strokeWidth="2"
                    />
                  );
                })}

                {/* Vertical dividers */}
                {Array.from({ length: dividers }).map((_, i) => {
                  const x = ((i + 1) * width) / (dividers + 1);
                  return (
                    <line
                      key={`divider-${i}`}
                      x1={x}
                      y1="0"
                      x2={x}
                      y2={height}
                      stroke="hsl(var(--border))"
                      strokeWidth="2"
                    />
                  );
                })}

                {/* Dimensions */}
                <text
                  x={width / 2}
                  y={height + 40}
                  textAnchor="middle"
                  className="fill-foreground text-xs"
                >
                  {width}mm
                </text>
                <text
                  x={width + 40}
                  y={height / 2}
                  textAnchor="middle"
                  className="fill-foreground text-xs"
                  transform={`rotate(90, ${width + 40}, ${height / 2})`}
                >
                  {height}mm
                </text>
              </svg>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="side">
        <Card>
          <CardHeader>
            <CardTitle>Side View</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center bg-muted/20 rounded-lg p-8">
              <svg
                viewBox={`0 0 ${depth} ${height}`}
                className="max-w-full max-h-[600px] border border-border"
                style={{ aspectRatio: `${depth}/${height}` }}
              >
                <rect
                  x="0"
                  y="0"
                  width={depth}
                  height={height}
                  fill="hsl(var(--card))"
                  stroke="hsl(var(--border))"
                  strokeWidth="3"
                />

                {/* Shelves on side view */}
                {Array.from({ length: shelves }).map((_, i) => {
                  const y = ((i + 1) * height) / (shelves + 1);
                  return (
                    <line
                      key={`shelf-side-${i}`}
                      x1="0"
                      y1={y}
                      x2={depth}
                      y2={y}
                      stroke="hsl(var(--border))"
                      strokeWidth="2"
                    />
                  );
                })}

                <text
                  x={depth / 2}
                  y={height + 40}
                  textAnchor="middle"
                  className="fill-foreground text-xs"
                >
                  {depth}mm
                </text>
              </svg>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="cross">
        <Card>
          <CardHeader>
            <CardTitle>Cross Section</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center bg-muted/20 rounded-lg p-8">
              <svg
                viewBox={`0 0 ${width} ${depth}`}
                className="max-w-full max-h-[400px] border border-border"
                style={{ aspectRatio: `${width}/${depth}` }}
              >
                <rect
                  x="0"
                  y="0"
                  width={width}
                  height={depth}
                  fill="hsl(var(--card))"
                  stroke="hsl(var(--border))"
                  strokeWidth="3"
                />

                {/* Vertical dividers on cross section */}
                {Array.from({ length: dividers }).map((_, i) => {
                  const x = ((i + 1) * width) / (dividers + 1);
                  return (
                    <line
                      key={`divider-cross-${i}`}
                      x1={x}
                      y1="0"
                      x2={x}
                      y2={depth}
                      stroke="hsl(var(--border))"
                      strokeWidth="2"
                    />
                  );
                })}

                <text
                  x={width / 2}
                  y={depth + 40}
                  textAnchor="middle"
                  className="fill-foreground text-xs"
                >
                  {width}mm
                </text>
              </svg>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
