import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { WorkstationStatus } from '@/services/floorplanService';

interface WorkstationDotProps {
  workstation: {
    id: string;
    name: string;
    description?: string;
  };
  position: {
    x: number;
    y: number;
  };
  status?: WorkstationStatus;
  isEditing: boolean;
  onPositionChange?: (workstationId: string, x: number, y: number) => void;
  onClick?: (workstation: any) => void;
}

export const WorkstationDot: React.FC<WorkstationDotProps> = ({
  workstation,
  position,
  status,
  isEditing,
  onPositionChange,
  onClick
}) => {
  const handleDragEnd = (e: React.DragEvent) => {
    if (!isEditing || !onPositionChange) return;
    
    const rect = e.currentTarget.closest('.floorplan-container')?.getBoundingClientRect();
    if (!rect) return;
    
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    onPositionChange(workstation.id, x, y);
  };

  const getStatusColor = () => {
    if (!status || !status.is_active) return 'bg-green-500'; // Available
    return 'bg-red-500'; // In use
  };

  const getStatusText = () => {
    if (!status || !status.is_active) return 'Available';
    return `In use (${status.active_users_count} user${status.active_users_count > 1 ? 's' : ''})`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
              isEditing ? 'cursor-move' : 'cursor-pointer'
            }`}
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
            }}
            draggable={isEditing}
            onDragEnd={handleDragEnd}
            onClick={() => !isEditing && onClick?.(workstation)}
          >
            <div className={`w-4 h-4 rounded-full border-2 border-white shadow-lg ${getStatusColor()}`}>
              {status && status.is_active && status.active_users_count > 0 && (
                <Badge
                  variant="secondary"
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full p-0 flex items-center justify-center text-xs bg-background border"
                >
                  {status.active_users_count}
                </Badge>
              )}
            </div>
            {isEditing && (
              <div className="absolute top-5 left-1/2 transform -translate-x-1/2 bg-background border rounded px-2 py-1 text-xs whitespace-nowrap shadow-lg">
                {workstation.name}
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <div className="font-semibold">{workstation.name}</div>
            {workstation.description && (
              <div className="text-sm text-muted-foreground">{workstation.description}</div>
            )}
            <div className="text-sm">Status: {getStatusText()}</div>
            {status && status.is_active && status.active_user_names.length > 0 && (
              <div className="text-sm">
                Active users: {status.active_user_names.join(', ')}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};