import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { WorkstationStatus } from '@/services/floorplanService';

interface ImageAwareWorkstationDotProps {
  workstation: {
    id: string;
    name: string;
    description?: string;
  };
  position: {
    x: number; // Percentage relative to image
    y: number; // Percentage relative to image
  };
  status?: WorkstationStatus;
  isEditing: boolean;
  onPositionChange?: (workstationId: string, x: number, y: number) => void;
  onClick?: (workstation: any) => void;
  imageRef: React.RefObject<HTMLImageElement>;
}

export const ImageAwareWorkstationDot: React.FC<ImageAwareWorkstationDotProps> = ({
  workstation,
  position,
  status,
  isEditing,
  onPositionChange,
  onClick,
  imageRef
}) => {
  const [actualPosition, setActualPosition] = useState({ left: 0, top: 0 });

  // Calculate actual pixel position based on image dimensions
  useEffect(() => {
    const updatePosition = () => {
      if (!imageRef.current) return;
      
      const imageRect = imageRef.current.getBoundingClientRect();
      const containerRect = imageRef.current.parentElement?.getBoundingClientRect();
      
      if (!containerRect) return;
      
      // Calculate the actual position relative to the container
      const left = imageRect.left - containerRect.left + (imageRect.width * position.x / 100);
      const top = imageRect.top - containerRect.top + (imageRect.height * position.y / 100);
      
      setActualPosition({ left, top });
    };

    updatePosition();
    
    // Update position when window resizes or image loads
    const handleResize = () => updatePosition();
    const handleImageLoad = () => updatePosition();
    
    window.addEventListener('resize', handleResize);
    const imageElement = imageRef.current;
    
    if (imageElement) {
      imageElement.addEventListener('load', handleImageLoad);
      // Also update if image is already loaded
      if (imageElement.complete) {
        updatePosition();
      }
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (imageElement) {
        imageElement.removeEventListener('load', handleImageLoad);
      }
    };
  }, [position, imageRef]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isEditing || !onPositionChange) return;
    e.preventDefault();
    e.stopPropagation();
    
    const handleMouseMove = (moveE: MouseEvent) => {
      if (!imageRef.current) return;
      
      const imageRect = imageRef.current.getBoundingClientRect();
      
      // Calculate position relative to the actual image
      const x = ((moveE.clientX - imageRect.left) / imageRect.width) * 100;
      const y = ((moveE.clientY - imageRect.top) / imageRect.height) * 100;
      
      // Clamp values between 0 and 100
      const clampedX = Math.max(0, Math.min(100, x));
      const clampedY = Math.max(0, Math.min(100, y));
      
      onPositionChange(workstation.id, clampedX, clampedY);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const getStatusColor = () => {
    if (!status) return 'bg-orange-500'; // Not in use (no status data)
    if (status.has_error) return 'bg-red-500'; // Error
    if (status.is_active) return 'bg-green-500'; // In use
    return 'bg-orange-500'; // Available/Not in use
  };

  const getStatusText = () => {
    if (!status) return 'Not in use';
    if (status.has_error) return 'Error';
    if (status.is_active) return `In use (${status.active_users_count} user${status.active_users_count > 1 ? 's' : ''})`;
    return 'Available';
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
              left: `${actualPosition.left}px`,
              top: `${actualPosition.top}px`,
              zIndex: 10,
            }}
            onMouseDown={handleMouseDown}
            onClick={(e) => {
              e.stopPropagation();
              if (!isEditing) onClick?.(workstation);
            }}
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