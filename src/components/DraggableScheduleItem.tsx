
import React from 'react';
import { useDrag } from 'react-dnd';

export const ItemTypes = {
  SCHEDULE_ITEM: 'scheduleItem',
  RESIZE_HANDLE: 'resizeHandle',
};

interface DraggableScheduleItemProps {
  item: any;
  onMove: (itemId: string, deltaY: number) => void;
  onResize: (itemId: string, deltaY: number) => void;
  children: React.ReactNode;
  isAdmin: boolean;
  MINUTE_TO_PIXEL_SCALE: number;
  formatTime: (time: string | Date) => string;
}

const DraggableScheduleItem: React.FC<DraggableScheduleItemProps> = ({ item, onMove, onResize, children, isAdmin, MINUTE_TO_PIXEL_SCALE, formatTime }) => {
  const [{ isDragging }, moveDrag] = useDrag(() => ({
    type: ItemTypes.SCHEDULE_ITEM,
    item: { id: item.id },
    canDrag: isAdmin,
    end: (draggedItem, monitor) => {
      const delta = monitor.getDifferenceFromInitialOffset();
      if (delta && delta.y !== 0) {
        onMove(draggedItem.id, delta.y);
      }
    },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }), [item.id, onMove, isAdmin]);

  const [{ isResizing, resizeDeltaY }, resizeDrag] = useDrag(() => ({
    type: ItemTypes.RESIZE_HANDLE,
    item: { id: item.id, type: 'resize' },
    canDrag: isAdmin,
    end: (draggedItem, monitor) => {
      const delta = monitor.getDifferenceFromInitialOffset();
      if (delta && delta.y !== 0) {
        onResize(draggedItem.id, delta.y);
      }
    },
    collect: (monitor) => ({
      isResizing: !!monitor.isDragging(),
      resizeDeltaY: monitor.getDifferenceFromInitialOffset()?.y || 0,
    }),
  }), [item.id, onResize, isAdmin]);

  const calculateNewEndTime = () => {
    if (!isResizing) return null;

    const minutesChange = Math.round((resizeDeltaY / MINUTE_TO_PIXEL_SCALE) / 5) * 5;
    
    const newEndTime = new Date(item.end_time);
    newEndTime.setMinutes(newEndTime.getMinutes() + minutesChange);
    
    return formatTime(newEndTime);
  };

  const newEndTimeString = calculateNewEndTime();

  return (
    <div
      ref={moveDrag}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: isAdmin ? 'move' : 'default',
      }}
      className="h-full relative"
    >
      {children}
      {isAdmin && (
        <div
          ref={resizeDrag}
          className="absolute bottom-0 left-0 right-0 h-4 cursor-ns-resize flex items-end justify-center"
        >
          <div className="w-8 h-1 bg-gray-600 rounded-full" />
        </div>
      )}
      {isResizing && (
        <div className="absolute inset-0 bg-blue-400/20 rounded pointer-events-none flex items-end justify-end p-2">
          {newEndTimeString && (
            <div className="text-xs bg-white/80 backdrop-blur-sm font-semibold p-1 rounded shadow-lg">
              {newEndTimeString}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DraggableScheduleItem;
