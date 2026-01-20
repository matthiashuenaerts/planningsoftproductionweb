import { useRef, useCallback, useEffect } from 'react';

interface TouchHandlerConfig {
  containerRef: React.RefObject<HTMLDivElement>;
  scale: number;
  setScale: (scale: number | ((prev: number) => number)) => void;
  minScale?: number;
  maxScale?: number;
  activeTool: 'select' | 'cursor' | 'draw' | 'text' | 'rectangle' | 'circle' | 'erase';
  isEditMode: boolean;
  onPenDrawStart?: (pageNum: number) => void;
  onPenDrawEnd?: () => void;
  getPageAtPoint?: (x: number, y: number) => number | null;
}

interface TouchState {
  isPanning: boolean;
  isPinching: boolean;
  isPenDrawing: boolean;
  startX: number;
  startY: number;
  startScrollLeft: number;
  startScrollTop: number;
  lastX: number;
  lastY: number;
  velocityX: number;
  velocityY: number;
  lastMoveTime: number;
  pinchStartDistance: number;
  pinchStartScale: number;
  pinchCenterX: number;
  pinchCenterY: number;
}

export function usePDFTouchHandler(config: TouchHandlerConfig) {
  const {
    containerRef,
    scale,
    setScale,
    minScale = 0.5,
    maxScale = 3,
    activeTool,
    isEditMode,
    onPenDrawStart,
    onPenDrawEnd,
    getPageAtPoint,
  } = config;

  const stateRef = useRef<TouchState>({
    isPanning: false,
    isPinching: false,
    isPenDrawing: false,
    startX: 0,
    startY: 0,
    startScrollLeft: 0,
    startScrollTop: 0,
    lastX: 0,
    lastY: 0,
    velocityX: 0,
    velocityY: 0,
    lastMoveTime: 0,
    pinchStartDistance: 0,
    pinchStartScale: 1,
    pinchCenterX: 0,
    pinchCenterY: 0,
  });

  const momentumAnimationRef = useRef<number | null>(null);
  const zoomAnimationRef = useRef<number | null>(null);
  const targetScaleRef = useRef<number>(scale);
  const activeTouchesRef = useRef<Map<number, PointerEvent>>(new Map());

  // Calculate distance between two touch points
  const getDistance = useCallback((p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }, []);

  // Get center point between two touches
  const getCenter = useCallback((p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };
  }, []);

  // Stop any ongoing momentum animation
  const stopMomentum = useCallback(() => {
    if (momentumAnimationRef.current) {
      cancelAnimationFrame(momentumAnimationRef.current);
      momentumAnimationRef.current = null;
    }
    if (zoomAnimationRef.current) {
      cancelAnimationFrame(zoomAnimationRef.current);
      zoomAnimationRef.current = null;
    }
  }, []);

  // Apply momentum scrolling after pan ends
  const applyMomentum = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const state = stateRef.current;
    const friction = 0.95;
    const minVelocity = 0.5;

    const animate = () => {
      if (Math.abs(state.velocityX) < minVelocity && Math.abs(state.velocityY) < minVelocity) {
        stopMomentum();
        return;
      }

      container.scrollLeft -= state.velocityX;
      container.scrollTop -= state.velocityY;

      state.velocityX *= friction;
      state.velocityY *= friction;

      momentumAnimationRef.current = requestAnimationFrame(animate);
    };

    momentumAnimationRef.current = requestAnimationFrame(animate);
  }, [containerRef, stopMomentum]);

  // Handle pointer down
  const handlePointerDown = useCallback((e: PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;

    // Pen/stylus detection - let it pass through to Fabric completely
    // Don't track it or interfere with it at all
    if (e.pointerType === 'pen') {
      // Find which page the pen is on and notify
      if (getPageAtPoint) {
        const pageNum = getPageAtPoint(e.clientX, e.clientY);
        if (pageNum !== null) {
          stateRef.current.isPenDrawing = true;
          onPenDrawStart?.(pageNum);
        }
      }
      // Let the event propagate to Fabric - don't preventDefault, don't stopPropagation
      return;
    }

    // Track all active touches (non-pen only)
    activeTouchesRef.current.set(e.pointerId, e);
    const touches = Array.from(activeTouchesRef.current.values());

    stopMomentum();

    // Two-finger pinch detection
    if (touches.length === 2) {
      e.preventDefault();
      
      const p1 = { x: touches[0].clientX, y: touches[0].clientY };
      const p2 = { x: touches[1].clientX, y: touches[1].clientY };
      
      const state = stateRef.current;
      state.isPinching = true;
      state.isPanning = false;
      state.pinchStartDistance = getDistance(p1, p2);
      state.pinchStartScale = scale;
      
      const center = getCenter(p1, p2);
      state.pinchCenterX = center.x;
      state.pinchCenterY = center.y;
      
      return;
    }

    // Single touch/mouse - pan mode or cursor tool
    if (touches.length === 1 && (activeTool === 'cursor' || !isEditMode)) {
      if (e.pointerType !== 'pen') {
        e.preventDefault();
        
        const state = stateRef.current;
        state.isPanning = true;
        state.startX = e.clientX;
        state.startY = e.clientY;
        state.lastX = e.clientX;
        state.lastY = e.clientY;
        state.startScrollLeft = container.scrollLeft;
        state.startScrollTop = container.scrollTop;
        state.velocityX = 0;
        state.velocityY = 0;
        state.lastMoveTime = performance.now();
        
        container.style.cursor = 'grabbing';
      }
    }
  }, [containerRef, scale, activeTool, isEditMode, getPageAtPoint, onPenDrawStart, stopMomentum, getDistance, getCenter]);

  // Handle pointer move
  const handlePointerMove = useCallback((e: PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;

    const state = stateRef.current;

    // Pen drawing - let Fabric handle it completely, don't interfere
    if (e.pointerType === 'pen' && state.isPenDrawing) {
      return;
    }

    // Update tracked touch (non-pen only)
    if (activeTouchesRef.current.has(e.pointerId)) {
      activeTouchesRef.current.set(e.pointerId, e);
    }

    const touches = Array.from(activeTouchesRef.current.values());

    // Pinch-to-zoom with smooth animation
    if (state.isPinching && touches.length === 2) {
      e.preventDefault();
      
      const p1 = { x: touches[0].clientX, y: touches[0].clientY };
      const p2 = { x: touches[1].clientX, y: touches[1].clientY };
      
      const currentDistance = getDistance(p1, p2);
      const scaleRatio = currentDistance / state.pinchStartDistance;
      let newScale = state.pinchStartScale * scaleRatio;
      
      // Clamp scale
      newScale = Math.max(minScale, Math.min(maxScale, newScale));
      
      // Calculate zoom center for better UX
      const center = getCenter(p1, p2);
      const containerRect = container.getBoundingClientRect();
      
      // Get scroll position relative to center
      const relativeX = (center.x - containerRect.left + container.scrollLeft) / scale;
      const relativeY = (center.y - containerRect.top + container.scrollTop) / scale;
      
      // Smooth scale transition using requestAnimationFrame
      targetScaleRef.current = newScale;
      
      if (!zoomAnimationRef.current) {
        const animateZoom = () => {
          const currentScale = scale;
          const target = targetScaleRef.current;
          const diff = target - currentScale;
          
          // Smooth interpolation factor (higher = faster)
          const smoothFactor = 0.3;
          const newAnimatedScale = currentScale + diff * smoothFactor;
          
          // Apply scale if difference is significant
          if (Math.abs(diff) > 0.001) {
            setScale(newAnimatedScale);
            
            // Adjust scroll to keep zoom centered
            const newScrollX = relativeX * newAnimatedScale - (center.x - containerRect.left);
            const newScrollY = relativeY * newAnimatedScale - (center.y - containerRect.top);
            container.scrollLeft = newScrollX;
            container.scrollTop = newScrollY;
            
            zoomAnimationRef.current = requestAnimationFrame(animateZoom);
          } else {
            setScale(target);
            zoomAnimationRef.current = null;
          }
        };
        
        zoomAnimationRef.current = requestAnimationFrame(animateZoom);
      }
      
      return;
    }

    // Panning
    if (state.isPanning) {
      e.preventDefault();
      
      const now = performance.now();
      const dt = now - state.lastMoveTime;
      
      const dx = e.clientX - state.lastX;
      const dy = e.clientY - state.lastY;
      
      // Calculate velocity for momentum
      if (dt > 0) {
        state.velocityX = dx / (dt / 16); // Normalize to ~60fps
        state.velocityY = dy / (dt / 16);
      }
      
      container.scrollLeft = state.startScrollLeft - (e.clientX - state.startX);
      container.scrollTop = state.startScrollTop - (e.clientY - state.startY);
      
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      state.lastMoveTime = now;
    }
  }, [containerRef, scale, setScale, minScale, maxScale, getDistance, getCenter]);

  // Handle pointer up
  const handlePointerUp = useCallback((e: PointerEvent) => {
    const container = containerRef.current;
    
    const state = stateRef.current;

    // End pen drawing - let Fabric finalize the path first, then notify
    if (e.pointerType === 'pen' && state.isPenDrawing) {
      // Use setTimeout to let Fabric process the pointer up event first
      setTimeout(() => {
        state.isPenDrawing = false;
        onPenDrawEnd?.();
      }, 50);
      return;
    }
    
    // Remove from active touches (non-pen only)
    activeTouchesRef.current.delete(e.pointerId);

    // End pinching when one finger lifts
    if (state.isPinching) {
      if (activeTouchesRef.current.size < 2) {
        state.isPinching = false;
      }
      return;
    }

    // End panning with momentum
    if (state.isPanning) {
      state.isPanning = false;
      if (container) {
        container.style.cursor = activeTool === 'cursor' ? 'grab' : '';
      }
      
      // Apply momentum if velocity is significant
      if (Math.abs(state.velocityX) > 2 || Math.abs(state.velocityY) > 2) {
        applyMomentum();
      }
    }
  }, [containerRef, activeTool, onPenDrawEnd, applyMomentum]);

  // Handle pointer cancel/leave
  const handlePointerCancel = useCallback((e: PointerEvent) => {
    activeTouchesRef.current.delete(e.pointerId);
    
    const state = stateRef.current;
    if (state.isPenDrawing) {
      state.isPenDrawing = false;
      onPenDrawEnd?.();
    }
    if (state.isPanning) {
      state.isPanning = false;
    }
    if (state.isPinching) {
      state.isPinching = false;
    }
  }, [onPenDrawEnd]);

  // Attach event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Use capture phase for pan/pinch, but let pen events through
    const options = { passive: false, capture: false };
    
    container.addEventListener('pointerdown', handlePointerDown, options);
    container.addEventListener('pointermove', handlePointerMove, options);
    container.addEventListener('pointerup', handlePointerUp, options);
    container.addEventListener('pointercancel', handlePointerCancel, options);
    container.addEventListener('pointerleave', handlePointerCancel, options);

    // Prevent default touch behavior for better control
    const preventTouchDefault = (e: TouchEvent) => {
      const state = stateRef.current;
      if (state.isPinching || state.isPanning) {
        e.preventDefault();
      }
    };
    
    container.addEventListener('touchmove', preventTouchDefault, { passive: false });

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, options);
      container.removeEventListener('pointermove', handlePointerMove, options);
      container.removeEventListener('pointerup', handlePointerUp, options);
      container.removeEventListener('pointercancel', handlePointerCancel, options);
      container.removeEventListener('pointerleave', handlePointerCancel, options);
      container.removeEventListener('touchmove', preventTouchDefault);
      stopMomentum();
    };
  }, [containerRef, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel, stopMomentum]);

  return {
    isPanning: stateRef.current.isPanning,
    isPinching: stateRef.current.isPinching,
    isPenDrawing: stateRef.current.isPenDrawing,
  };
}
