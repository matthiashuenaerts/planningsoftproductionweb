import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePDFTouchHandler } from '@/hooks/usePDFTouchHandler';
import { 
  Save, 
  Download, 
  ZoomIn,
  ZoomOut,
  Edit3,
  Eye,
  Type,
  Square,
  Circle,
  Undo,
  Redo,
  Pencil,
  Eraser,
  Move,
  Trash2,
  X,
  RotateCcw,
  ExternalLink,
  Ruler,
  Hand
} from 'lucide-react';
import { Canvas as FabricCanvas, Rect, Circle as FabricCircle, Textbox, Path, PencilBrush, Point } from 'fabric';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface PDFViewerEditorProps {
  pdfUrl: string;
  projectId: string;
  fileName: string;
  onSave?: () => void;
  onClose?: () => void;
  fullscreen?: boolean;
}

type ToolType = 'select' | 'cursor' | 'draw' | 'text' | 'rectangle' | 'circle' | 'erase';

// All annotation positions are stored as PERCENTAGES (0-1) of page dimensions
// This makes them completely scale-independent
interface AnnotationData {
  type: string;
  // Position as percentage of page width/height (0-1 range)
  leftPct: number;
  topPct: number;
  // Dimensions as percentage of page width/height
  widthPct?: number;
  heightPct?: number;
  fill?: string;
  stroke?: string;
  // Stroke width as percentage of page width
  strokeWidthPct?: number;
  text?: string;
  // Font size as percentage of page height
  fontSizePct?: number;
  fontFamily?: string;
  // Radius as percentage of page width
  radiusPct?: number;
  // Path data - stored in normalized coordinates (percentages of page size)
  path?: any;
  // Fabric Path internal offset (persisted to prevent drift at non-integer zoom levels)
  pathOffsetXPct?: number;
  pathOffsetYPct?: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
}

interface PageData {
  pageNum: number;
  width: number;
  height: number;
}

