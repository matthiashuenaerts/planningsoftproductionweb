import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

interface Cabinet3DThumbnailProps {
  width: number;
  height: number;
  depth: number;
  panels?: any[];
  fronts?: any[];
  doorType?: string;
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
  } catch {
    return 0;
  }
}

function CabinetMesh({ width, height, depth, panels, fronts, doorType }: Cabinet3DThumbnailProps) {
  const scale = 0.001; // Convert mm to meters
  const bodyColor = '#d4a574';
  const doorColor = '#c9a066';
  
  const variables = useMemo(() => ({
    width,
    height,
    depth,
    body_thickness: 18,
    door_thickness: 18,
    shelf_thickness: 18,
  }), [width, height, depth]);

  const renderedPanels = useMemo(() => {
    if (!panels || panels.length === 0) {
      // Default box cabinet
      return (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[width * scale, height * scale, depth * scale]} />
          <meshStandardMaterial color={bodyColor} />
        </mesh>
      );
    }

    return panels.filter(p => p.visible !== false).map((panel, index) => {
      const x = evaluateExpression(panel.x || 0, variables) * scale;
      const y = evaluateExpression(panel.y || 0, variables) * scale;
      const z = evaluateExpression(panel.z || 0, variables) * scale;
      const length = evaluateExpression(panel.length || 100, variables) * scale;
      const panelWidth = evaluateExpression(panel.width || 100, variables) * scale;
      const thickness = evaluateExpression(panel.thickness || 18, variables) * scale;

      const color = panel.material_type === 'door' ? doorColor : bodyColor;

      return (
        <mesh key={panel.id || index} position={[x, y, z]}>
          <boxGeometry args={[length, panelWidth, thickness]} />
          <meshStandardMaterial color={color} />
        </mesh>
      );
    });
  }, [panels, variables, scale]);

  const renderedFronts = useMemo(() => {
    if (!fronts) return null;

    return fronts.filter(f => f.visible !== false).map((front, index) => {
      const x = evaluateExpression(front.position_x || 0, variables) * scale;
      const y = evaluateExpression(front.position_y || 0, variables) * scale;
      const z = evaluateExpression(front.position_z || depth, variables) * scale;
      const w = evaluateExpression(front.width || width, variables) * scale;
      const h = evaluateExpression(front.height || height, variables) * scale;
      const t = evaluateExpression(front.thickness || 18, variables) * scale;

      return (
        <mesh key={front.id || index} position={[x, y, z]}>
          <boxGeometry args={[w, h, t]} />
          <meshStandardMaterial color={doorColor} />
        </mesh>
      );
    });
  }, [fronts, variables, scale, width, height, depth]);

  // If no panels, render a simple cabinet representation
  if (!panels || panels.length === 0) {
    const w = width * scale;
    const h = height * scale;
    const d = depth * scale;
    const t = 18 * scale; // thickness

    return (
      <group position={[0, 0, 0]}>
        {/* Bottom */}
        <mesh position={[0, -h/2 + t/2, 0]}>
          <boxGeometry args={[w, t, d]} />
          <meshStandardMaterial color={bodyColor} />
        </mesh>
        {/* Top */}
        <mesh position={[0, h/2 - t/2, 0]}>
          <boxGeometry args={[w, t, d]} />
          <meshStandardMaterial color={bodyColor} />
        </mesh>
        {/* Left side */}
        <mesh position={[-w/2 + t/2, 0, 0]}>
          <boxGeometry args={[t, h - 2*t, d]} />
          <meshStandardMaterial color={bodyColor} />
        </mesh>
        {/* Right side */}
        <mesh position={[w/2 - t/2, 0, 0]}>
          <boxGeometry args={[t, h - 2*t, d]} />
          <meshStandardMaterial color={bodyColor} />
        </mesh>
        {/* Back */}
        <mesh position={[0, 0, -d/2 + t/2]}>
          <boxGeometry args={[w - 2*t, h - 2*t, t]} />
          <meshStandardMaterial color={bodyColor} />
        </mesh>
        {/* Door */}
        {doorType !== 'none' && (
          <mesh position={[0, 0, d/2]}>
            <boxGeometry args={[w - 4*scale, h - 4*scale, t]} />
            <meshStandardMaterial color={doorColor} />
          </mesh>
        )}
      </group>
    );
  }

  return (
    <group>
      {renderedPanels}
      {renderedFronts}
    </group>
  );
}

export function Cabinet3DThumbnail({ width, height, depth, panels, fronts, doorType }: Cabinet3DThumbnailProps) {
  const maxDimension = Math.max(width, height, depth);
  const cameraDistance = maxDimension * 0.003;

  return (
    <Canvas>
      <PerspectiveCamera
        makeDefault
        position={[cameraDistance * 0.8, cameraDistance * 0.5, cameraDistance]}
        fov={40}
      />
      <OrbitControls 
        enableZoom={false} 
        enablePan={false}
        autoRotate
        autoRotateSpeed={2}
      />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <directionalLight position={[-5, 3, -5]} intensity={0.3} />
      <CabinetMesh 
        width={width} 
        height={height} 
        depth={depth}
        panels={panels}
        fronts={fronts}
        doorType={doorType}
      />
    </Canvas>
  );
}
