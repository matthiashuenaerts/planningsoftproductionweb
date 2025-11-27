import { useRef, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';
import type { CabinetConfiguration } from '@/types/cabinet';
import type { ParametricPanel } from '@/types/cabinet';

interface Enhanced3DCabinetVisualizerProps {
  config: CabinetConfiguration;
  materials?: any[];
  panels?: ParametricPanel[];
}

// Helper to evaluate parametric expressions
function evaluateExpression(
  expr: string | number,
  variables: Record<string, number>
): number {
  if (typeof expr === 'number') return expr;
  
  let evaluated = String(expr);
  
  // Replace variables
  Object.entries(variables).forEach(([key, value]) => {
    evaluated = evaluated.replace(new RegExp(key, 'g'), String(value));
  });
  
  // Safely evaluate mathematical expressions
  try {
    // Replace common operators
    evaluated = evaluated.replace(/\*/g, '*').replace(/\//g, '/');
    return eval(evaluated);
  } catch (e) {
    console.error('Failed to evaluate expression:', expr, e);
    return 0;
  }
}

function CabinetPanel({ 
  position, 
  dimensions, 
  color 
}: { 
  position: [number, number, number];
  dimensions: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={dimensions} />
      <meshStandardMaterial 
        color={color} 
        roughness={0.6}
        metalness={0.1}
      />
    </mesh>
  );
}

function CabinetStructure({ 
  config, 
  materials, 
  panels 
}: { 
  config: CabinetConfiguration;
  materials: any[];
  panels?: ParametricPanel[];
}) {
  const bodyMaterial = materials.find(m => m.id === config.material_config.body_material);
  const doorMaterial = materials.find(m => m.id === config.material_config.door_material);
  const shelfMaterial = materials.find(m => m.id === config.material_config.shelf_material);
  
  const bodyColor = bodyMaterial?.color || '#8B7355';
  const doorColor = doorMaterial?.color || '#A0826D';
  const shelfColor = shelfMaterial?.color || '#9B8B7A';
  
  const bodyThickness = config.material_config.body_thickness || 18;
  const doorThickness = config.material_config.door_thickness || 18;
  const shelfThickness = config.material_config.shelf_thickness || 18;
  
  // Variable context for evaluating expressions
  const variables = useMemo(() => ({
    width: config.width,
    height: config.height,
    depth: config.depth,
    body_thickness: bodyThickness,
    door_thickness: doorThickness,
    shelf_thickness: shelfThickness,
  }), [config, bodyThickness, doorThickness, shelfThickness]);
  
  // Convert mm to meters for Three.js (1mm = 0.001m), but scale for better visibility
  const scale = 0.002;
  
  // If we have parametric panels, render those
  if (panels && panels.length > 0) {
    return (
      <group>
        {panels.filter(p => p.visible).map((panel) => {
          const x = evaluateExpression(panel.x, variables);
          const y = evaluateExpression(panel.y, variables);
          const z = evaluateExpression(panel.z, variables);
          const length = evaluateExpression(panel.length, variables);
          const width = evaluateExpression(panel.width, variables);
          const thickness = evaluateExpression(panel.thickness, variables);
          
          // Determine color based on material type
          let color = bodyColor;
          if (panel.material_type === 'door') color = doorColor;
          if (panel.material_type === 'shelf') color = shelfColor;
          if (panel.color) color = panel.color;
          
          // Position is centered in Three.js, so adjust
          const position: [number, number, number] = [
            (x + length / 2) * scale,
            (y + thickness / 2) * scale,
            (z + width / 2) * scale,
          ];
          
          const dimensions: [number, number, number] = [
            length * scale,
            thickness * scale,
            width * scale,
          ];
          
          return (
            <CabinetPanel
              key={panel.id}
              position={position}
              dimensions={dimensions}
              color={color}
            />
          );
        })}
      </group>
    );
  }
  
  // Default cabinet structure (fallback if no panels defined)
  const w = config.width * scale;
  const h = config.height * scale;
  const d = config.depth * scale;
  const bt = bodyThickness * scale;
  
  return (
    <group>
      {/* Bottom */}
      <CabinetPanel
        position={[0, bt / 2, 0]}
        dimensions={[w, bt, d]}
        color={bodyColor}
      />
      
      {/* Top */}
      <CabinetPanel
        position={[0, h - bt / 2, 0]}
        dimensions={[w, bt, d]}
        color={bodyColor}
      />
      
      {/* Left Side */}
      <CabinetPanel
        position={[-w / 2 + bt / 2, h / 2, 0]}
        dimensions={[bt, h, d]}
        color={bodyColor}
      />
      
      {/* Right Side */}
      <CabinetPanel
        position={[w / 2 - bt / 2, h / 2, 0]}
        dimensions={[bt, h, d]}
        color={bodyColor}
      />
      
      {/* Back */}
      <CabinetPanel
        position={[0, h / 2, -d / 2 + bt / 2]}
        dimensions={[w - bt * 2, h - bt * 2, bt]}
        color={bodyColor}
      />
      
      {/* Shelves from compartments */}
      {config.compartments.map((comp) =>
        comp.modules
          .filter(m => m.type === 'shelf' || m.type === 'horizontal_division')
          .map((module) => {
            const shelfY = (module.position || 0) * scale;
            return (
              <CabinetPanel
                key={module.id}
                position={[0, shelfY, 0]}
                dimensions={[w - bt * 2, shelfThickness * scale, d - bt * 2]}
                color={shelfColor}
              />
            );
          })
      )}
      
      {/* Doors (if not 'none') */}
      {config.door_type !== 'none' && (
        <>
          <CabinetPanel
            position={[-w / 4, h / 2, d / 2 + doorThickness * scale / 2 + 2 * scale]}
            dimensions={[w / 2 - 4 * scale, h - 40 * scale, doorThickness * scale]}
            color={doorColor}
          />
          <CabinetPanel
            position={[w / 4, h / 2, d / 2 + doorThickness * scale / 2 + 2 * scale]}
            dimensions={[w / 2 - 4 * scale, h - 40 * scale, doorThickness * scale]}
            color={doorColor}
          />
        </>
      )}
    </group>
  );
}

export function Enhanced3DCabinetVisualizer({ 
  config, 
  materials = [], 
  panels 
}: Enhanced3DCabinetVisualizerProps) {
  return (
    <div className="w-full h-[600px] bg-gradient-to-b from-muted/30 to-muted/10 rounded-lg overflow-hidden">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[3, 2, 3]} fov={50} />
        <OrbitControls 
          enableDamping
          dampingFactor={0.05}
          minDistance={1}
          maxDistance={10}
          maxPolarAngle={Math.PI / 2}
        />
        
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[5, 10, 5]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={50}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        <directionalLight position={[-5, 5, -5]} intensity={0.3} />
        <spotLight position={[0, 10, 0]} intensity={0.3} angle={0.3} penumbra={1} castShadow />
        
        {/* Environment */}
        <Environment preset="apartment" />
        
        {/* Ground plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <shadowMaterial opacity={0.2} />
        </mesh>
        
        {/* Cabinet */}
        <CabinetStructure config={config} materials={materials} panels={panels} />
      </Canvas>
    </div>
  );
}