const PDFViewerEditor: React.FC<PDFViewerEditorProps> = ({ 
  pdfUrl, 
  projectId, 
  fileName, 
  onSave,
  onClose,
  fullscreen = false
}) => {
  const { toast } = useToast();
  
  // Mode state - default to pan/view mode
  const [isEditMode, setIsEditMode] = useState(false);
  
  // PDF state
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [originalPdfBytes, setOriginalPdfBytes] = useState<Uint8Array | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Page data for continuous scroll
  const [pagesData, setPagesData] = useState<PageData[]>([]);
  const [currentVisiblePage, setCurrentVisiblePage] = useState(1);
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  
  // Canvas refs - one per page
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const pdfCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const overlayCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const fabricCanvasRefs = useRef<Map<number, FabricCanvas>>(new Map());
  
  // Tool state - default to cursor (pan) mode
  const [activeTool, setActiveTool] = useState<ToolType>('cursor');
  const [drawingColor, setDrawingColor] = useState('#ff0000');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [fontSize, setFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState('Arial');
  
  // Refs to hold current values for use in event handlers (avoid closure issues)
  const activeToolRef = useRef<ToolType>('cursor');
  const isEditModeRef = useRef(false);
  const drawingColorRef = useRef('#ff0000');
  const strokeWidthRef = useRef(3);
  const fontSizeRef = useRef(18);
  const fontFamilyRef = useRef('Arial');
  
  // History state (per page)
  const canvasHistoryRef = useRef<Map<number, string[]>>(new Map());
  const historyIndexRef = useRef<Map<number, number>>(new Map());
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [canvasHistoryLength, setCanvasHistoryLength] = useState(0);
  
  // Annotations per page
  const pageAnnotationsRef = useRef<Map<number, AnnotationData[]>>(new Map());
  
  // Auto-save state
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasUnsavedChanges = useRef(false);
  
  // Debounce scale changes to prevent race conditions when zooming fast
  const scaleChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingScaleRef = useRef<number | null>(null);
  
  // Flag to prevent saving state during undo/redo operations
  const isRestoringHistoryRef = useRef(false);
  
  // Smart line straightening state
  const [lineSnapEnabled, setLineSnapEnabled] = useState(true);
  const lineSnapEnabledRef = useRef(true);
  
  // Pen drawing state for cursor mode
  const penDrawingPageRef = useRef<number | null>(null);
  
  useEffect(() => {
    lineSnapEnabledRef.current = lineSnapEnabled;
  }, [lineSnapEnabled]);
  
  // Keep refs in sync with state for use in event handlers
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);
  
  useEffect(() => {
    isEditModeRef.current = isEditMode;
  }, [isEditMode]);
  
  useEffect(() => {
    drawingColorRef.current = drawingColor;
  }, [drawingColor]);
  
  useEffect(() => {
    strokeWidthRef.current = strokeWidth;
  }, [strokeWidth]);
  
  useEffect(() => {
    fontSizeRef.current = fontSize;
  }, [fontSize]);
  
  useEffect(() => {
    fontFamilyRef.current = fontFamily;
  }, [fontFamily]);

  // Get page number at a specific point
  const getPageAtPoint = useCallback((clientX: number, clientY: number): number | null => {
    for (const [pageNum, pageDiv] of pageRefs.current.entries()) {
      const rect = pageDiv.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right && 
          clientY >= rect.top && clientY <= rect.bottom) {
        return pageNum;
      }
    }
    return null;
  }, []);

  // Handle pen draw start (from touch handler) - always allow Apple Pencil drawing/erasing
  const handlePenDrawStart = useCallback((pageNum: number) => {
    const canvas = fabricCanvasRefs.current.get(pageNum);
    if (canvas) {
      penDrawingPageRef.current = pageNum;
      
      // Check if we're in erase mode - enable eraser behavior for pen
      const currentTool = activeToolRef.current;
      if (currentTool === 'erase') {
        // Enable eraser mode for pen - disable drawing, enable object events
        canvas.isDrawingMode = false;
        canvas.selection = false;
        canvas.hoverCursor = 'not-allowed';
        canvas.defaultCursor = 'not-allowed';
        
        // Make all objects respond to mouse events for swipe delete
        canvas.getObjects().forEach(obj => {
          obj.selectable = false;
          obj.evented = true;
          obj.hoverCursor = 'not-allowed';
        });
        canvas.requestRenderAll();
      } else {
        // Normal drawing mode
        canvas.isDrawingMode = true;
        if (canvas.freeDrawingBrush) {
          canvas.freeDrawingBrush.color = drawingColorRef.current;
          canvas.freeDrawingBrush.width = strokeWidthRef.current;
        }
      }
      
      // Temporarily enable pointer events for drawing/erasing
      const overlayEl = overlayCanvasRefs.current.get(pageNum)?.parentElement;
      if (overlayEl) {
        overlayEl.style.pointerEvents = 'auto';
      }
    }
  }, []);

  // Handle pen draw end (from touch handler)
  const handlePenDrawEnd = useCallback(() => {
    if (penDrawingPageRef.current !== null) {
      const pageNum = penDrawingPageRef.current;
      const canvas = fabricCanvasRefs.current.get(pageNum);
      
      // Only disable drawing mode if we're not in draw tool mode
      // Delay slightly to let Fabric finalize the path
      if (canvas && activeToolRef.current !== 'draw') {
        setTimeout(() => {
          if (penDrawingPageRef.current === null && activeToolRef.current !== 'draw') {
            canvas.isDrawingMode = false;
          }
        }, 100);
      }
      
      // Restore pointer events based on edit mode
      const overlayEl = overlayCanvasRefs.current.get(pageNum)?.parentElement;
      if (overlayEl && !isEditModeRef.current) {
        // Delay pointer events restoration to allow path finalization
        setTimeout(() => {
          if (penDrawingPageRef.current === null && !isEditModeRef.current) {
            overlayEl.style.pointerEvents = 'none';
          }
        }, 150);
      }
      
      penDrawingPageRef.current = null;
    }
  }, []);

  // Initialize touch handler
  usePDFTouchHandler({
    containerRef: canvasContainerRef,
    scale,
    setScale,
    minScale: 0.5,
    maxScale: 3,
    activeTool,
    isEditMode,
    onPenDrawStart: handlePenDrawStart,
    onPenDrawEnd: handlePenDrawEnd,
    getPageAtPoint,
  });

  // Load PDF.js
  useEffect(() => {
    const loadPdfJs = async () => {
      try {
        setLoading(true);
        
        if (window.pdfjsLib) {
          (window.pdfjsLib as any).GlobalWorkerOptions.workerSrc =
            (window.pdfjsLib as any).GlobalWorkerOptions.workerSrc ||
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          await loadPDF();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = async () => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          await loadPDF();
        };
        script.onerror = () => {
          toast({
            title: "Error",
            description: "Failed to load PDF.js library",
            variant: "destructive"
          });
          setLoading(false);
        };
        document.head.appendChild(script);
      } catch (error) {
        console.error('Error initializing PDF.js:', error);
        setLoading(false);
      }
    };

    loadPdfJs();
    
    return () => {
      // Cancel all active render tasks
      renderTasksRef.current.forEach((task) => {
        try {
          task.cancel();
        } catch (e) {
          // Ignore cancel errors
        }
      });
      renderTasksRef.current.clear();
      
      fabricCanvasRefs.current.forEach(canvas => canvas.dispose());
      fabricCanvasRefs.current.clear();
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [pdfUrl]);

  const loadPDF = async (retryCount = 0) => {
    const maxRetries = 3;
    const retryDelay = 1000;
    
    try {
      console.log('Loading PDF from URL:', pdfUrl, retryCount > 0 ? `(retry ${retryCount})` : '');
      
      // Add cache-busting and timeout for reliability
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const response = await fetch(pdfUrl, {
        signal: controller.signal,
        cache: 'no-cache', // Avoid stale cache issues
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const pdfBytes = new Uint8Array(arrayBuffer);
      
      if (pdfBytes.length < 5) {
        throw new Error('PDF file is too small or empty');
      }
      
      const header = String.fromCharCode(pdfBytes[0], pdfBytes[1], pdfBytes[2], pdfBytes[3], pdfBytes[4]);
      if (!header.startsWith('%PDF-')) {
        throw new Error('Invalid PDF file - missing PDF header');
      }
      
      setOriginalPdfBytes(pdfBytes);

      const loadingTask = (window.pdfjsLib as any).getDocument({ data: pdfBytes.slice() });
      const pdf = await loadingTask.promise;
      
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      
      const pages: PageData[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        // Get viewport without forcing rotation - let PDF.js use the page's native rotation
        const viewport = page.getViewport({ scale: 1.0 });
        pages.push({ 
          pageNum: i, 
          width: viewport.width, 
          height: viewport.height 
        });
      }
      setPagesData(pages);
      
      await loadAnnotationsFromDatabase();
      
      setLoading(false);
    } catch (error: any) {
      console.error('Error loading PDF:', error);
      
      // Retry on network errors
      if (retryCount < maxRetries && (error.name === 'AbortError' || error.message?.includes('fetch'))) {
        console.log(`Retrying PDF load in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)));
        return loadPDF(retryCount + 1);
      }
      
      toast({
        title: "Error",
        description: `Failed to load PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  const loadAnnotationsFromDatabase = async () => {
    try {
      const { data, error } = await supabase
        .from('pdf_annotations')
        .select('page_number, annotations')
        .eq('project_id', projectId)
        .eq('file_name', fileName);

      if (error) {
        console.error('Error loading annotations:', error);
        return;
      }

      if (data && data.length > 0) {
        data.forEach(row => {
          const annotations = row.annotations as unknown as AnnotationData[];
          pageAnnotationsRef.current.set(row.page_number, annotations);
        });
      }
    } catch (error) {
      console.error('Error loading annotations:', error);
    }
  };

  // Track active render tasks to prevent conflicts
  const renderTasksRef = useRef<Map<number, any>>(new Map());
  
  // Track pages that are pending render (ref not ready yet)
  const pendingRenderRef = useRef<Set<number>>(new Set());

  // Render a specific PDF page with high quality settings
  const renderPDFPage = useCallback(async (pageNum: number, retryCount = 0) => {
    if (!pdfDoc) return;
    
    const pdfCanvas = pdfCanvasRefs.current.get(pageNum);
    if (!pdfCanvas) {
      // Canvas ref not ready yet - mark as pending and retry
      if (retryCount < 5) {
        pendingRenderRef.current.add(pageNum);
        setTimeout(() => {
          renderPDFPage(pageNum, retryCount + 1);
        }, 100 * (retryCount + 1)); // Exponential backoff: 100ms, 200ms, 300ms, etc.
      }
      return;
    }
    
    // Remove from pending if it was there
    pendingRenderRef.current.delete(pageNum);
    
    // Cancel any existing render task for this page
    const existingTask = renderTasksRef.current.get(pageNum);
    if (existingTask) {
      try {
        existingTask.cancel();
      } catch (e) {
        // Ignore cancel errors
      }
      renderTasksRef.current.delete(pageNum);
    }
    
    try {
      const page = await pdfDoc.getPage(pageNum);
      
      const pageData = pagesData.find(p => p.pageNum === pageNum);
      if (!pageData) return;

      // Use integer CSS pixel sizes so the PDF canvas and Fabric overlay share the exact same
      // coordinate space, even at arbitrary (non-0.25-step) zoom values.
      const displayWidth = Math.max(1, Math.round(pageData.width * scale));
      const displayHeight = Math.max(1, Math.round(pageData.height * scale));

      // Use device pixel ratio for sharper rendering on retina displays
      const devicePixelRatio = window.devicePixelRatio || 1;
      const renderScale = scale * devicePixelRatio;

      // Don't force rotation - let PDF.js use the page's native rotation from the PDF
      const viewport = page.getViewport({ scale: renderScale });
      const context = pdfCanvas.getContext('2d');
      if (!context) return;

      // Set canvas dimensions for high DPI rendering (integer backing store)
      pdfCanvas.width = Math.max(1, Math.round(viewport.width));
      pdfCanvas.height = Math.max(1, Math.round(viewport.height));

      // Scale canvas down with CSS to match the overlay EXACTLY
      pdfCanvas.style.width = `${displayWidth}px`;
      pdfCanvas.style.height = `${displayHeight}px`;
      
      // Enable high-quality image smoothing
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';

      const renderTask = page.render({
        canvasContext: context,
        viewport: viewport,
      });
      
      // Store the render task so we can cancel it if needed
      renderTasksRef.current.set(pageNum, renderTask);
      
      await renderTask.promise;
      
      // Clean up after successful render
      renderTasksRef.current.delete(pageNum);
      
      setRenderedPages(prev => new Set([...prev, pageNum]));
    } catch (error: any) {
      // Ignore cancellation errors
      if (error?.name === 'RenderingCancelledException') {
        return;
      }
      console.error(`Error rendering page ${pageNum}:`, error);
    }
  }, [pdfDoc, scale, pagesData]);

  // Initialize Fabric canvas for a page
  const initializeFabricCanvas = useCallback((pageNum: number) => {
    const overlayCanvas = overlayCanvasRefs.current.get(pageNum);
    const pageData = pagesData.find(p => p.pageNum === pageNum);
    if (!overlayCanvas || !pageData) return;

    const existing = fabricCanvasRefs.current.get(pageNum);
    if (existing) {
      existing.dispose();
    }

    // Use integer CSS pixel sizes to avoid sub-pixel mismatch with the PDF canvas
    const viewport = {
      width: Math.max(1, Math.round(pageData.width * scale)),
      height: Math.max(1, Math.round(pageData.height * scale)),
    };

    // IMPORTANT: canvas.width/height are integer backing-store sizes; passing floats will be coerced
    overlayCanvas.width = viewport.width;
    overlayCanvas.height = viewport.height;
    overlayCanvas.style.width = `${viewport.width}px`;
    overlayCanvas.style.height = `${viewport.height}px`;

    const fabricCanvas = new FabricCanvas(overlayCanvas, {
      width: viewport.width,
      height: viewport.height,
      backgroundColor: 'transparent',
      preserveObjectStacking: true,
      selection: true,
      allowTouchScrolling: false, // We handle touch ourselves
    });

    const fabricWrapper = fabricCanvas.wrapperEl;
    if (fabricWrapper) {
      fabricWrapper.style.position = 'absolute';
      fabricWrapper.style.top = '0';
      fabricWrapper.style.left = '0';
      fabricWrapper.style.width = `${viewport.width}px`;
      fabricWrapper.style.height = `${viewport.height}px`;
      fabricWrapper.style.zIndex = '20';
      fabricWrapper.style.pointerEvents = 'auto';
    }

    // Initialize drawing brush with smooth settings
    if (!fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush = new PencilBrush(fabricCanvas);
    }
    fabricCanvas.freeDrawingBrush.color = drawingColorRef.current;
    fabricCanvas.freeDrawingBrush.width = strokeWidthRef.current;
    // Smooth drawing with curve simplification
    (fabricCanvas.freeDrawingBrush as any).decimate = 2; // Reduce jitter
    (fabricCanvas.freeDrawingBrush as any).strokeLineCap = 'round';
    (fabricCanvas.freeDrawingBrush as any).strokeLineJoin = 'round';

    fabricCanvas.on('path:created', () => {
      saveCanvasState(pageNum);
      saveCurrentPageAnnotationsToDb(pageNum);
      triggerAutoSave();
    });

    fabricCanvas.on('object:modified', () => {
      saveCanvasState(pageNum);
      triggerAutoSave();
    });

    fabricCanvas.on('object:removed', () => {
      saveCanvasState(pageNum);
      triggerAutoSave();
    });

    // Handle all tool interactions - use refs to get current values
    fabricCanvas.on('mouse:down', (options) => {
      const currentTool = activeToolRef.current;
      const currentEditMode = isEditModeRef.current;
      const currentColor = drawingColorRef.current;
      const currentStrokeWidth = strokeWidthRef.current;
      const currentFontSize = fontSizeRef.current;
      const currentFontFamily = fontFamilyRef.current;
      
      // Handle eraser tool - click on objects to delete them
      if (currentTool === 'erase' && currentEditMode && options.target) {
        fabricCanvas.remove(options.target);
        fabricCanvas.requestRenderAll();
        saveCanvasState(pageNum);
        saveCurrentPageAnnotationsToDb(pageNum);
        triggerAutoSave();
        return;
      }
      
      // Handle text tool - add text on click
      if (currentTool === 'text' && currentEditMode && !options.target) {
        const pointer = fabricCanvas.getPointer(options.e);
        const text = new Textbox('Text', {
          left: pointer.x,
          top: pointer.y,
          width: 200 * scale,
          fontSize: currentFontSize * scale,
          fontFamily: currentFontFamily,
          fill: currentColor,
          editable: true,
        });
        fabricCanvas.add(text);
        fabricCanvas.setActiveObject(text);
        text.enterEditing();
        fabricCanvas.requestRenderAll();
        saveCanvasState(pageNum);
        saveCurrentPageAnnotationsToDb(pageNum);
        triggerAutoSave();
        return;
      }
      
      // Handle rectangle tool
      if (currentTool === 'rectangle' && currentEditMode && !options.target) {
        const pointer = fabricCanvas.getPointer(options.e);
        const rect = new Rect({
          left: pointer.x,
          top: pointer.y,
          width: 100 * scale,
          height: 60 * scale,
          fill: 'transparent',
          stroke: currentColor,
          strokeWidth: currentStrokeWidth,
        });
        fabricCanvas.add(rect);
        fabricCanvas.setActiveObject(rect);
        fabricCanvas.requestRenderAll();
        saveCanvasState(pageNum);
        saveCurrentPageAnnotationsToDb(pageNum);
        triggerAutoSave();
        return;
      }
      
      // Handle circle tool
      if (currentTool === 'circle' && currentEditMode && !options.target) {
        const pointer = fabricCanvas.getPointer(options.e);
        const circle = new FabricCircle({
          left: pointer.x,
          top: pointer.y,
          radius: 40 * scale,
          fill: 'transparent',
          stroke: currentColor,
          strokeWidth: currentStrokeWidth,
        });
        fabricCanvas.add(circle);
        fabricCanvas.setActiveObject(circle);
        fabricCanvas.requestRenderAll();
        saveCanvasState(pageNum);
        saveCurrentPageAnnotationsToDb(pageNum);
        triggerAutoSave();
        return;
      }
    });
    
    // Track which objects have been erased to prevent duplicate removes
    const erasedObjectsSet = new Set<any>();
    let hasErasedThisStroke = false;
    
    // Handle eraser swipe - delete objects on mouse move while pressed
    fabricCanvas.on('mouse:move', (options) => {
      const currentTool = activeToolRef.current;
      const currentEditMode = isEditModeRef.current;
      const isPenDrawingActive = penDrawingPageRef.current !== null;
      
      // Eraser swipe: when pen is active in erase mode, or mouse is down in erase mode
      if (currentTool === 'erase' && (currentEditMode || isPenDrawingActive) && options.target) {
        // Check if pen/mouse button is pressed
        const event = options.e;
        const isPenOrMouseDown = 
          (event instanceof PointerEvent && event.pressure > 0) ||
          (event instanceof MouseEvent && (event.buttons & 1) === 1);
          
        if (isPenOrMouseDown && !erasedObjectsSet.has(options.target)) {
          erasedObjectsSet.add(options.target);
          hasErasedThisStroke = true;
          fabricCanvas.remove(options.target);
          fabricCanvas.requestRenderAll();
        }
      }
    });
    
    // Save state after eraser stroke ends
    fabricCanvas.on('mouse:up', () => {
      if (hasErasedThisStroke) {
        saveCanvasState(pageNum);
        saveCurrentPageAnnotationsToDb(pageNum);
        triggerAutoSave();
        hasErasedThisStroke = false;
      }
      erasedObjectsSet.clear();
    });

    fabricCanvasRefs.current.set(pageNum, fabricCanvas);
    
    loadPageAnnotations(pageNum, fabricCanvas);

    // Ensure Fabric's internal offsets are correct (critical after zoom/scroll)
    fabricCanvas.calcOffset();
    
    applyToolSettings(isEditModeRef.current ? activeToolRef.current : 'select', fabricCanvas);
    if (!isEditModeRef.current) {
      fabricCanvas.selection = false;
      fabricCanvas.discardActiveObject();
    }
    
    fabricCanvas.requestRenderAll();
  }, [pagesData, scale]);

  // Track rendered pages with a ref to avoid re-creating observer
  const renderedPagesRef = useRef<Set<number>>(new Set());
  
  // Sync state to ref
  useEffect(() => {
    renderedPagesRef.current = renderedPages;
  }, [renderedPages]);

  // Render first page immediately when PDF is loaded
  useEffect(() => {
    if (!pdfDoc || pagesData.length === 0) return;
    
    // Immediately render the first page(s) visible with retry logic
    const renderInitialPages = async () => {
      // Start rendering immediately - the renderPDFPage function has its own retry logic
      // if the canvas ref isn't ready yet
      for (let pageNum = 1; pageNum <= Math.min(2, pagesData.length); pageNum++) {
        if (!renderedPagesRef.current.has(pageNum)) {
          renderPDFPage(pageNum);
        }
      }
      
      // Also check after a delay to handle race conditions
      setTimeout(() => {
        for (let pageNum = 1; pageNum <= Math.min(2, pagesData.length); pageNum++) {
          if (!renderedPagesRef.current.has(pageNum)) {
            renderPDFPage(pageNum);
          }
          if (!fabricCanvasRefs.current.has(pageNum)) {
            initializeFabricCanvas(pageNum);
          }
        }
      }, 200);
    };
    
    renderInitialPages();
  }, [pdfDoc, pagesData, renderPDFPage, initializeFabricCanvas]);

  // Intersection Observer for lazy loading pages
  useEffect(() => {
    if (!pdfDoc || pagesData.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const pageNum = parseInt(entry.target.getAttribute('data-page') || '1');
          if (entry.isIntersecting) {
            // Use the retry-enabled renderPDFPage - it will handle ref availability
            if (!renderedPagesRef.current.has(pageNum)) {
              renderPDFPage(pageNum);
            }
            if (!fabricCanvasRefs.current.has(pageNum)) {
              // Slight delay for Fabric init to ensure PDF canvas is ready
              setTimeout(() => {
                if (!fabricCanvasRefs.current.has(pageNum)) {
                  initializeFabricCanvas(pageNum);
                }
              }, 50);
            }
          }
        });
        
        const visibleEntries = entries.filter(e => e.isIntersecting);
        if (visibleEntries.length > 0) {
          const mostVisible = visibleEntries.reduce((a, b) => 
            a.intersectionRatio > b.intersectionRatio ? a : b
          );
          const pageNum = parseInt(mostVisible.target.getAttribute('data-page') || '1');
          setCurrentVisiblePage(pageNum);
        }
      },
      { root: canvasContainerRef.current, rootMargin: '200px', threshold: 0.01 }
    );

    // Use multiple timings to catch refs at different stages of React rendering
    const attemptObserve = () => {
      pageRefs.current.forEach((ref) => {
        observer.observe(ref);
      });
    };
    
    // Try immediately, then after short delays
    attemptObserve();
    const timeoutId1 = setTimeout(attemptObserve, 50);
    const timeoutId2 = setTimeout(attemptObserve, 150);

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      observer.disconnect();
    };
  }, [pdfDoc, pagesData, scale, renderPDFPage, initializeFabricCanvas]);

  // Re-render pages when scale changes - debounced to handle fast zooming
  useEffect(() => {
    if (!pdfDoc) return;

    // Clear any pending scale change
    if (scaleChangeTimeoutRef.current) {
      clearTimeout(scaleChangeTimeoutRef.current);
    }
    
    // Store the pending scale
    pendingScaleRef.current = scale;
    
    // Debounce the actual re-render to prevent race conditions when zooming fast
    scaleChangeTimeoutRef.current = setTimeout(() => {
      // Only proceed if this is still the latest scale value
      if (pendingScaleRef.current !== scale) return;
      
      // Save annotations before changing scale
      // Since we now store as percentages, this works at any scale
      fabricCanvasRefs.current.forEach((_, pageNum) => {
        saveCurrentPageAnnotations(pageNum);
      });

      // Cancel all active render tasks before clearing
      renderTasksRef.current.forEach((task) => {
        try {
          task.cancel();
        } catch (e) {
          // Ignore cancel errors
        }
      });
      renderTasksRef.current.clear();

      // Dispose all fabric canvases
      fabricCanvasRefs.current.forEach(canvas => canvas.dispose());
      // CRITICAL: Clear the map so canvases get reinitialized after scale change
      fabricCanvasRefs.current.clear();
      
      // Clear rendered pages to trigger re-render
      setRenderedPages(new Set());
      
      pendingScaleRef.current = null;
    }, 150); // 150ms debounce - fast enough to feel responsive, slow enough to batch rapid changes

    return () => {
      if (scaleChangeTimeoutRef.current) {
        clearTimeout(scaleChangeTimeoutRef.current);
      }
    };
  }, [scale, pdfDoc]);

  // Recalculate Fabric canvas offsets on scroll (fixes drawing coordinates when scrolled)
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Recalculate offset for all Fabric canvases
      fabricCanvasRefs.current.forEach(canvas => {
        canvas.calcOffset();
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const saveCanvasState = (pageNum: number) => {
    const canvas = fabricCanvasRefs.current.get(pageNum);
    if (!canvas || isRestoringHistoryRef.current) return;

    const state = JSON.stringify(canvas.toJSON());
    const history = canvasHistoryRef.current.get(pageNum) || [];
    const index = historyIndexRef.current.get(pageNum) ?? -1;

    if (history.length > 0 && index >= 0 && history[index] === state) {
      return;
    }

    const newHistory = history.slice(0, index + 1);
    newHistory.push(state);

    canvasHistoryRef.current.set(pageNum, newHistory);
    historyIndexRef.current.set(pageNum, newHistory.length - 1);

    if (pageNum === currentVisiblePage) {
      setHistoryIndex(newHistory.length - 1);
      setCanvasHistoryLength(newHistory.length);
    }
  };

  const triggerAutoSave = () => {
    hasUnsavedChanges.current = true;
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    autoSaveTimeoutRef.current = setTimeout(() => {
      performAutoSave();
    }, 3000);
  };

  const saveCurrentPageAnnotationsToDb = async (pageNum: number) => {
    try {
      saveCurrentPageAnnotations(pageNum);
      const annotations = pageAnnotationsRef.current.get(pageNum) || [];

      const { error } = await supabase
        .from('pdf_annotations')
        .upsert(
          {
            project_id: projectId,
            file_name: fileName,
            page_number: pageNum,
            annotations: annotations as unknown as any,
          },
          {
            onConflict: 'project_id,file_name,page_number',
          },
        );

      if (error) throw error;
      setLastSaved(new Date());
    } catch (error) {
      console.error('Immediate annotation save failed:', error);
    }
  };

  // Save annotations as percentages of page dimensions (scale-independent)
  const saveCurrentPageAnnotations = (pageNum: number) => {
    const canvas = fabricCanvasRefs.current.get(pageNum);
    const pageData = pagesData.find(p => p.pageNum === pageNum);
    if (!canvas || !pageData) return;
    
    const objects = canvas.getObjects();
    
    // CRITICAL: Use actual canvas dimensions, not computed from scale
    // During scale changes, the scale state may have updated but the canvas still has old dimensions
    // Using canvas.getWidth/getHeight ensures we normalize against the ACTUAL current size
    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();
    
    const annotations: AnnotationData[] = objects.map(obj => {
      const objScaleX = obj.scaleX || 1;
      const objScaleY = obj.scaleY || 1;
      
      if (obj.type === 'path') {
        const pathObj = obj as Path;
        // Clone and NORMALIZE the path data
        // Path coordinates are in local space, we need to normalize them to percentages
        const rawPath = JSON.parse(JSON.stringify(pathObj.path));
        
        // Normalize path coordinates: divide by canvas size to get percentages
        // Path commands: M, L, Q, C, etc. have coordinates at specific indices
        const normalizedPath = rawPath.map((cmd: any[]) => {
          const cmdType = cmd[0];
          const newCmd = [cmdType];
          
          // Normalize coordinate pairs based on command type
          for (let i = 1; i < cmd.length; i++) {
            if (typeof cmd[i] === 'number') {
              // Even indices (1, 3, 5...) are X coordinates, odd indices (2, 4, 6...) are Y coordinates
              // In path array: index 1, 3, 5... are X; index 2, 4, 6... are Y
              if ((i % 2) === 1) {
                // X coordinate - normalize by canvas width, accounting for object scale
                newCmd.push((cmd[i] * objScaleX) / canvasWidth);
              } else {
                // Y coordinate - normalize by canvas height, accounting for object scale
                newCmd.push((cmd[i] * objScaleY) / canvasHeight);
              }
            } else {
              newCmd.push(cmd[i]);
            }
          }
          return newCmd;
        });

        const pathOffset = (pathObj as any).pathOffset as Point | undefined;
        const pathOffsetX = typeof pathOffset?.x === 'number' ? pathOffset.x * objScaleX : undefined;
        const pathOffsetY = typeof pathOffset?.y === 'number' ? pathOffset.y * objScaleY : undefined;

        return {
          type: 'path',
          // Store position as percentage of page
          leftPct: (obj.left || 0) / canvasWidth,
          topPct: (obj.top || 0) / canvasHeight,
          fill: obj.fill as string,
          stroke: obj.stroke as string,
          // Store stroke width as percentage of page width
          strokeWidthPct: obj.strokeWidth ? obj.strokeWidth / canvasWidth : undefined,
          // Path data is now normalized to percentages
          path: normalizedPath,
          // Persist pathOffset to prevent drift at arbitrary zoom levels
          pathOffsetXPct: pathOffsetX != null ? pathOffsetX / canvasWidth : undefined,
          pathOffsetYPct: pathOffsetY != null ? pathOffsetY / canvasHeight : undefined,
          // Scale factors are baked into the path, so store as 1
          scaleX: 1,
          scaleY: 1,
          angle: obj.angle,
        };
      }
      
      if (obj.type === 'circle') {
        const circleObj = obj as FabricCircle;
        return {
          type: 'circle',
          leftPct: (obj.left || 0) / canvasWidth,
          topPct: (obj.top || 0) / canvasHeight,
          radiusPct: ((circleObj.radius || 0) * objScaleX) / canvasWidth,
          fill: obj.fill as string,
          stroke: obj.stroke as string,
          strokeWidthPct: obj.strokeWidth ? obj.strokeWidth / canvasWidth : undefined,
          scaleX: 1,
          scaleY: 1,
          angle: obj.angle,
        };
      }
      
      if (obj.type === 'textbox') {
        const textObj = obj as Textbox;
        return {
          type: 'textbox',
          leftPct: (obj.left || 0) / canvasWidth,
          topPct: (obj.top || 0) / canvasHeight,
          widthPct: ((textObj.width || 0) * objScaleX) / canvasWidth,
          heightPct: ((textObj.height || 0) * objScaleY) / canvasHeight,
          fill: obj.fill as string,
          text: textObj.text,
          fontSizePct: ((textObj.fontSize || 18) * objScaleY) / canvasHeight,
          fontFamily: textObj.fontFamily,
          scaleX: 1,
          scaleY: 1,
          angle: obj.angle,
        };
      }
      
      // Default: rect and others
      return {
        type: obj.type || 'unknown',
        leftPct: (obj.left || 0) / canvasWidth,
        topPct: (obj.top || 0) / canvasHeight,
        widthPct: (obj as any).width ? (((obj as any).width * objScaleX) / canvasWidth) : undefined,
        heightPct: (obj as any).height ? (((obj as any).height * objScaleY) / canvasHeight) : undefined,
        fill: obj.fill as string,
        stroke: obj.stroke as string,
        strokeWidthPct: obj.strokeWidth ? obj.strokeWidth / canvasWidth : undefined,
        scaleX: 1,
        scaleY: 1,
        angle: obj.angle,
      };
    });
    
    pageAnnotationsRef.current.set(pageNum, annotations);
  };

  // Load annotations from percentage-based storage to current canvas size
  const loadPageAnnotations = (pageNum: number, canvas: FabricCanvas) => {
    canvas.clear();
    canvas.backgroundColor = 'transparent';
    
    const annotations = pageAnnotationsRef.current.get(pageNum) || [];
    const pageData = pagesData.find(p => p.pageNum === pageNum);
    if (!pageData) return;
    
    // Use actual canvas dimensions for consistent coordinate mapping
    // This ensures annotations are placed correctly regardless of when this is called
    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();
    
    annotations.forEach(annotation => {
      let obj;
      
      switch (annotation.type) {
        case 'rect':
          obj = new Rect({
            left: (annotation.leftPct || 0) * canvasWidth,
            top: (annotation.topPct || 0) * canvasHeight,
            width: (annotation.widthPct || 0) * canvasWidth,
            height: (annotation.heightPct || 0) * canvasHeight,
            fill: annotation.fill || 'transparent',
            stroke: annotation.stroke,
            strokeWidth: (annotation.strokeWidthPct || 0.002) * canvasWidth,
            scaleX: 1,
            scaleY: 1,
            angle: annotation.angle || 0
          });
          break;
        case 'circle':
          obj = new FabricCircle({
            left: (annotation.leftPct || 0) * canvasWidth,
            top: (annotation.topPct || 0) * canvasHeight,
            radius: (annotation.radiusPct || 0) * canvasWidth,
            fill: annotation.fill || 'transparent',
            stroke: annotation.stroke,
            strokeWidth: (annotation.strokeWidthPct || 0.002) * canvasWidth,
            scaleX: 1,
            scaleY: 1,
            angle: annotation.angle || 0
          });
          break;
        case 'textbox':
          obj = new Textbox(annotation.text || 'Text', {
            left: (annotation.leftPct || 0) * canvasWidth,
            top: (annotation.topPct || 0) * canvasHeight,
            width: (annotation.widthPct || 0.3) * canvasWidth,
            fontSize: (annotation.fontSizePct || 0.03) * canvasHeight,
            fontFamily: annotation.fontFamily || 'Arial',
            fill: annotation.fill || '#000000',
            scaleX: 1,
            scaleY: 1,
            angle: annotation.angle || 0
          });
          break;
        case 'path':
          if (annotation.path) {
            // Denormalize path coordinates from percentages back to canvas pixels
            const denormalizedPath = annotation.path.map((cmd: any[]) => {
              const cmdType = cmd[0];
              const newCmd = [cmdType];
              
              for (let i = 1; i < cmd.length; i++) {
                if (typeof cmd[i] === 'number') {
                  // Even indices (1, 3, 5...) are X coordinates, odd indices (2, 4, 6...) are Y coordinates
                  if ((i % 2) === 1) {
                    // X coordinate - multiply by canvas width
                    newCmd.push(cmd[i] * canvasWidth);
                  } else {
                    // Y coordinate - multiply by canvas height
                    newCmd.push(cmd[i] * canvasHeight);
                  }
                } else {
                  newCmd.push(cmd[i]);
                }
              }
              return newCmd;
            });
            
            // Create path with denormalized coordinates
            const path = new Path(denormalizedPath, {
              stroke: annotation.stroke,
              fill: 'transparent',
              strokeWidth: (annotation.strokeWidthPct || 0.005) * canvasWidth,
              angle: annotation.angle || 0,
            });
            
            // Position the path
            path.set({
              left: (annotation.leftPct || 0) * canvasWidth,
              top: (annotation.topPct || 0) * canvasHeight,
              scaleX: 1,
              scaleY: 1,
            });

            // Restore Fabric's internal offset if available (prevents drift at non-integer zoom)
            if (typeof annotation.pathOffsetXPct === 'number' && typeof annotation.pathOffsetYPct === 'number') {
              (path as any).pathOffset = new Point(
                annotation.pathOffsetXPct * canvasWidth,
                annotation.pathOffsetYPct * canvasHeight,
              );
            }

            path.setCoords();
            obj = path;
          }
          break;
      }
      
      if (obj) {
        canvas.add(obj);
      }
    });
    
    canvas.renderAll();
    
    if (!canvasHistoryRef.current.has(pageNum)) {
      canvasHistoryRef.current.set(pageNum, [JSON.stringify(canvas.toJSON())]);
      historyIndexRef.current.set(pageNum, 0);
    }
  };

  const performAutoSave = async () => {
    try {
      fabricCanvasRefs.current.forEach((_, pageNum) => {
        saveCurrentPageAnnotations(pageNum);
      });

      for (const [pageNum, annotations] of pageAnnotationsRef.current.entries()) {
        const { error } = await supabase
          .from('pdf_annotations')
          .upsert(
            {
              project_id: projectId,
              file_name: fileName,
              page_number: pageNum,
              annotations: annotations as unknown as any,
            },
            {
              onConflict: 'project_id,file_name,page_number',
            },
          );
        if (error) console.error('Error saving annotation:', error);
      }

      hasUnsavedChanges.current = false;
      setLastSaved(new Date());
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  };

  const applyToolSettings = (tool: ToolType, canvas?: FabricCanvas) => {
    const canvases = canvas ? [canvas] : Array.from(fabricCanvasRefs.current.values());
    
    canvases.forEach(c => {
      c.isDrawingMode = false;
      c.selection = true;
      c.defaultCursor = 'default';

      switch (tool) {
        case 'draw':
          c.isDrawingMode = true;
          c.selection = false;
          c.defaultCursor = 'crosshair';
          if (!c.freeDrawingBrush) {
            c.freeDrawingBrush = new PencilBrush(c);
          }
          c.freeDrawingBrush.color = drawingColor;
          c.freeDrawingBrush.width = strokeWidth;
          break;

        case 'erase':
          c.isDrawingMode = false;
          c.selection = false;
          c.defaultCursor = 'not-allowed';
          c.hoverCursor = 'not-allowed';
          // Allow objects to be hovered/clicked for erasing - critical for swipe delete
          c.getObjects().forEach(obj => {
            obj.selectable = false;
            obj.evented = true; // Must be true to receive mouse events
            obj.hoverCursor = 'not-allowed';
          });
          break;

        case 'text':
          c.selection = false;
          c.defaultCursor = 'text';
          c.hoverCursor = 'text';
          // Allow clicking on existing text to edit, but don't select
          c.getObjects().forEach(obj => {
            obj.selectable = obj.type === 'textbox';
            obj.evented = obj.type === 'textbox';
          });
          break;

        case 'rectangle':
        case 'circle':
          c.selection = false;
          c.defaultCursor = 'crosshair';
          c.hoverCursor = 'crosshair';
          c.getObjects().forEach(obj => {
            obj.selectable = false;
            obj.evented = false;
          });
          break;

        case 'cursor':
          c.selection = false;
          c.defaultCursor = 'grab';
          c.hoverCursor = 'grab';
          c.isDrawingMode = false;
          c.getObjects().forEach(obj => {
            obj.selectable = false;
            obj.evented = false;
          });
          // Keep brush ready for pen input
          if (!c.freeDrawingBrush) {
            c.freeDrawingBrush = new PencilBrush(c);
          }
          c.freeDrawingBrush.color = drawingColor;
          c.freeDrawingBrush.width = strokeWidth;
          break;

        case 'select':
        default:
          c.selection = true;
          c.defaultCursor = 'default';
          c.hoverCursor = 'move';
          c.getObjects().forEach(obj => {
            obj.selectable = true;
            obj.evented = true;
          });
          break;
      }
      
      c.requestRenderAll();
    });
  };

  useEffect(() => {
    if (isEditMode) {
      applyToolSettings(activeTool);
    }
  }, [activeTool, drawingColor, strokeWidth, isEditMode]);

  const handleToolChange = (tool: ToolType) => {
    setActiveTool(tool);
  };

  const undo = () => {
    const canvas = fabricCanvasRefs.current.get(currentVisiblePage);
    const history = canvasHistoryRef.current.get(currentVisiblePage) || [];
    const idx = historyIndexRef.current.get(currentVisiblePage) ?? -1;

    if (!canvas || idx <= 0) return;

    const newIndex = idx - 1;
    const state = history[newIndex];

    isRestoringHistoryRef.current = true;

    canvas.loadFromJSON(JSON.parse(state), () => {
      canvas.renderAll();
      historyIndexRef.current.set(currentVisiblePage, newIndex);
      setHistoryIndex(newIndex);
      isRestoringHistoryRef.current = false;
      triggerAutoSave();
    });
  };

  const redo = () => {
    const canvas = fabricCanvasRefs.current.get(currentVisiblePage);
    const history = canvasHistoryRef.current.get(currentVisiblePage) || [];
    const idx = historyIndexRef.current.get(currentVisiblePage) ?? -1;

    if (!canvas || idx >= history.length - 1) return;

    const newIndex = idx + 1;
    const state = history[newIndex];

    isRestoringHistoryRef.current = true;

    canvas.loadFromJSON(JSON.parse(state), () => {
      canvas.renderAll();
      historyIndexRef.current.set(currentVisiblePage, newIndex);
      setHistoryIndex(newIndex);
      isRestoringHistoryRef.current = false;
      triggerAutoSave();
    });
  };

  const clearAnnotations = () => {
    const canvas = fabricCanvasRefs.current.get(currentVisiblePage);
    if (!canvas) return;
    
    canvas.getObjects().forEach(obj => canvas.remove(obj));
    canvas.renderAll();
    saveCanvasState(currentVisiblePage);
    triggerAutoSave();
  };

  const deleteSelected = () => {
    const canvas = fabricCanvasRefs.current.get(currentVisiblePage);
    if (!canvas) return;
    
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      canvas.remove(activeObject);
      canvas.renderAll();
      saveCanvasState(currentVisiblePage);
      triggerAutoSave();
    }
  };

  const toggleEditMode = useCallback(() => {
    if (isEditMode) {
      fabricCanvasRefs.current.forEach((canvas, pageNum) => {
        saveCurrentPageAnnotations(pageNum);
        canvas.isDrawingMode = false;
        canvas.discardActiveObject();
        canvas.selection = false;
        canvas.requestRenderAll();
      });
      performAutoSave();
      setActiveTool('cursor');
      setIsEditMode(false);
    } else {
      setActiveTool('cursor'); // Default to pan/cursor mode when entering edit mode
      setIsEditMode(true);
    }
  }, [isEditMode]);

  const cancelEdits = () => {
    fabricCanvasRefs.current.forEach(canvas => canvas.dispose());
    fabricCanvasRefs.current.clear();
    pageAnnotationsRef.current.clear();
    loadAnnotationsFromDatabase().then(() => {
      setIsEditMode(false);
      setRenderedPages(new Set());
      toast({
        title: "Changes discarded",
        description: "Your edits have been cancelled",
      });
    });
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };

  const saveToPDF = async () => {
    if (!originalPdfBytes || originalPdfBytes.length < 5) {
      toast({
        title: "Error",
        description: "PDF not loaded properly",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      fabricCanvasRefs.current.forEach((_, pageNum) => {
        saveCurrentPageAnnotations(pageNum);
      });
      
      const newPdfDoc = await PDFDocument.load(originalPdfBytes.slice());
      const font = await newPdfDoc.embedFont(StandardFonts.Helvetica);
      
      for (const [pageNum, annotations] of pageAnnotationsRef.current.entries()) {
        const page = newPdfDoc.getPage(pageNum - 1);
        const { width, height } = page.getSize();

        for (const annotation of annotations) {
          // Convert percentage-based positions to PDF coordinates
          const x = (annotation.leftPct || 0) * width;
          const y = height - ((annotation.topPct || 0) * height);

          switch (annotation.type) {
            case 'textbox':
              if (annotation.text) {
                const textFontSize = (annotation.fontSizePct || 0.03) * height;
                const colorArray = hexToRgb(annotation.fill || '#000000');
                page.drawText(annotation.text, {
                  x,
                  y: y - textFontSize,
                  size: textFontSize,
                  font,
                  color: rgb(colorArray.r / 255, colorArray.g / 255, colorArray.b / 255),
                });
              }
              break;
            case 'rect':
              const rectWidth = (annotation.widthPct || 0) * width;
              const rectHeight = (annotation.heightPct || 0) * height;
              const rectColorArray = hexToRgb(annotation.stroke || '#000000');
              page.drawRectangle({
                x,
                y: y - rectHeight,
                width: rectWidth,
                height: rectHeight,
                borderColor: rgb(rectColorArray.r / 255, rectColorArray.g / 255, rectColorArray.b / 255),
                borderWidth: (annotation.strokeWidthPct || 0.002) * width,
              });
              break;
            case 'circle':
              const radius = (annotation.radiusPct || 0) * width;
              const circleColorArray = hexToRgb(annotation.stroke || '#000000');
              page.drawCircle({
                x: x + radius,
                y: y - radius,
                size: radius,
                borderColor: rgb(circleColorArray.r / 255, circleColorArray.g / 255, circleColorArray.b / 255),
                borderWidth: (annotation.strokeWidthPct || 0.002) * width,
              });
              break;
            case 'path':
              if (annotation.path && Array.isArray(annotation.path)) {
                const pathColor = hexToRgb(annotation.stroke || '#000000');
                const pathStrokeWidth = (annotation.strokeWidthPct || 0.005) * width;
                
                // Path position (top-left corner of path bounding box)
                const pathLeft = (annotation.leftPct || 0) * width;
                const pathTop = (annotation.topPct || 0) * height;
                
                let svgPathStr = '';
                for (const cmd of annotation.path) {
                  if (cmd[0] === 'M') {
                    // Path coordinates are stored as percentages - multiply by page dimensions
                    const px = pathLeft + cmd[1] * width;
                    const py = height - (pathTop + cmd[2] * height);
                    svgPathStr += `M ${px} ${py} `;
                  } else if (cmd[0] === 'Q') {
                    const cpx = pathLeft + cmd[1] * width;
                    const cpy = height - (pathTop + cmd[2] * height);
                    const endx = pathLeft + cmd[3] * width;
                    const endy = height - (pathTop + cmd[4] * height);
                    svgPathStr += `Q ${cpx} ${cpy} ${endx} ${endy} `;
                  } else if (cmd[0] === 'L') {
                    const lx = pathLeft + cmd[1] * width;
                    const ly = height - (pathTop + cmd[2] * height);
                    svgPathStr += `L ${lx} ${ly} `;
                  }
                }
                
                if (svgPathStr.trim()) {
                  page.drawSvgPath(svgPathStr.trim(), {
                    borderColor: rgb(pathColor.r / 255, pathColor.g / 255, pathColor.b / 255),
                    borderWidth: pathStrokeWidth,
                  });
                }
              }
              break;
          }
        }
      }

      const pdfBytes = await newPdfDoc.save();
      
      const filePath = `${projectId}/${fileName}`;
      const { error } = await supabase
        .storage
        .from('project_files')
        .upload(filePath, new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }), {
          upsert: true 
        });

      if (error) throw error;
      
      setOriginalPdfBytes(new Uint8Array(pdfBytes));
      
      toast({
        title: "Success",
        description: "Annotations saved to PDF successfully",
      });
      
      setLastSaved(new Date());
      onSave?.();
    } catch (error) {
      console.error('Error saving PDF:', error);
      toast({
        title: "Error",
        description: "Failed to save annotations to PDF",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const downloadPDF = async () => {
    if (!originalPdfBytes) return;
    
    try {
      setSaving(true);
      
      const newPdfDoc = await PDFDocument.load(originalPdfBytes);
      const font = await newPdfDoc.embedFont(StandardFonts.Helvetica);
      
      for (const [pageNum, annotations] of pageAnnotationsRef.current.entries()) {
        const page = newPdfDoc.getPage(pageNum - 1);
        const { width, height } = page.getSize();

        for (const annotation of annotations) {
          // Convert percentage-based positions to PDF coordinates
          const x = (annotation.leftPct || 0) * width;
          const y = height - ((annotation.topPct || 0) * height);

          switch (annotation.type) {
            case 'textbox':
              if (annotation.text) {
                const textFontSize = (annotation.fontSizePct || 0.03) * height;
                const colorArray = hexToRgb(annotation.fill || '#000000');
                page.drawText(annotation.text, {
                  x,
                  y: y - textFontSize,
                  size: textFontSize,
                  font,
                  color: rgb(colorArray.r / 255, colorArray.g / 255, colorArray.b / 255),
                });
              }
              break;
            case 'rect':
              const rectWidth = (annotation.widthPct || 0) * width;
              const rectHeight = (annotation.heightPct || 0) * height;
              const rectColorArray = hexToRgb(annotation.stroke || '#000000');
              page.drawRectangle({
                x,
                y: y - rectHeight,
                width: rectWidth,
                height: rectHeight,
                borderColor: rgb(rectColorArray.r / 255, rectColorArray.g / 255, rectColorArray.b / 255),
                borderWidth: (annotation.strokeWidthPct || 0.002) * width,
              });
              break;
            case 'circle':
              const dlRadius = (annotation.radiusPct || 0) * width;
              const dlCircleColorArray = hexToRgb(annotation.stroke || '#000000');
              page.drawCircle({
                x: x + dlRadius,
                y: y - dlRadius,
                size: dlRadius,
                borderColor: rgb(dlCircleColorArray.r / 255, dlCircleColorArray.g / 255, dlCircleColorArray.b / 255),
                borderWidth: (annotation.strokeWidthPct || 0.002) * width,
              });
              break;
            case 'path':
              if (annotation.path && Array.isArray(annotation.path)) {
                const dlPathColor = hexToRgb(annotation.stroke || '#000000');
                const dlPathStrokeWidth = (annotation.strokeWidthPct || 0.005) * width;
                
                // Path position (top-left corner of path bounding box)
                const pathLeft = (annotation.leftPct || 0) * width;
                const pathTop = (annotation.topPct || 0) * height;
                
                let dlSvgPathStr = '';
                for (const cmd of annotation.path) {
                  if (cmd[0] === 'M') {
                    // Path coordinates are stored as percentages - multiply by page dimensions
                    const px = pathLeft + cmd[1] * width;
                    const py = height - (pathTop + cmd[2] * height);
                    dlSvgPathStr += `M ${px} ${py} `;
                  } else if (cmd[0] === 'Q') {
                    const cpx = pathLeft + cmd[1] * width;
                    const cpy = height - (pathTop + cmd[2] * height);
                    const endx = pathLeft + cmd[3] * width;
                    const endy = height - (pathTop + cmd[4] * height);
                    dlSvgPathStr += `Q ${cpx} ${cpy} ${endx} ${endy} `;
                  } else if (cmd[0] === 'L') {
                    const lx = pathLeft + cmd[1] * width;
                    const ly = height - (pathTop + cmd[2] * height);
                    dlSvgPathStr += `L ${lx} ${ly} `;
                  }
                }
                
                if (dlSvgPathStr.trim()) {
                  page.drawSvgPath(dlSvgPathStr.trim(), {
                    borderColor: rgb(dlPathColor.r / 255, dlPathColor.g / 255, dlPathColor.b / 255),
                    borderWidth: dlPathStrokeWidth,
                  });
                }
              }
              break;
          }
        }
      }

      const pdfBytes = await newPdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.download = fileName.replace('.pdf', '_annotated.pdf');
      link.href = url;
      link.click();
      
      URL.revokeObjectURL(url);
      
      toast({
        title: "Download Complete",
        description: "Annotated PDF downloaded successfully",
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: "Error",
        description: "Failed to download PDF",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const openInNewTab = () => {
    const params = new URLSearchParams({
      url: pdfUrl,
      projectId: projectId,
      fileName: fileName,
      returnUrl: window.location.pathname + window.location.search
    });
    window.open(`/pdf-editor?${params.toString()}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading PDF...</p>
        </div>
      </div>
    );
  }

  const currentHistory = canvasHistoryRef.current.get(currentVisiblePage) || [];
  const currentHistoryIndex = historyIndexRef.current.get(currentVisiblePage) ?? -1;

  // Determine touch-action based on mode and tool
  const getContainerTouchAction = () => {
    if (!isEditMode) return 'pan-x pan-y';
    if (activeTool === 'cursor') return 'none'; // We handle everything
    if (activeTool === 'draw' || activeTool === 'erase') return 'none';
    return 'pan-x pan-y';
  };

  const firstPageWidthPx = Math.max(1, Math.round((pagesData[0]?.width || 600) * scale));

  return (
    <div className={`flex flex-col bg-background ${fullscreen ? 'h-full' : 'min-h-[70vh] h-[80vh]'}`} ref={containerRef}>
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b bg-card">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Page {currentVisiblePage} of {totalPages}
          </span>
          
          <div className="flex items-center gap-1 ml-4">
            <Button
              onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
              size="sm"
              variant="outline"
              disabled={scale <= 0.5}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm w-16 text-center">{Math.round(scale * 100)}%</span>
            <Button
              onClick={() => setScale(s => Math.min(3, s + 0.25))}
              size="sm"
              variant="outline"
              disabled={scale >= 3}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lastSaved && (
            <span className="text-xs text-muted-foreground">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
          
          {isEditMode && (
            <Button onClick={saveToPDF} size="sm" variant="default" disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          )}
          
          <Button
            onClick={toggleEditMode}
            size="sm"
            variant={isEditMode ? "secondary" : "default"}
            className={isEditMode ? "bg-blue-500 hover:bg-blue-600 text-white" : ""}
          >
            {isEditMode ? (
              <>
                <Eye className="h-4 w-4 mr-1" />
                Preview
              </>
            ) : (
              <>
                <Edit3 className="h-4 w-4 mr-1" />
                Edit PDF
              </>
            )}
          </Button>
          
          {isEditMode && (
            <Button onClick={cancelEdits} size="sm" variant="outline">
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          )}
          
          <Button onClick={downloadPDF} size="sm" variant="outline">
            <Download className="h-4 w-4" />
          </Button>
          
          {!fullscreen && (
            <Button onClick={openInNewTab} size="sm" variant="outline" title="Open in new tab">
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Edit Tools */}
      {isEditMode && (
        <div className="flex flex-wrap items-center gap-3 p-3 border-b bg-muted/30">
          <div className="flex items-center gap-1 border-r pr-3">
            <Button
              onClick={() => handleToolChange('cursor')}
              size="sm"
              variant={activeTool === 'cursor' ? 'default' : 'ghost'}
              title="Pan / Scroll (pen still draws)"
            >
              <Hand className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => handleToolChange('select')}
              size="sm"
              variant={activeTool === 'select' ? 'default' : 'ghost'}
              title="Select"
            >
              <Move className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => handleToolChange('draw')}
              size="sm"
              variant={activeTool === 'draw' ? 'default' : 'ghost'}
              title="Draw / Pencil"
              className={activeTool === 'draw' ? 'bg-primary text-primary-foreground ring-2 ring-primary' : ''}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => handleToolChange('text')}
              size="sm"
              variant={activeTool === 'text' ? 'default' : 'ghost'}
              title="Add Text"
            >
              <Type className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => handleToolChange('rectangle')}
              size="sm"
              variant={activeTool === 'rectangle' ? 'default' : 'ghost'}
              title="Add Rectangle"
            >
              <Square className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => handleToolChange('circle')}
              size="sm"
              variant={activeTool === 'circle' ? 'default' : 'ghost'}
              title="Add Circle"
            >
              <Circle className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => handleToolChange('erase')}
              size="sm"
              variant={activeTool === 'erase' ? 'default' : 'ghost'}
              title="Erase"
            >
              <Eraser className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 border-r pr-3">
            <label className="text-sm text-muted-foreground">Color:</label>
            <Input
              type="color"
              value={drawingColor}
              onChange={(e) => setDrawingColor(e.target.value)}
              className="w-10 h-8 p-1 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2 border-r pr-3">
            <label className="text-sm text-muted-foreground">Size:</label>
            <div className="w-24">
              <Slider
                value={[strokeWidth]}
                onValueChange={([value]) => setStrokeWidth(value)}
                min={1}
                max={20}
                step={1}
              />
            </div>
            <span className="text-sm w-6">{strokeWidth}</span>
          </div>

          <div className="flex items-center gap-2 border-r pr-3">
            <label className="text-sm text-muted-foreground">Font:</label>
            <Select value={fontFamily} onValueChange={setFontFamily}>
              <SelectTrigger className="w-28 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Arial">Arial</SelectItem>
                <SelectItem value="Times New Roman">Times</SelectItem>
                <SelectItem value="Courier New">Courier</SelectItem>
                <SelectItem value="Georgia">Georgia</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value) || 18)}
              className="w-16 h-8"
              min={8}
              max={72}
            />
          </div>

          <div className="flex items-center gap-1 border-r pr-3">
            <Button onClick={undo} size="sm" variant="ghost" disabled={currentHistoryIndex <= 0} title="Undo">
              <Undo className="h-4 w-4" />
            </Button>
            <Button onClick={redo} size="sm" variant="ghost" disabled={currentHistoryIndex >= currentHistory.length - 1} title="Redo">
              <Redo className="h-4 w-4" />
            </Button>
            <Button onClick={deleteSelected} size="sm" variant="ghost" title="Delete Selected">
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button onClick={clearAnnotations} size="sm" variant="ghost" title="Clear All">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setLineSnapEnabled(!lineSnapEnabled)}
              size="sm"
              variant={lineSnapEnabled ? 'default' : 'ghost'}
              title={lineSnapEnabled ? 'Line snap enabled' : 'Line snap disabled'}
              className={lineSnapEnabled ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
            >
              <Ruler className="h-4 w-4 mr-1" />
              <span className="text-xs">Snap</span>
            </Button>
          </div>
        </div>
      )}

      {/* Scrollable PDF Container */}
      <div
        ref={canvasContainerRef}
        className="flex-1 min-h-0 overflow-auto bg-muted/50 p-4"
        style={{ 
          overflowX: 'auto', 
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          touchAction: getContainerTouchAction(),
          cursor: activeTool === 'cursor' ? 'grab' : undefined,
        }}
      >
        <div 
          className="flex flex-col items-center gap-4" 
          style={{ 
            minWidth: 'fit-content',
            padding: `0 max(16px, calc((100% - ${firstPageWidthPx}px) / 2))`,
          }}
        >
          {pagesData.map((pageData) => {
            const pageWidth = Math.max(1, Math.round(pageData.width * scale));
            const pageHeight = Math.max(1, Math.round(pageData.height * scale));

            return (
              <div
                key={pageData.pageNum}
                ref={(el) => {
                  if (el) pageRefs.current.set(pageData.pageNum, el);
                }}
                data-page={pageData.pageNum}
                className="relative shadow-lg bg-white overflow-hidden flex-shrink-0"
                style={{ 
                  width: pageWidth,
                  height: pageHeight,
                  touchAction: 'none', // Let our handler manage touches on pages
                }}
              >
                {/* PDF canvas */}
                <canvas
                  ref={(el) => {
                    if (el) pdfCanvasRefs.current.set(pageData.pageNum, el);
                  }}
                  width={pageWidth}
                  height={pageHeight}
                  className="absolute top-0 left-0 block"
                  style={{ display: 'block', width: pageWidth, height: pageHeight }}
                />

                {/* Fabric overlay for annotations */}
                <div
                  className="absolute top-0 left-0"
                  style={{
                    width: pageWidth,
                    height: pageHeight,
                    pointerEvents: isEditMode ? 'auto' : 'none',
                    zIndex: 10,
                    touchAction: 'none',
                  }}
                >
                  <canvas
                    ref={(el) => {
                      if (el) overlayCanvasRefs.current.set(pageData.pageNum, el);
                    }}
                    className="block"
                    style={{
                      display: 'block',
                      width: pageWidth,
                      height: pageHeight,
                      cursor: activeTool === 'cursor' 
                        ? 'grab' 
                        : isEditMode && activeTool === 'draw' 
                        ? 'crosshair' 
                        : isEditMode && activeTool === 'text' 
                        ? 'text' 
                        : 'default',
                      touchAction: 'none',
                      pointerEvents: 'auto',
                    }}
                  />
                </div>
                
                {/* Page number indicator */}
                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded pointer-events-none">
                  {pageData.pageNum}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PDFViewerEditor;
