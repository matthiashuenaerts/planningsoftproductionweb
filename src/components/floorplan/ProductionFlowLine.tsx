import React from 'react';
import { ProductionFlowLine as FlowLine } from '@/services/floorplanService';

interface ProductionFlowLineProps {
  line: FlowLine;
  containerRect: DOMRect;
  isEditing: boolean;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<FlowLine>) => void;
}

export const ProductionFlowLine: React.FC<ProductionFlowLineProps> = ({
  line,
  containerRect,
  isEditing,
  onDelete,
  onUpdate
}) => {
  const startX = (line.start_x / 100) * containerRect.width;
  const startY = (line.start_y / 100) * containerRect.height;
  const endX = (line.end_x / 100) * containerRect.width;
  const endY = (line.end_y / 100) * containerRect.height;
  
  // Calculate midpoint for direction indicator
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  const handleClick = (e: React.MouseEvent) => {
    if (isEditing) {
      e.stopPropagation();
      if (onDelete) {
        onDelete(line.id);
      }
    }
  };

  return (
    <g>
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke={line.color}
        strokeWidth={line.stroke_width}
        strokeDasharray={isEditing ? "5,5" : "none"}
        style={{ cursor: isEditing ? 'pointer' : 'default' }}
        onClick={handleClick}
      />
      
      {/* Direction indicator - small ">" in the middle */}
      <text
        x={midX}
        y={midY}
        fill={line.color}
        fontSize="14"
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="central"
        className="pointer-events-none select-none"
        style={{ cursor: isEditing ? 'pointer' : 'default' }}
        onClick={handleClick}
      >
        &gt;
      </text>
      
      {/* Label */}
      <text
        x={midX}
        y={midY - 15}
        fill={line.color}
        fontSize="12"
        textAnchor="middle"
        style={{ cursor: isEditing ? 'pointer' : 'default' }}
        onClick={handleClick}
      >
        {line.name}
      </text>
      
      {isEditing && (
        <circle
          cx={(startX + endX) / 2}
          cy={(startY + endY) / 2}
          r="8"
          fill="red"
          stroke="white"
          strokeWidth="2"
          style={{ cursor: 'pointer' }}
          onClick={handleClick}
        >
          <title>Click to delete</title>
        </circle>
      )}
    </g>
  );
};