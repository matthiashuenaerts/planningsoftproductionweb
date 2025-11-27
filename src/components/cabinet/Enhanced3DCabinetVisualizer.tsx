import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import type { CabinetConfiguration } from '@/types/cabinet';
import type { ParametricPanel } from '@/types/cabinet';

interface CabinetFront {
  id: string;
  name: string;
  front_type: 'hinged_door' | 'drawer_front' | 'lift_up' | 'sliding';
  position_x: string;
  position_y: string;
  position_z: string;
  width: string;
  height: string;
  thickness: string;
  hinge_side?: 'left' | 'right' | 'top' | 'bottom';
  hardware_id?: string;
  quantity: number;
  material_type: string;
  visible: boolean;
}

interface CompartmentItem {
  id: string;
  item_type: 'horizontal_divider' | 'vertical_divider' | 'shelf' | 'legrabox_drawer';
  position_y: string;
  position_x: string;
  thickness: string;
  quantity: number;
  has_drilling: boolean;
  drilling_pattern?: string;
  legrabox_id?: string;
  material_type: string;
}

interface Compartment {
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

interface Enhanced3DCabinetVisualizerProps {
  config: CabinetConfiguration;
  materials?: any[];
  panels?: ParametricPanel[];
  fronts?: CabinetFront[];
  compartments?: Compartment[];
}

// Helper to evaluate parametric expressions
function evaluateExpression(
  expr: string | number,
  variables: Record<string, number>
): number {
  if (typeof expr === 'number') return expr;
  
  let evaluated = String(expr);
  
  // Sort keys by length (longest first) to avoid partial replacements
  const sortedKeys = Object.keys(variables).sort((a, b) => b.length - a.length);
  
  // Replace variables
  sortedKeys.forEach((key) => {
    evaluated = evaluated.replace(new RegExp(`\\b${key}\\b`, 'g'), String(variables[key]));
  });
  
  // Safely evaluate mathematical expressions
  try {
    return Function(`"use strict"; return (${evaluated})`)();
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

function LegraboxDrawer({
  position,
  width,
  depth,
  height,
  scale,
  color = '#4a4a4a'
}: {
  position: [number, number, number];
  width: number;
  depth: number;
  height: number;
  scale: number;
  color?: string;
}) {
  const w = width * scale;
  const d = depth * scale;
  const h = height * scale;
  const sideThickness = 12 * scale;
  const bottomThickness = 16 * scale;
  
  return (
    <group position={position}>
      {/* Left side */}
      <mesh position={[-w/2 + sideThickness/2, h/2, 0]} castShadow>
        <boxGeometry args={[sideThickness, h, d]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.3} />
      </mesh>
      {/* Right side */}
      <mesh position={[w/2 - sideThickness/2, h/2, 0]} castShadow>
        <boxGeometry args={[sideThickness, h, d]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.3} />
      </mesh>
      {/* Bottom */}
      <mesh position={[0, bottomThickness/2, 0]} castShadow>
        <boxGeometry args={[w - sideThickness*2, bottomThickness, d]} />
        <meshStandardMaterial color="#f0f0f0" roughness={0.8} />
      </mesh>
      {/* Back */}
      <mesh position={[0, h/2, -d/2 + sideThickness/2]} castShadow>
        <boxGeometry args={[w - sideThickness*2, h, sideThickness]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.3} />
      </mesh>
    </group>
  );
}

function CabinetStructure({ 
  config, 
  materials, 
  panels,
  fronts,
  compartments
}: { 
  config: CabinetConfiguration;
  materials: any[];
  panels?: ParametricPanel[];
  fronts?: CabinetFront[];
  compartments?: Compartment[];
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
  
  const renderedPanels = useMemo(() => {
    if (!panels || panels.length === 0) return null;
    
    return panels.filter(p => p.visible).map((panel) => {
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
    });
  }, [panels, variables, bodyColor, doorColor, shelfColor, scale]);
  
  const renderedFronts = useMemo(() => {
    if (!fronts || fronts.length === 0) return null;
    
    return fronts.filter(f => f.visible).map((front) => {
      const x = evaluateExpression(front.position_x, variables);
      const y = evaluateExpression(front.position_y, variables);
      const z = evaluateExpression(front.position_z, variables);
      const w = evaluateExpression(front.width, variables);
      const h = evaluateExpression(front.height, variables);
      const t = evaluateExpression(front.thickness, variables);
      
      const position: [number, number, number] = [
        (x + w / 2) * scale,
        (y + h / 2) * scale,
        (z + t / 2) * scale,
      ];
      
      return (
        <CabinetPanel
          key={front.id}
          position={position}
          dimensions={[w * scale, h * scale, t * scale]}
          color={doorColor}
        />
      );
    });
  }, [fronts, variables, doorColor, scale]);
  
  const renderedCompartmentItems = useMemo(() => {
    if (!compartments || compartments.length === 0) return null;
    
    const items: JSX.Element[] = [];
    
    compartments.forEach((compartment) => {
      const compX = evaluateExpression(compartment.position_x, variables);
      const compY = evaluateExpression(compartment.position_y, variables);
      const compZ = evaluateExpression(compartment.position_z, variables);
      const compW = evaluateExpression(compartment.width, variables);
      const compH = evaluateExpression(compartment.height, variables);
      const compD = evaluateExpression(compartment.depth, variables);
      
      compartment.items.forEach((item) => {
        if (item.item_type === 'legrabox_drawer') {
          const posY = evaluateExpression(item.position_y, variables);
          items.push(
            <LegraboxDrawer
              key={item.id}
              position={[
                (compX + compW / 2) * scale,
                (compY + posY) * scale,
                (compZ + compD / 2) * scale,
              ]}
              width={compW - 36} // Account for runner space
              depth={compD - 50}
              height={100}
              scale={scale}
            />
          );
        } else if (item.item_type === 'shelf') {
          const posY = evaluateExpression(item.position_y, variables);
          const thickness = evaluateExpression(item.thickness, variables);
          
          // Distribute shelves evenly if quantity > 1
          for (let i = 0; i < item.quantity; i++) {
            const yOffset = item.quantity > 1 
              ? (compH / (item.quantity + 1)) * (i + 1)
              : posY;
            
            items.push(
              <CabinetPanel
                key={`${item.id}-${i}`}
                position={[
                  (compX + compW / 2) * scale,
                  (compY + yOffset) * scale,
                  (compZ + compD / 2) * scale,
                ]}
                dimensions={[compW * scale, thickness * scale, compD * scale]}
                color={shelfColor}
              />
            );
          }
        } else if (item.item_type === 'horizontal_divider') {
          const posY = evaluateExpression(item.position_y, variables);
          const thickness = evaluateExpression(item.thickness, variables);
          
          items.push(
            <CabinetPanel
              key={item.id}
              position={[
                (compX + compW / 2) * scale,
                (compY + posY) * scale,
                (compZ + compD / 2) * scale,
              ]}
              dimensions={[compW * scale, thickness * scale, compD * scale]}
              color={bodyColor}
            />
          );
        } else if (item.item_type === 'vertical_divider') {
          const posX = evaluateExpression(item.position_x, variables);
          const thickness = evaluateExpression(item.thickness, variables);
          
          items.push(
            <CabinetPanel
              key={item.id}
              position={[
                (compX + posX) * scale,
                (compY + compH / 2) * scale,
                (compZ + compD / 2) * scale,
              ]}
              dimensions={[thickness * scale, compH * scale, compD * scale]}
              color={bodyColor}
            />
          );
        }
      });
    });
    
    return items;
  }, [compartments, variables, bodyColor, shelfColor, scale]);
  
  // If we have any parametric elements, render those
  if ((panels && panels.length > 0) || (fronts && fronts.length > 0) || (compartments && compartments.length > 0)) {
    return (
      <group>
        {renderedPanels}
        {renderedFronts}
        {renderedCompartmentItems}
      </group>
    );
  }
  
  // Default cabinet structure (fallback if nothing defined)
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
  panels,
  fronts,
  compartments
}: Enhanced3DCabinetVisualizerProps) {
  return (
    <div className="w-full h-[500px] bg-gradient-to-b from-muted/30 to-muted/10 rounded-lg overflow-hidden">
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
        <CabinetStructure 
          config={config} 
          materials={materials} 
          panels={panels}
          fronts={fronts}
          compartments={compartments}
        />
      </Canvas>
    </div>
  );
}
