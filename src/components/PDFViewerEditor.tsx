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
import { Canvas as FabricCanvas, Rect, Circle as FabricCircle, Textbox, Path, PencilBrush } from 'fabric';
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

interface AnnotationData {
  type: string;
  left: number;
  top: number;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  radius?: number;
  path?: any;
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
  
  // Mode state
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
  
  // Tool state
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [drawingColor, setDrawingColor] = useState('#ff0000');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [fontSize, setFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState('Arial');
  
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

  // Handle pen draw start (from touch handler)
  const handlePenDrawStart = useCallback((pageNum: number) => {
    const canvas = fabricCanvasRefs.current.get(pageNum);
    if (canvas && isEditMode) {
      penDrawingPageRef.current = pageNum;
      canvas.isDrawingMode = true;
      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = drawingColor;
        canvas.freeDrawingBrush.width = strokeWidth;
      }
    }
  }, [isEditMode, drawingColor, strokeWidth]);

  // Handle pen draw end (from touch handler)
  const handlePenDrawEnd = useCallback(() => {
    if (penDrawingPageRef.current !== null) {
      const canvas = fabricCanvasRefs.current.get(penDrawingPageRef.current);
      if (canvas && activeTool !== 'draw') {
        canvas.isDrawingMode = false;
      }
      penDrawingPageRef.current = null;
    }
  }, [activeTool]);

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

