
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
}

const DraggableScheduleItem: React.FC<DraggableScheduleItemProps> = ({ item, onMove, onResize, children, isAdmin }) => {
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

  const [{ isResizing }, resizeDrag] = useDrag(() => ({
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
    }),
  }), [item.id, onResize, isAdmin]);

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
      {isResizing && <div className="absolute inset-0 bg-blue-400/20 rounded" />}
    </div>
  );
};

export default DraggableScheduleItem;
