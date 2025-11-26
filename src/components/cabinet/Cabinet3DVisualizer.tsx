import { useMemo } from 'react';
import type { CabinetConfiguration } from '@/types/cabinet';

interface Cabinet3DVisualizerProps {
  config: CabinetConfiguration;
  materials?: any[];
}

export function Cabinet3DVisualizer({ config, materials = [] }: Cabinet3DVisualizerProps) {
  const bodyMaterial = materials.find(m => m.id === config.material_config.body_material);
  const doorMaterial = materials.find(m => m.id === config.material_config.door_material);
  
  const bodyColor = bodyMaterial?.color || '#8B7355';
  const doorColor = doorMaterial?.color || '#A0826D';
  const bodyThickness = config.material_config.body_thickness || 18;

  const scale = useMemo(() => {
    const maxDim = Math.max(config.width, config.height, config.depth);
    return Math.min(400 / maxDim, 1);
  }, [config.width, config.height, config.depth]);

  return (
    <div className="w-full h-[500px] bg-muted/30 rounded-lg flex items-center justify-center perspective-1000">
      <div 
        className="relative preserve-3d"
        style={{
          transform: `rotateX(-20deg) rotateY(-30deg) scale(${scale})`,
          transformStyle: 'preserve-3d',
          width: `${config.width}px`,
          height: `${config.height}px`,
        }}
      >
        {/* Front panel */}
        <div
          className="absolute border border-border/50 shadow-lg"
          style={{
            width: `${config.width}px`,
            height: `${config.height}px`,
            backgroundColor: bodyColor,
            transform: `translateZ(${config.depth / 2}px)`,
          }}
        >
          {/* Door */}
          {config.door_type !== 'none' && (
            <div
              className="absolute inset-2 border border-border/30"
              style={{
                backgroundColor: doorColor,
              }}
            />
          )}
        </div>

        {/* Back panel */}
        <div
          className="absolute border border-border/50"
          style={{
            width: `${config.width}px`,
            height: `${config.height}px`,
            backgroundColor: bodyColor,
            transform: `translateZ(-${config.depth / 2}px) rotateY(180deg)`,
          }}
        />

        {/* Left side */}
        <div
          className="absolute border border-border/50"
          style={{
            width: `${config.depth}px`,
            height: `${config.height}px`,
            backgroundColor: bodyColor,
            transform: `rotateY(-90deg) translateZ(${config.width / 2}px)`,
            transformOrigin: 'left center',
          }}
        />

        {/* Right side */}
        <div
          className="absolute border border-border/50"
          style={{
            width: `${config.depth}px`,
            height: `${config.height}px`,
            backgroundColor: bodyColor,
            transform: `rotateY(90deg) translateZ(${config.width / 2}px)`,
            transformOrigin: 'right center',
          }}
        />

        {/* Top */}
        <div
          className="absolute border border-border/50"
          style={{
            width: `${config.width}px`,
            height: `${config.depth}px`,
            backgroundColor: bodyColor,
            transform: `rotateX(90deg) translateZ(${config.height / 2}px)`,
            transformOrigin: 'top center',
          }}
        />

        {/* Bottom */}
        <div
          className="absolute border border-border/50"
          style={{
            width: `${config.width}px`,
            height: `${config.depth}px`,
            backgroundColor: bodyColor,
            transform: `rotateX(-90deg) translateZ(${config.height / 2}px)`,
            transformOrigin: 'bottom center',
          }}
        />

        {/* Shelves and divisions */}
        {config.compartments.map((compartment) =>
          compartment.modules.map((module) => {
            if (module.type === 'horizontal_division' || module.type === 'shelf') {
              return (
                <div
                  key={module.id}
                  className="absolute border-t border-border/30"
                  style={{
                    width: `${config.width}px`,
                    height: `${bodyThickness}px`,
                    backgroundColor: bodyColor,
                    top: `${module.position}px`,
                    transform: `translateZ(${config.depth / 4}px)`,
                  }}
                />
              );
            }
            if (module.type === 'vertical_division') {
              return (
                <div
                  key={module.id}
                  className="absolute border-l border-border/30"
                  style={{
                    width: `${bodyThickness}px`,
                    height: `${config.height}px`,
                    backgroundColor: bodyColor,
                    left: `${module.position}px`,
                    transform: `translateZ(${config.depth / 4}px)`,
                  }}
                />
              );
            }
            return null;
          })
        )}
      </div>

      <style>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .preserve-3d {
          transform-style: preserve-3d;
        }
      `}</style>
    </div>
  );
}