  const loadPDF = async () => {
    try {
      console.log('Loading PDF from URL:', pdfUrl);
      
      const response = await fetch(pdfUrl);
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
    } catch (error) {
      console.error('Error loading PDF:', error);
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

  // Render a specific PDF page
  const renderPDFPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc) return;
    
    const pdfCanvas = pdfCanvasRefs.current.get(pageNum);
    if (!pdfCanvas) return;
    
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
      // Don't force rotation - let PDF.js use the page's native rotation from the PDF
      const viewport = page.getViewport({ scale });
      const context = pdfCanvas.getContext('2d');
      if (!context) return;

      pdfCanvas.width = viewport.width;
      pdfCanvas.height = viewport.height;

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
  }, [pdfDoc, scale]);

  // Initialize Fabric canvas for a page
  const initializeFabricCanvas = useCallback((pageNum: number) => {
    const overlayCanvas = overlayCanvasRefs.current.get(pageNum);
    const pageData = pagesData.find(p => p.pageNum === pageNum);
    if (!overlayCanvas || !pageData) return;

    const existing = fabricCanvasRefs.current.get(pageNum);
    if (existing) {
      existing.dispose();
    }

    const viewport = { width: pageData.width * scale, height: pageData.height * scale };
    
    overlayCanvas.width = viewport.width;
    overlayCanvas.height = viewport.height;

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

    if (!fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush = new PencilBrush(fabricCanvas);
    }
    fabricCanvas.freeDrawingBrush.color = drawingColor;
    fabricCanvas.freeDrawingBrush.width = strokeWidth;

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

    // Handle eraser tool - click on objects to delete them
    fabricCanvas.on('mouse:down', (options) => {
      if (activeTool === 'erase' && isEditMode && options.target) {
        fabricCanvas.remove(options.target);
        fabricCanvas.requestRenderAll();
        saveCanvasState(pageNum);
        saveCurrentPageAnnotationsToDb(pageNum);
        triggerAutoSave();
      }
      
      // Handle text tool - add text on click
      if (activeTool === 'text' && isEditMode && !options.target) {
        const pointer = fabricCanvas.getPointer(options.e);
        const text = new Textbox('Text', {
          left: pointer.x,
          top: pointer.y,
          width: 200 * scale,
          fontSize: fontSize * scale,
          fontFamily: fontFamily,
          fill: drawingColor,
          editable: true,
        });
        fabricCanvas.add(text);
        fabricCanvas.setActiveObject(text);
        text.enterEditing();
        fabricCanvas.requestRenderAll();
        saveCanvasState(pageNum);
      }
      
      // Handle rectangle tool
      if (activeTool === 'rectangle' && isEditMode && !options.target) {
        const pointer = fabricCanvas.getPointer(options.e);
        const rect = new Rect({
          left: pointer.x,
          top: pointer.y,
          width: 100 * scale,
          height: 60 * scale,
          fill: 'transparent',
          stroke: drawingColor,
          strokeWidth: strokeWidth,
        });
        fabricCanvas.add(rect);
        fabricCanvas.setActiveObject(rect);
        fabricCanvas.requestRenderAll();
        saveCanvasState(pageNum);
      }
      
      // Handle circle tool
      if (activeTool === 'circle' && isEditMode && !options.target) {
        const pointer = fabricCanvas.getPointer(options.e);
        const circle = new FabricCircle({
          left: pointer.x,
          top: pointer.y,
          radius: 40 * scale,
          fill: 'transparent',
          stroke: drawingColor,
          strokeWidth: strokeWidth,
        });
        fabricCanvas.add(circle);
        fabricCanvas.setActiveObject(circle);
        fabricCanvas.requestRenderAll();
        saveCanvasState(pageNum);
      }
    });

    fabricCanvasRefs.current.set(pageNum, fabricCanvas);
    
    loadPageAnnotations(pageNum, fabricCanvas);
    
    applyToolSettings(isEditMode ? activeTool : 'select', fabricCanvas);
    if (!isEditMode) {
      fabricCanvas.selection = false;
      fabricCanvas.discardActiveObject();
    }
    
    fabricCanvas.requestRenderAll();
  }, [pagesData, scale, drawingColor, strokeWidth, fontSize, fontFamily, isEditMode, activeTool]);

  // Track rendered pages with a ref to avoid re-creating observer
  const renderedPagesRef = useRef<Set<number>>(new Set());
  
  // Sync state to ref
  useEffect(() => {
    renderedPagesRef.current = renderedPages;
  }, [renderedPages]);

  // Render first page immediately when PDF is loaded
  useEffect(() => {
    if (!pdfDoc || pagesData.length === 0) return;
    
    // Immediately render the first page(s) visible
    const renderInitialPages = async () => {
      // Give refs time to be set
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Render first page immediately
      if (pagesData.length > 0 && !renderedPagesRef.current.has(1)) {
        await renderPDFPage(1);
        if (!fabricCanvasRefs.current.has(1)) {
          initializeFabricCanvas(1);
        }
      }
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
            if (!renderedPagesRef.current.has(pageNum)) {
              renderPDFPage(pageNum);
            }
            if (!fabricCanvasRefs.current.has(pageNum)) {
              initializeFabricCanvas(pageNum);
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

    // Wait a tick for refs to be populated
    const timeoutId = setTimeout(() => {
      pageRefs.current.forEach((ref) => {
        observer.observe(ref);
      });
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [pdfDoc, pagesData, scale, renderPDFPage, initializeFabricCanvas]);

  // Re-render pages when scale changes
  useEffect(() => {
    if (!pdfDoc) return;
    
    // Cancel all active render tasks before clearing
    renderTasksRef.current.forEach((task, pageNum) => {
      try {
        task.cancel();
      } catch (e) {
        // Ignore cancel errors
      }
    });
    renderTasksRef.current.clear();
    
    setRenderedPages(new Set());
    fabricCanvasRefs.current.forEach(canvas => canvas.dispose());
    fabricCanvasRefs.current.clear();
  }, [scale, pdfDoc]);

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

  const saveCurrentPageAnnotations = (pageNum: number) => {
    const canvas = fabricCanvasRefs.current.get(pageNum);
    if (!canvas) return;
    
    const objects = canvas.getObjects();
    const currentScale = scale;
    
    const annotations: AnnotationData[] = objects.map(obj => {
      const objScaleX = obj.scaleX || 1;
      const objScaleY = obj.scaleY || 1;
      
      return {
        type: obj.type || 'unknown',
        left: (obj.left || 0) / currentScale,
        top: (obj.top || 0) / currentScale,
        width: (obj as any).width ? ((obj as any).width * objScaleX) / currentScale : undefined,
        height: (obj as any).height ? ((obj as any).height * objScaleY) / currentScale : undefined,
        fill: obj.fill as string,
        stroke: obj.stroke as string,
        strokeWidth: obj.strokeWidth ? obj.strokeWidth / currentScale : undefined,
        text: obj.type === 'textbox' ? (obj as Textbox).text : undefined,
        fontSize: obj.type === 'textbox' ? ((obj as Textbox).fontSize || 18) / currentScale : undefined,
        fontFamily: obj.type === 'textbox' ? (obj as Textbox).fontFamily : undefined,
        radius: obj.type === 'circle' ? (((obj as FabricCircle).radius || 0) * objScaleX) / currentScale : undefined,
        path: obj.type === 'path' ? normalizePathData((obj as Path).path, currentScale) : undefined,
        scaleX: 1,
        scaleY: 1,
        angle: obj.angle
      };
    });
    
    pageAnnotationsRef.current.set(pageNum, annotations);
  };

  const normalizePathData = (pathData: any, currentScale: number): any => {
    if (!Array.isArray(pathData)) return pathData;
    
    return pathData.map((segment: any) => {
      if (!Array.isArray(segment)) return segment;
      const [command, ...coords] = segment;
      const normalizedCoords = coords.map((coord: any) => 
        typeof coord === 'number' ? coord / currentScale : coord
      );
      return [command, ...normalizedCoords];
    });
  };

  const loadPageAnnotations = (pageNum: number, canvas: FabricCanvas) => {
    canvas.clear();
    canvas.backgroundColor = 'transparent';
    
    const annotations = pageAnnotationsRef.current.get(pageNum) || [];
    
    annotations.forEach(annotation => {
      let obj;
      const commonProps = {
        left: (annotation.left || 0) * scale,
        top: (annotation.top || 0) * scale,
        scaleX: annotation.scaleX || 1,
        scaleY: annotation.scaleY || 1,
        angle: annotation.angle || 0
      };
      
      switch (annotation.type) {
        case 'rect':
          obj = new Rect({
            ...commonProps,
            width: (annotation.width || 0) * scale,
            height: (annotation.height || 0) * scale,
            fill: annotation.fill || 'transparent',
            stroke: annotation.stroke,
            strokeWidth: (annotation.strokeWidth || 1) * scale
          });
          break;
        case 'circle':
          obj = new FabricCircle({
            ...commonProps,
            radius: (annotation.radius || 0) * scale,
            fill: annotation.fill || 'transparent',
            stroke: annotation.stroke,
            strokeWidth: (annotation.strokeWidth || 1) * scale
          });
          break;
        case 'textbox':
          obj = new Textbox(annotation.text || '', {
            ...commonProps,
            width: (annotation.width || 200) * scale,
            fontSize: (annotation.fontSize || 18) * scale,
            fontFamily: annotation.fontFamily || 'Arial',
            fill: annotation.fill || '#000000'
          });
          break;
        case 'path':
          if (annotation.path) {
            const scaledPath = scalePathData(annotation.path, scale);
            obj = new Path(scaledPath, {
              ...commonProps,
              stroke: annotation.stroke,
              strokeWidth: (annotation.strokeWidth || 1) * scale,
              fill: 'transparent'
            });
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

  const scalePathData = (pathData: any, targetScale: number): any => {
    if (!Array.isArray(pathData)) return pathData;
    
    return pathData.map((segment: any) => {
      if (!Array.isArray(segment)) return segment;
      const [command, ...coords] = segment;
      const scaledCoords = coords.map((coord: any) => 
        typeof coord === 'number' ? coord * targetScale : coord
      );
      return [command, ...scaledCoords];
    });
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
          c.selection = false;
          c.defaultCursor = 'crosshair';
          c.hoverCursor = 'pointer';
          // Allow objects to be clicked for erasing
          c.getObjects().forEach(obj => {
            obj.selectable = false;
            obj.evented = true; // Must be true to receive click events
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
      setActiveTool('select');
      setIsEditMode(false);
    } else {
      setActiveTool('draw');
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
        const pageData = pagesData.find(p => p.pageNum === pageNum);
        if (!pageData) continue;
        
        const scaleX = width / pageData.width;
        const scaleY = height / pageData.height;

        for (const annotation of annotations) {
          const x = (annotation.left || 0) * scaleX;
          const y = height - ((annotation.top || 0) * scaleY);

          switch (annotation.type) {
            case 'textbox':
              if (annotation.text) {
                const textFontSize = ((annotation.fontSize || 18) * (annotation.scaleY || 1)) * scaleX;
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
              const rectWidth = (annotation.width || 0) * (annotation.scaleX || 1) * scaleX;
              const rectHeight = (annotation.height || 0) * (annotation.scaleY || 1) * scaleY;
              const rectColorArray = hexToRgb(annotation.stroke || '#000000');
              page.drawRectangle({
                x,
                y: y - rectHeight,
                width: rectWidth,
                height: rectHeight,
                borderColor: rgb(rectColorArray.r / 255, rectColorArray.g / 255, rectColorArray.b / 255),
                borderWidth: annotation.strokeWidth || 1,
              });
              break;
            case 'circle':
              const radius = (annotation.radius || 0) * (annotation.scaleX || 1) * scaleX;
              const circleColorArray = hexToRgb(annotation.stroke || '#000000');
              page.drawCircle({
                x: x + radius,
                y: y - radius,
                size: radius,
                borderColor: rgb(circleColorArray.r / 255, circleColorArray.g / 255, circleColorArray.b / 255),
                borderWidth: annotation.strokeWidth || 1,
              });
              break;
            case 'path':
              if (annotation.path && Array.isArray(annotation.path)) {
                const pathColor = hexToRgb(annotation.stroke || '#000000');
                const pathStrokeWidth = (annotation.strokeWidth || 2) * Math.min(scaleX, scaleY);
                
                let svgPathStr = '';
                for (const cmd of annotation.path) {
                  if (cmd[0] === 'M') {
                    const px = (annotation.left + cmd[1] * (annotation.scaleX || 1)) * scaleX;
                    const py = height - ((annotation.top + cmd[2] * (annotation.scaleY || 1)) * scaleY);
                    svgPathStr += `M ${px} ${py} `;
                  } else if (cmd[0] === 'Q') {
                    const cpx = (annotation.left + cmd[1] * (annotation.scaleX || 1)) * scaleX;
                    const cpy = height - ((annotation.top + cmd[2] * (annotation.scaleY || 1)) * scaleY);
                    const endx = (annotation.left + cmd[3] * (annotation.scaleX || 1)) * scaleX;
                    const endy = height - ((annotation.top + cmd[4] * (annotation.scaleY || 1)) * scaleY);
                    svgPathStr += `Q ${cpx} ${cpy} ${endx} ${endy} `;
                  } else if (cmd[0] === 'L') {
                    const lx = (annotation.left + cmd[1] * (annotation.scaleX || 1)) * scaleX;
                    const ly = height - ((annotation.top + cmd[2] * (annotation.scaleY || 1)) * scaleY);
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
        const pageData = pagesData.find(p => p.pageNum === pageNum);
        if (!pageData) continue;
        
        const scaleX = width / pageData.width;
        const scaleY = height / pageData.height;

        for (const annotation of annotations) {
          const x = (annotation.left || 0) * scaleX;
          const y = height - ((annotation.top || 0) * scaleY);

          switch (annotation.type) {
            case 'textbox':
              if (annotation.text) {
                const textFontSize = ((annotation.fontSize || 18) * (annotation.scaleY || 1)) * scaleX;
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
              const rectWidth = (annotation.width || 0) * (annotation.scaleX || 1) * scaleX;
              const rectHeight = (annotation.height || 0) * (annotation.scaleY || 1) * scaleY;
              const rectColorArray = hexToRgb(annotation.stroke || '#000000');
              page.drawRectangle({
                x,
                y: y - rectHeight,
                width: rectWidth,
                height: rectHeight,
                borderColor: rgb(rectColorArray.r / 255, rectColorArray.g / 255, rectColorArray.b / 255),
                borderWidth: annotation.strokeWidth || 1,
              });
              break;
            case 'circle':
              const dlRadius = (annotation.radius || 0) * (annotation.scaleX || 1) * scaleX;
              const dlCircleColorArray = hexToRgb(annotation.stroke || '#000000');
              page.drawCircle({
                x: x + dlRadius,
                y: y - dlRadius,
                size: dlRadius,
                borderColor: rgb(dlCircleColorArray.r / 255, dlCircleColorArray.g / 255, dlCircleColorArray.b / 255),
                borderWidth: annotation.strokeWidth || 1,
              });
              break;
            case 'path':
              if (annotation.path && Array.isArray(annotation.path)) {
                const dlPathColor = hexToRgb(annotation.stroke || '#000000');
                const dlPathStrokeWidth = (annotation.strokeWidth || 2) * Math.min(scaleX, scaleY);
                
                let dlSvgPathStr = '';
                for (const cmd of annotation.path) {
                  if (cmd[0] === 'M') {
                    const px = (annotation.left + cmd[1] * (annotation.scaleX || 1)) * scaleX;
                    const py = height - ((annotation.top + cmd[2] * (annotation.scaleY || 1)) * scaleY);
                    dlSvgPathStr += `M ${px} ${py} `;
                  } else if (cmd[0] === 'Q') {
                    const cpx = (annotation.left + cmd[1] * (annotation.scaleX || 1)) * scaleX;
                    const cpy = height - ((annotation.top + cmd[2] * (annotation.scaleY || 1)) * scaleY);
                    const endx = (annotation.left + cmd[3] * (annotation.scaleX || 1)) * scaleX;
                    const endy = height - ((annotation.top + cmd[4] * (annotation.scaleY || 1)) * scaleY);
                    dlSvgPathStr += `Q ${cpx} ${cpy} ${endx} ${endy} `;
                  } else if (cmd[0] === 'L') {
                    const lx = (annotation.left + cmd[1] * (annotation.scaleX || 1)) * scaleX;
                    const ly = height - ((annotation.top + cmd[2] * (annotation.scaleY || 1)) * scaleY);
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
        <div className="flex flex-col items-center gap-4 min-w-full">
          {pagesData.map((pageData) => (
            <div
              key={pageData.pageNum}
              ref={(el) => {
                if (el) pageRefs.current.set(pageData.pageNum, el);
              }}
              data-page={pageData.pageNum}
              className="relative shadow-lg bg-white overflow-hidden flex-shrink-0"
              style={{ 
                width: pageData.width * scale, 
                height: pageData.height * scale,
                touchAction: 'none', // Let our handler manage touches on pages
              }}
            >
              {/* PDF canvas */}
              <canvas
                ref={(el) => {
                  if (el) pdfCanvasRefs.current.set(pageData.pageNum, el);
                }}
                width={pageData.width * scale}
                height={pageData.height * scale}
                className="absolute top-0 left-0 block"
                style={{ display: 'block', width: pageData.width * scale, height: pageData.height * scale }}
              />

              {/* Fabric overlay for annotations */}
              <div
                className="absolute top-0 left-0"
                style={{
                  width: pageData.width * scale,
                  height: pageData.height * scale,
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
          ))}
        </div>
      </div>
    </div>
  );
};

export default PDFViewerEditor;
