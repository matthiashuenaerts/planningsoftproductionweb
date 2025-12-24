import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Save, 
  Download, 
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
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
  Check,
  RotateCcw
} from 'lucide-react';
import { Canvas as FabricCanvas, Rect, Circle as FabricCircle, Textbox, Path } from 'fabric';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface PDFViewerEditorProps {
  pdfUrl: string;
  projectId: string;
  fileName: string;
  onSave?: () => void;
  onClose?: () => void;
}

type ToolType = 'select' | 'draw' | 'text' | 'rectangle' | 'circle' | 'erase';

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

const PDFViewerEditor: React.FC<PDFViewerEditorProps> = ({ 
  pdfUrl, 
  projectId, 
  fileName, 
  onSave,
  onClose
}) => {
  const { toast } = useToast();
  
  // Mode state
  const [isEditMode, setIsEditMode] = useState(false);
  
  // PDF state
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [originalPdfBytes, setOriginalPdfBytes] = useState<Uint8Array | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Canvas state
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const fabricInitKeyRef = useRef<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 1000 });
  
  // Tool state
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [drawingColor, setDrawingColor] = useState('#ff0000');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [fontSize, setFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState('Arial');
  
  // History state
  const [canvasHistory, setCanvasHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Annotations per page
  const pageAnnotationsRef = useRef<Map<number, AnnotationData[]>>(new Map());
  
  // Auto-save state
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasUnsavedChanges = useRef(false);

  // Load PDF.js
  useEffect(() => {
    const loadPdfJs = async () => {
      try {
        setLoading(true);
        
        if (window.pdfjsLib) {
          // Ensure worker is configured even when PDF.js is already present
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
      // Cleanup
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [pdfUrl]);

  const loadPDF = async () => {
    try {
      console.log('Loading PDF from URL:', pdfUrl);
      
      // Fetch PDF bytes
      const response = await fetch(pdfUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const pdfBytes = new Uint8Array(arrayBuffer);
      
      console.log('PDF bytes loaded, size:', pdfBytes.length);
      
      // Validate PDF header
      if (pdfBytes.length < 5) {
        throw new Error('PDF file is too small or empty');
      }
      
      // Check for PDF magic number (%PDF-)
      const header = String.fromCharCode(pdfBytes[0], pdfBytes[1], pdfBytes[2], pdfBytes[3], pdfBytes[4]);
      console.log('PDF header:', header);
      
      if (!header.startsWith('%PDF-')) {
        console.error('Invalid PDF header. First 20 bytes:', 
          Array.from(pdfBytes.slice(0, 20)).map(b => String.fromCharCode(b)).join(''));
        throw new Error('Invalid PDF file - missing PDF header');
      }
      
      setOriginalPdfBytes(pdfBytes);

      // Load with PDF.js
      console.log('Loading PDF with PDF.js...');
      const loadingTask = (window.pdfjsLib as any).getDocument({ data: pdfBytes.slice() });
      const pdf = await loadingTask.promise;
      
      console.log('PDF.js loaded successfully. Pages:', pdf.numPages);
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      
      // Get first page dimensions
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.0 });
      console.log('First page viewport:', viewport.width, 'x', viewport.height);
      setCanvasSize({ width: viewport.width, height: viewport.height });
      
      // Load saved annotations
      await loadAnnotationsFromDatabase();
      
      setLoading(false);
      console.log('PDF loading complete');
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

  // Load annotations from database
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
        console.log('Loaded annotations for', data.length, 'pages');
      }
    } catch (error) {
      console.error('Error loading annotations:', error);
    }
  };

  // Render PDF page (preview mode or as background in edit mode)
  const renderPDFPage = useCallback(async (pageNum: number, targetCanvas?: HTMLCanvasElement) => {
    console.log('renderPDFPage called, pageNum:', pageNum, 'pdfDoc:', !!pdfDoc);

    if (!pdfDoc) {
      console.error('Cannot render: pdfDoc is null');
      return null;
    }

    try {
      console.log('Getting page', pageNum);
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      console.log('Page viewport:', viewport.width, 'x', viewport.height);

      const canvas = targetCanvas || document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        console.error('Cannot get 2D context');
        return null;
      }

      // Keep wrapper + overlay in sync with the actual rendered viewport
      setCanvasSize({ width: viewport.width, height: viewport.height });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      console.log('Rendering page to canvas...');
      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      console.log('Page rendered successfully');
      return { canvas, viewport };
    } catch (error) {
      console.error('Error rendering PDF page:', error);
      return null;
    }
  }, [pdfDoc, scale]);

  // Initialize/update Fabric canvas for edit mode (overlay on top of a real PDF.js canvas)
  const initializeFabricCanvas = useCallback(async () => {
    console.log(
      'initializeFabricCanvas called, overlayCanvasRef:',
      !!overlayCanvasRef.current,
      'pdfCanvasRef:',
      !!pdfCanvasRef.current,
      'pdfDoc:',
      !!pdfDoc,
    );

    if (!overlayCanvasRef.current || !pdfCanvasRef.current || !pdfDoc) {
      console.error('Cannot initialize Fabric: missing refs');
      return;
    }

    // Render PDF page into the underlying PDF canvas
    const result = await renderPDFPage(currentPage, pdfCanvasRef.current);
    if (!result) {
      console.error('Failed to render PDF page');
      return;
    }

    const { viewport } = result;

    const initKey = `${currentPage}-${scale}-${viewport.width}-${viewport.height}`;

    // If we're already initialized for this page/zoom, don't recreate the canvas (this breaks drawing)
    if (fabricCanvasRef.current && fabricInitKeyRef.current === initKey) {
      applyToolSettings(activeTool);
      fabricCanvasRef.current.calcOffset();
      fabricCanvasRef.current.requestRenderAll();
      return;
    }

    // Dispose existing fabric canvas
    if (fabricCanvasRef.current) {
      saveCurrentPageAnnotations();
      fabricCanvasRef.current.dispose();
      fabricCanvasRef.current = null;
      fabricInitKeyRef.current = null;
    }

    // Create overlay Fabric canvas with same size as PDF
    overlayCanvasRef.current.width = viewport.width;
    overlayCanvasRef.current.height = viewport.height;

    const fabricCanvas = new FabricCanvas(overlayCanvasRef.current, {
      width: viewport.width,
      height: viewport.height,
      backgroundColor: 'transparent',
      preserveObjectStacking: true,
      selection: true,
    });

    // Ensure the Fabric wrapper container is properly positioned and always sits above the PDF canvas
    const fabricWrapper = fabricCanvas.wrapperEl;
    if (fabricWrapper) {
      fabricWrapper.style.position = 'absolute';
      fabricWrapper.style.top = '0';
      fabricWrapper.style.left = '0';
      fabricWrapper.style.width = `${viewport.width}px`;
      fabricWrapper.style.height = `${viewport.height}px`;
      fabricWrapper.style.zIndex = '20';
      fabricWrapper.style.pointerEvents = 'auto';

      // Critical for iPad/Apple Pencil: prevent browser panning/scrolling from swallowing events
      (fabricWrapper.style as any).touchAction = 'none';
      (fabricWrapper.style as any).webkitUserSelect = 'none';
      fabricWrapper.style.userSelect = 'none';
    }

    // Ensure the canvases capture pen/touch input reliably
    const setInputCaptureStyles = (el?: HTMLCanvasElement | null) => {
      if (!el) return;
      el.style.pointerEvents = 'auto';
      (el.style as any).touchAction = 'none';
      (el.style as any).webkitUserSelect = 'none';
      el.style.userSelect = 'none';
    };

    setInputCaptureStyles(overlayCanvasRef.current);
    setInputCaptureStyles((fabricCanvas as any).upperCanvasEl as HTMLCanvasElement | undefined);
    setInputCaptureStyles((fabricCanvas as any).lowerCanvasEl as HTMLCanvasElement | undefined);

    // Keep Fabric internal canvases in sync and make sure offsets are correct
    fabricCanvas.setDimensions({ width: viewport.width, height: viewport.height });
    fabricCanvas.calcOffset();

    // Configure brush (safe)
    if (fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color = drawingColor;
      fabricCanvas.freeDrawingBrush.width = strokeWidth;
    }

    // Add event listeners
    fabricCanvas.on('path:created', () => {
      saveCanvasState();
      triggerAutoSave();
    });

    fabricCanvas.on('object:modified', () => {
      saveCanvasState();
      triggerAutoSave();
    });

    fabricCanvas.on('object:removed', () => {
      saveCanvasState();
      triggerAutoSave();
    });

    fabricCanvasRef.current = fabricCanvas;
    fabricInitKeyRef.current = initKey;

    // Load annotations for this page
    loadPageAnnotations(currentPage);

    // Save initial state
    saveCanvasState();

    // Apply the currently selected tool (default is set to 'draw' when entering edit mode)
    applyToolSettings(activeTool);
    fabricCanvas.requestRenderAll();

    console.log('Fabric canvas initialization complete');
  }, [pdfDoc, currentPage, scale, drawingColor, strokeWidth, activeTool]);

  // Effect to initialize fabric canvas when entering edit mode
  useEffect(() => {
    console.log('Edit mode effect - isEditMode:', isEditMode, 'pdfDoc:', !!pdfDoc, 'loading:', loading);
    if (isEditMode && pdfDoc && !loading) {
      const raf = window.requestAnimationFrame(() => {
        initializeFabricCanvas();
      });
      return () => window.cancelAnimationFrame(raf);
    }
  }, [isEditMode, pdfDoc, loading, currentPage, scale, initializeFabricCanvas]);

  // Effect to render preview mode
  useEffect(() => {
    console.log('Preview mode effect - isEditMode:', isEditMode, 'pdfDoc:', !!pdfDoc, 'pdfCanvasRef:', !!pdfCanvasRef.current, 'loading:', loading);
    if (!isEditMode && pdfDoc && pdfCanvasRef.current && !loading) {
      console.log('Rendering preview...');
      renderPDFPage(currentPage, pdfCanvasRef.current);
    }
  }, [isEditMode, pdfDoc, currentPage, scale, loading, renderPDFPage]);

  // Save current page annotations
  const saveCurrentPageAnnotations = () => {
    if (!fabricCanvasRef.current) return;
    
    const objects = fabricCanvasRef.current.getObjects();
    const annotations: AnnotationData[] = objects.map(obj => ({
      type: obj.type || 'unknown',
      left: obj.left || 0,
      top: obj.top || 0,
      width: (obj as any).width,
      height: (obj as any).height,
      fill: obj.fill as string,
      stroke: obj.stroke as string,
      strokeWidth: obj.strokeWidth,
      text: obj.type === 'textbox' ? (obj as Textbox).text : undefined,
      fontSize: obj.type === 'textbox' ? (obj as Textbox).fontSize : undefined,
      fontFamily: obj.type === 'textbox' ? (obj as Textbox).fontFamily : undefined,
      radius: obj.type === 'circle' ? (obj as FabricCircle).radius : undefined,
      path: obj.type === 'path' ? (obj as Path).path : undefined,
      scaleX: obj.scaleX,
      scaleY: obj.scaleY,
      angle: obj.angle
    }));
    
    pageAnnotationsRef.current.set(currentPage, annotations);
  };

  // Load annotations for a specific page
  const loadPageAnnotations = (pageNum: number) => {
    if (!fabricCanvasRef.current) return;
    
    const annotations = pageAnnotationsRef.current.get(pageNum) || [];
    
    annotations.forEach(annotation => {
      let obj;
      const commonProps = {
        left: annotation.left,
        top: annotation.top,
        scaleX: annotation.scaleX || 1,
        scaleY: annotation.scaleY || 1,
        angle: annotation.angle || 0
      };
      
      switch (annotation.type) {
        case 'rect':
          obj = new Rect({
            ...commonProps,
            width: annotation.width,
            height: annotation.height,
            fill: annotation.fill || 'transparent',
            stroke: annotation.stroke,
            strokeWidth: annotation.strokeWidth
          });
          break;
        case 'circle':
          obj = new FabricCircle({
            ...commonProps,
            radius: annotation.radius,
            fill: annotation.fill || 'transparent',
            stroke: annotation.stroke,
            strokeWidth: annotation.strokeWidth
          });
          break;
        case 'textbox':
          obj = new Textbox(annotation.text || '', {
            ...commonProps,
            width: annotation.width,
            fontSize: annotation.fontSize || 18,
            fontFamily: annotation.fontFamily || 'Arial',
            fill: annotation.fill || '#000000'
          });
          break;
        case 'path':
          if (annotation.path) {
            obj = new Path(annotation.path, {
              ...commonProps,
              stroke: annotation.stroke,
              strokeWidth: annotation.strokeWidth,
              fill: 'transparent'
            });
          }
          break;
      }
      
      if (obj) {
        fabricCanvasRef.current?.add(obj);
      }
    });
    
    fabricCanvasRef.current.renderAll();
  };

  // Save canvas state for undo/redo
  const saveCanvasState = () => {
    if (!fabricCanvasRef.current) return;
    
    const state = JSON.stringify(fabricCanvasRef.current.toJSON());
    const newHistory = canvasHistory.slice(0, historyIndex + 1);
    newHistory.push(state);
    setCanvasHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Auto-save trigger
  const triggerAutoSave = () => {
    hasUnsavedChanges.current = true;
    
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(async () => {
      if (hasUnsavedChanges.current) {
        await performAutoSave();
      }
    }, 3000);
  };

  // Perform auto-save
  const performAutoSave = async () => {
    try {
      saveCurrentPageAnnotations();
      
      // Save to database
      for (const [pageNum, annotations] of pageAnnotationsRef.current.entries()) {
        const { error } = await supabase
          .from('pdf_annotations')
          .upsert(
            {
              project_id: projectId,
              file_name: fileName,
              page_number: pageNum,
              annotations: annotations as unknown as any
            },
            {
              onConflict: 'project_id,file_name,page_number'
            }
          );
        if (error) console.error('Error saving annotation:', error);
      }
      
      hasUnsavedChanges.current = false;
      setLastSaved(new Date());
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  };

  // Apply tool settings
  const applyToolSettings = (tool: ToolType) => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;

    // Reset modes
    canvas.isDrawingMode = false;
    canvas.selection = true;
    canvas.defaultCursor = 'default';

    // Remove previous click handlers
    canvas.off('mouse:down');

    switch (tool) {
      case 'draw':
        canvas.isDrawingMode = true;
        canvas.selection = false;
        canvas.defaultCursor = 'crosshair';
        (canvas as any).freeDrawingCursor = 'crosshair';
        if (canvas.freeDrawingBrush) {
          canvas.freeDrawingBrush.color = drawingColor;
          canvas.freeDrawingBrush.width = strokeWidth;
        }
        break;

      case 'erase':
        canvas.selection = false;
        canvas.defaultCursor = 'crosshair';
        canvas.on('mouse:down', (e) => {
          if (e.target) {
            canvas.remove(e.target);
            saveCanvasState();
            triggerAutoSave();
          }
        });
        break;

      case 'text':
        canvas.selection = false;
        canvas.defaultCursor = 'text';
        canvas.on('mouse:down', (e) => {
          const pointer = canvas.getPointer(e.e);
          const textbox = new Textbox('Type...', {
            left: pointer.x,
            top: pointer.y,
            width: 220,
            fontSize,
            fontFamily,
            fill: drawingColor,
            borderColor: '#0066ff',
            cornerColor: '#0066ff',
            cornerSize: 8,
            transparentCorners: false,
          });

          textbox.on('changed', () => triggerAutoSave());
          textbox.on('editing:exited', () => triggerAutoSave());

          canvas.add(textbox);
          canvas.setActiveObject(textbox);
          textbox.enterEditing();
          saveCanvasState();
          triggerAutoSave();

          // Return to select mode after placing
          setActiveTool('select');
          setTimeout(() => applyToolSettings('select'), 0);
        });
        break;

      case 'rectangle':
        canvas.selection = false;
        canvas.defaultCursor = 'crosshair';
        canvas.on('mouse:down', (e) => {
          const pointer = canvas.getPointer(e.e);
          const rect = new Rect({
            left: pointer.x,
            top: pointer.y,
            width: 160,
            height: 100,
            fill: 'transparent',
            stroke: drawingColor,
            strokeWidth,
            borderColor: '#0066ff',
            cornerColor: '#0066ff',
            cornerSize: 8,
            transparentCorners: false,
          });

          canvas.add(rect);
          canvas.setActiveObject(rect);
          saveCanvasState();
          triggerAutoSave();

          setActiveTool('select');
          setTimeout(() => applyToolSettings('select'), 0);
        });
        break;

      case 'circle':
        canvas.selection = false;
        canvas.defaultCursor = 'crosshair';
        canvas.on('mouse:down', (e) => {
          const pointer = canvas.getPointer(e.e);
          const circle = new FabricCircle({
            left: pointer.x,
            top: pointer.y,
            radius: 60,
            fill: 'transparent',
            stroke: drawingColor,
            strokeWidth,
            borderColor: '#0066ff',
            cornerColor: '#0066ff',
            cornerSize: 8,
            transparentCorners: false,
          });

          canvas.add(circle);
          canvas.setActiveObject(circle);
          saveCanvasState();
          triggerAutoSave();

          setActiveTool('select');
          setTimeout(() => applyToolSettings('select'), 0);
        });
        break;

      case 'select':
      default:
        canvas.selection = true;
        break;
    }
  };

  // Handle tool change
  const handleToolChange = (tool: ToolType) => {
    setActiveTool(tool);
    applyToolSettings(tool);
  };

  // Add textbox
  const addTextbox = () => {
    if (!fabricCanvasRef.current) return;
    
    const textbox = new Textbox('Click to edit', {
      left: 100,
      top: 100,
      width: 200,
      fontSize: fontSize,
      fontFamily: fontFamily,
      fill: drawingColor,
      borderColor: '#0066ff',
      cornerColor: '#0066ff',
      cornerSize: 8,
      transparentCorners: false
    });
    
    textbox.on('changed', () => triggerAutoSave());
    textbox.on('editing:exited', () => triggerAutoSave());
    
    fabricCanvasRef.current.add(textbox);
    fabricCanvasRef.current.setActiveObject(textbox);
    textbox.enterEditing();
    saveCanvasState();
  };

  // Add rectangle
  const addRectangle = () => {
    if (!fabricCanvasRef.current) return;
    
    const rect = new Rect({
      left: 100,
      top: 100,
      width: 120,
      height: 80,
      fill: 'transparent',
      stroke: drawingColor,
      strokeWidth: strokeWidth,
      borderColor: '#0066ff',
      cornerColor: '#0066ff',
      cornerSize: 8,
      transparentCorners: false
    });
    
    fabricCanvasRef.current.add(rect);
    fabricCanvasRef.current.setActiveObject(rect);
    saveCanvasState();
  };

  // Add circle
  const addCircle = () => {
    if (!fabricCanvasRef.current) return;
    
    const circle = new FabricCircle({
      left: 100,
      top: 100,
      radius: 50,
      fill: 'transparent',
      stroke: drawingColor,
      strokeWidth: strokeWidth,
      borderColor: '#0066ff',
      cornerColor: '#0066ff',
      cornerSize: 8,
      transparentCorners: false
    });
    
    fabricCanvasRef.current.add(circle);
    fabricCanvasRef.current.setActiveObject(circle);
    saveCanvasState();
  };

  // Undo
  const undo = () => {
    if (historyIndex > 0 && fabricCanvasRef.current) {
      const newIndex = historyIndex - 1;
      const state = canvasHistory[newIndex];
      fabricCanvasRef.current.loadFromJSON(JSON.parse(state), () => {
        fabricCanvasRef.current?.renderAll();
        setHistoryIndex(newIndex);
        triggerAutoSave();
      });
    }
  };

  // Redo
  const redo = () => {
    if (historyIndex < canvasHistory.length - 1 && fabricCanvasRef.current) {
      const newIndex = historyIndex + 1;
      const state = canvasHistory[newIndex];
      fabricCanvasRef.current.loadFromJSON(JSON.parse(state), () => {
        fabricCanvasRef.current?.renderAll();
        setHistoryIndex(newIndex);
        triggerAutoSave();
      });
    }
  };

  // Clear annotations
  const clearAnnotations = () => {
    if (!fabricCanvasRef.current) return;
    
    const objects = fabricCanvasRef.current.getObjects();
    objects.forEach(obj => fabricCanvasRef.current?.remove(obj));
    fabricCanvasRef.current.renderAll();
    saveCanvasState();
    triggerAutoSave();
  };

  // Delete selected object
  const deleteSelected = () => {
    if (!fabricCanvasRef.current) return;
    
    const activeObject = fabricCanvasRef.current.getActiveObject();
    if (activeObject) {
      fabricCanvasRef.current.remove(activeObject);
      fabricCanvasRef.current.renderAll();
      saveCanvasState();
      triggerAutoSave();
    }
  };

  // Change page
  const changePage = async (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    
    if (isEditMode) {
      saveCurrentPageAnnotations();
    }
    
    setCurrentPage(newPage);
  };

  // Helper: hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };

  // Save annotations to PDF file
  const saveToPDF = async () => {
    console.log('saveToPDF called, originalPdfBytes:', originalPdfBytes?.length);
    
    if (!originalPdfBytes || originalPdfBytes.length < 5) {
      toast({
        title: "Error",
        description: "PDF not loaded properly - no data available",
        variant: "destructive"
      });
      return;
    }
    
    // Validate PDF header
    const header = String.fromCharCode(originalPdfBytes[0], originalPdfBytes[1], originalPdfBytes[2], originalPdfBytes[3], originalPdfBytes[4]);
    if (!header.startsWith('%PDF-')) {
      console.error('Invalid PDF bytes in save. Header:', header);
      toast({
        title: "Error",
        description: "PDF data is corrupted - please reload the document",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      // Save current annotations first
      if (isEditMode) {
        saveCurrentPageAnnotations();
      }
      
      console.log('Loading PDF for modification...');
      // Create new PDF from original - use a copy of the bytes
      const pdfBytesArray = originalPdfBytes.slice();
      const newPdfDoc = await PDFDocument.load(pdfBytesArray);
      const font = await newPdfDoc.embedFont(StandardFonts.Helvetica);
      
      // Apply annotations to each page
      for (const [pageNum, annotations] of pageAnnotationsRef.current.entries()) {
        const page = newPdfDoc.getPage(pageNum - 1);
        const { width, height } = page.getSize();
        
        // Calculate scale factors
        const scaleX = width / (canvasSize.width * scale);
        const scaleY = height / (canvasSize.height * scale);

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
          }
        }
      }

      // Save modified PDF
      const pdfBytes = await newPdfDoc.save();
      
      // Upload back to Supabase
      const filePath = `${projectId}/${fileName}`;
      const { error } = await supabase
        .storage
        .from('project_files')
        .upload(filePath, new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }), {
          upsert: true 
        });

      if (error) throw error;
      
      // Update original bytes
      setOriginalPdfBytes(new Uint8Array(pdfBytes));
      
      // Reload PDF to show embedded annotations
      await loadPDF();

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

  // Download annotated PDF
  const downloadPDF = async () => {
    if (!originalPdfBytes) return;
    
    try {
      setSaving(true);
      
      // Create annotated PDF
      const newPdfDoc = await PDFDocument.load(originalPdfBytes);
      const font = await newPdfDoc.embedFont(StandardFonts.Helvetica);
      
      // Apply annotations
      for (const [pageNum, annotations] of pageAnnotationsRef.current.entries()) {
        const page = newPdfDoc.getPage(pageNum - 1);
        const { width, height } = page.getSize();
        
        const scaleX = width / (canvasSize.width * scale);
        const scaleY = height / (canvasSize.height * scale);

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

  // Toggle edit mode
  const toggleEditMode = useCallback(() => {
    if (isEditMode) {
      // Leaving edit mode - save annotations first, then dispose Fabric BEFORE state change
      saveCurrentPageAnnotations();
      performAutoSave();

      // Dispose Fabric canvas BEFORE React re-renders
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }

      setActiveTool('select');
      setIsEditMode(false);
    } else {
      // Entering edit mode: default to pencil so users can start annotating immediately
      setActiveTool('draw');
      setIsEditMode(true);
    }
  }, [isEditMode, saveCurrentPageAnnotations, performAutoSave]);

  // Cancel edits
  const cancelEdits = () => {
    // Dispose Fabric canvas immediately
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose();
      fabricCanvasRef.current = null;
    }

    // Reload from database
    pageAnnotationsRef.current.clear();
    loadAnnotationsFromDatabase().then(() => {
      setIsEditMode(false);
      toast({
        title: "Changes discarded",
        description: "Your edits have been cancelled",
      });
    });
  };

  // Update brush settings when color/width changes
  useEffect(() => {
    if (fabricCanvasRef.current?.freeDrawingBrush && activeTool === 'draw') {
      fabricCanvasRef.current.freeDrawingBrush.color = drawingColor;
      fabricCanvasRef.current.freeDrawingBrush.width = strokeWidth;
    }
  }, [drawingColor, strokeWidth, activeTool]);

  // Ensure the active tool is always applied after Fabric finishes initializing
  useEffect(() => {
    if (!isEditMode || !fabricCanvasRef.current) return;
    applyToolSettings(activeTool);
    fabricCanvasRef.current.calcOffset();
    fabricCanvasRef.current.requestRenderAll();
  }, [isEditMode, activeTool, drawingColor, strokeWidth, fontFamily, fontSize]);

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

  return (
    <div className="flex flex-col min-h-[70vh] h-[80vh] bg-background" ref={containerRef}>
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b bg-card">
        {/* Left: Navigation */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => changePage(currentPage - 1)}
            disabled={currentPage <= 1}
            size="sm"
            variant="outline"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium px-2">
            {currentPage} / {totalPages}
          </span>
          <Button
            onClick={() => changePage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            size="sm"
            variant="outline"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Center: Zoom */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
            size="sm"
            variant="outline"
            disabled={scale <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            onClick={() => setScale(s => Math.min(3, s + 0.25))}
            size="sm"
            variant="outline"
            disabled={scale >= 3}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        {/* Right: Mode & Actions */}
        <div className="flex items-center gap-2">
          {saving && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
              Saving...
            </span>
          )}
          {lastSaved && !saving && (
            <span className="text-sm text-green-600 flex items-center gap-1">
              <Check className="h-3 w-3" />
              Saved
            </span>
          )}
          
          <Button
            onClick={toggleEditMode}
            size="sm"
            variant={isEditMode ? "secondary" : "default"}
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
            <>
              <Button onClick={saveToPDF} size="sm" variant="default" disabled={saving}>
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
              <Button onClick={cancelEdits} size="sm" variant="outline">
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </>
          )}
          
          <Button onClick={downloadPDF} size="sm" variant="outline">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Edit Tools (only in edit mode) */}
      {isEditMode && (
        <div className="flex flex-wrap items-center gap-3 p-3 border-b bg-muted/30">
          {/* Tool buttons */}
          <div className="flex items-center gap-1 border-r pr-3">
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

          {/* Color picker */}
          <div className="flex items-center gap-2 border-r pr-3">
            <label className="text-sm text-muted-foreground">Color:</label>
            <Input
              type="color"
              value={drawingColor}
              onChange={(e) => setDrawingColor(e.target.value)}
              className="w-10 h-8 p-1 cursor-pointer"
            />
          </div>

          {/* Stroke width */}
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

          {/* Font settings (for text) */}
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

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button onClick={undo} size="sm" variant="ghost" disabled={historyIndex <= 0} title="Undo">
              <Undo className="h-4 w-4" />
            </Button>
            <Button onClick={redo} size="sm" variant="ghost" disabled={historyIndex >= canvasHistory.length - 1} title="Redo">
              <Redo className="h-4 w-4" />
            </Button>
            <Button onClick={deleteSelected} size="sm" variant="ghost" title="Delete Selected">
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button onClick={clearAnnotations} size="sm" variant="ghost" title="Clear All">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Canvas Container */}
      <div
        ref={canvasContainerRef}
        className="flex-1 min-h-0 overflow-auto bg-muted/50 p-4"
      >
        <div className="flex justify-center">
          <div
            className="relative shadow-lg bg-white overflow-hidden"
            style={{ width: canvasSize.width, height: canvasSize.height }}
            aria-label="PDF canvas wrapper"
          >
            {/* PDF rendered by PDF.js */}
            <canvas
              ref={pdfCanvasRef}
              className="absolute top-0 left-0 block"
              style={{ display: 'block' }}
              aria-label="PDF preview canvas"
            />

            {/* Fabric overlay for annotations – always mounted but hidden when not editing */}
            <div
              className="absolute top-0 left-0"
              style={{
                width: canvasSize.width,
                height: canvasSize.height,
                pointerEvents: isEditMode ? 'auto' : 'none',
                opacity: isEditMode ? 1 : 0,
                zIndex: isEditMode ? 10 : -1,
                // Important for iPad/Apple Pencil: prevent scroll/zoom gestures from swallowing draw events
                touchAction:
                  isEditMode && (activeTool === 'draw' || activeTool === 'erase')
                    ? 'none'
                    : 'manipulation',
              }}
            >
              <canvas
                ref={overlayCanvasRef}
                className="block"
                style={{
                  display: 'block',
                  cursor: isEditMode && activeTool === 'draw' ? 'crosshair' : 'default',
                  touchAction: isEditMode && (activeTool === 'draw' || activeTool === 'erase') ? 'none' : 'manipulation',
                }}
                aria-label="PDF annotation canvas"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFViewerEditor;
