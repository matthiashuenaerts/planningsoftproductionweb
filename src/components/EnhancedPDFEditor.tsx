import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Save, 
  Download, 
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Type,
  Square,
  Circle,
  Undo,
  Redo,
  Image as ImageIcon,
  Palette,
  Brush,
  Eraser,
  Move,
  RotateCcw
} from 'lucide-react';
import { Canvas as FabricCanvas, Rect, Circle as FabricCircle, Textbox, FabricImage, Path } from 'fabric';
import { PDFEditorProps, PDFDocument } from '@/types/pdf';

const EnhancedPDFEditor: React.FC<PDFEditorProps> = ({ 
  pdfUrl, 
  projectId, 
  fileName, 
  onSave,
  onAnnotationChange
}) => {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocument | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [activeTool, setActiveTool] = useState<'select' | 'draw' | 'text' | 'rectangle' | 'circle' | 'image' | 'erase'>('select');
  const [drawingColor, setDrawingColor] = useState('#ff0000');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [fillColor, setFillColor] = useState('transparent');
  const [canvasHistory, setCanvasHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isDrawing, setIsDrawing] = useState(false);

  // Initialize PDF and Fabric canvas
  useEffect(() => {
    if (initialized) return;
    
    const loadPdfJs = async () => {
      try {
        setLoading(true);
        
        if (window.pdfjsLib) {
          await loadPDF();
          setInitialized(true);
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = async () => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          await loadPDF();
          setInitialized(true);
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
  }, [pdfUrl]);

  // Initialize Fabric canvas when PDF is loaded
  useEffect(() => {
    if (pdfDoc && canvasRef.current && !fabricCanvasRef.current) {
      initializeFabricCanvas();
    }
  }, [pdfDoc]);

  // Re-render when page or scale changes
  useEffect(() => {
    if (pdfDoc && !loading && initialized) {
      renderPage(currentPage);
    }
  }, [currentPage, scale, pdfDoc, initialized]);

  const loadPDF = async () => {
    try {
      const pdf = await window.pdfjsLib.getDocument(pdfUrl).promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setLoading(false);
    } catch (error) {
      console.error('Error loading PDF:', error);
      toast({
        title: "Error",
        description: "Failed to load PDF document",
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  const initializeFabricCanvas = () => {
    if (!canvasRef.current) return;

    const fabricCanvas = new FabricCanvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: 'transparent',
      preserveObjectStacking: true,
      selection: true
    });

    fabricCanvasRef.current = fabricCanvas;

    // Configure free drawing brush properly
    fabricCanvas.freeDrawingBrush.color = drawingColor;
    fabricCanvas.freeDrawingBrush.width = strokeWidth;

    // Handle canvas events for drawing and modifications
    fabricCanvas.on('path:created', (e) => {
      console.log('Path created:', e);
      saveCanvasState();
      autoSaveToPDF();
    });

    fabricCanvas.on('object:added', (e) => {
      fabricCanvas.renderAll();
    });

    fabricCanvas.on('object:modified', (e) => {
      console.log('Object modified:', e);
      saveCanvasState();
      autoSaveToPDF();
    });

    fabricCanvas.on('object:removed', (e) => {
      console.log('Object removed:', e);
      saveCanvasState();
      autoSaveToPDF();
    });

    // Mouse event handlers for better drawing control
    fabricCanvas.on('mouse:down', (e) => {
      if (activeTool === 'draw') {
        setIsDrawing(true);
      } else if (activeTool === 'erase' && e.target) {
        fabricCanvas.remove(e.target);
        saveCanvasState();
        autoSaveToPDF();
      }
    });

    fabricCanvas.on('mouse:up', (e) => {
      if (activeTool === 'draw') {
        setIsDrawing(false);
      }
    });

    // Save initial state
    saveCanvasState();
  };

  const renderPage = async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current || loading) return;

    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      
      // Create a temporary canvas for PDF rendering
      const tempCanvas = document.createElement('canvas');
      const tempContext = tempCanvas.getContext('2d');
      if (!tempContext) return;
      
      tempCanvas.height = viewport.height;
      tempCanvas.width = viewport.width;

      const renderContext = {
        canvasContext: tempContext,
        viewport: viewport
      };

      await page.render(renderContext).promise;
      
      // Update Fabric canvas size and background
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.setDimensions({
          width: viewport.width,
          height: viewport.height
        });

        // Set PDF as background
        const dataURL = tempCanvas.toDataURL();
        FabricImage.fromURL(dataURL).then((img) => {
          if (fabricCanvasRef.current) {
            fabricCanvasRef.current.backgroundImage = img;
            fabricCanvasRef.current.renderAll();
          }
        });
      }
    } catch (error) {
      console.error('Error rendering page:', error);
      toast({
        title: "Error",
        description: "Failed to render PDF page",
        variant: "destructive"
      });
    }
  };

  const handleToolChange = (tool: typeof activeTool) => {
    setActiveTool(tool);
    
    if (!fabricCanvasRef.current) return;

    // Reset modes
    fabricCanvasRef.current.isDrawingMode = false;
    fabricCanvasRef.current.selection = true;

    switch (tool) {
      case 'draw':
        fabricCanvasRef.current.isDrawingMode = true;
        fabricCanvasRef.current.selection = false;
        
        // Ensure brush is properly configured
        fabricCanvasRef.current.freeDrawingBrush.color = drawingColor;
        fabricCanvasRef.current.freeDrawingBrush.width = strokeWidth;
        console.log('Drawing mode enabled with color:', drawingColor, 'width:', strokeWidth);
        break;
      case 'text':
        addTextbox();
        break;
      case 'rectangle':
        addRectangle();
        break;
      case 'circle':
        addCircle();
        break;
      case 'image':
        if (fileInputRef.current) {
          fileInputRef.current.click();
        }
        break;
      case 'erase':
        fabricCanvasRef.current.selection = false;
        break;
      case 'select':
        fabricCanvasRef.current.selection = true;
        break;
    }
  };

  const addTextbox = () => {
    if (!fabricCanvasRef.current) return;

    const textbox = new Textbox('Click to edit text', {
      left: 100,
      top: 100,
      width: 200,
      fontSize: 18,
      fill: drawingColor,
      fontFamily: 'Arial',
      borderColor: '#ccc',
      cornerColor: '#ccc',
      cornerSize: 6,
      transparentCorners: false
    });

    fabricCanvasRef.current.add(textbox);
    fabricCanvasRef.current.setActiveObject(textbox);
    textbox.enterEditing();
    saveCanvasState();
  };

  const addRectangle = () => {
    if (!fabricCanvasRef.current) return;

    const rect = new Rect({
      left: 100,
      top: 100,
      fill: fillColor,
      stroke: drawingColor,
      strokeWidth: strokeWidth,
      width: 120,
      height: 80,
      cornerColor: '#ccc',
      cornerSize: 6,
      transparentCorners: false
    });

    fabricCanvasRef.current.add(rect);
    fabricCanvasRef.current.setActiveObject(rect);
    saveCanvasState();
  };

  const addCircle = () => {
    if (!fabricCanvasRef.current) return;

    const circle = new FabricCircle({
      left: 100,
      top: 100,
      fill: fillColor,
      stroke: drawingColor,
      strokeWidth: strokeWidth,
      radius: 50,
      cornerColor: '#ccc',
      cornerSize: 6,
      transparentCorners: false
    });

    fabricCanvasRef.current.add(circle);
    fabricCanvasRef.current.setActiveObject(circle);
    saveCanvasState();
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !fabricCanvasRef.current) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      FabricImage.fromURL(imageUrl).then((img) => {
        if (fabricCanvasRef.current) {
          img.set({
            left: 100,
            top: 100,
            scaleX: 0.5,
            scaleY: 0.5,
            cornerColor: '#ccc',
            cornerSize: 6,
            transparentCorners: false
          });
          fabricCanvasRef.current.add(img);
          fabricCanvasRef.current.setActiveObject(img);
          saveCanvasState();
        }
      });
    };
    reader.readAsDataURL(file);
  };

  const autoSaveToPDF = async () => {
    if (!fabricCanvasRef.current) return;

    setSaving(true);
    try {
      // Get the current canvas state with all annotations
      const canvasData = fabricCanvasRef.current.toJSON();
      
      // Save canvas data as JSON for this specific page
      const annotationKey = `${projectId}/${fileName}_page_${currentPage}_canvas.json`;
      const canvasBlob = new Blob([JSON.stringify(canvasData, null, 2)], { 
        type: 'application/json' 
      });
      
      await supabase
        .storage
        .from('project_files')
        .upload(annotationKey, canvasBlob, { upsert: true });

      // Also save as image for preview
      const canvas = fabricCanvasRef.current.getElement();
      const annotatedImageData = canvas.toDataURL('image/png', 1.0);
      
      const response = await fetch(annotatedImageData);
      const imageBlob = await response.blob();
      
      const imageKey = `${projectId}/${fileName}_page_${currentPage}_annotated.png`;
      
      await supabase
        .storage
        .from('project_files')
        .upload(imageKey, imageBlob, { upsert: true });

      console.log('Auto-saved canvas data and image for page', currentPage);
      onSave?.();
    } catch (error) {
      console.error('Error auto-saving to PDF:', error);
    } finally {
      setSaving(false);
    }
  };

  const loadCanvasState = async (pageNum: number) => {
    if (!fabricCanvasRef.current) return;

    try {
      const annotationKey = `${projectId}/${fileName}_page_${pageNum}_canvas.json`;
      const { data, error } = await supabase
        .storage
        .from('project_files')
        .download(annotationKey);

      if (!error && data) {
        const text = await data.text();
        const canvasData = JSON.parse(text);
        
        fabricCanvasRef.current.loadFromJSON(canvasData, () => {
          fabricCanvasRef.current?.renderAll();
          console.log('Loaded canvas state for page', pageNum);
        });
      }
    } catch (error) {
      console.log('No existing canvas state for page', pageNum);
    }
  };

  // Update the changePage function to load canvas state
  const changePage = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
      setCurrentPage(newPage);
      // Load canvas state for new page after a short delay
      setTimeout(() => loadCanvasState(newPage), 500);
    }
  };

  const saveCanvasState = () => {
    if (!fabricCanvasRef.current) return;
    
    const state = JSON.stringify(fabricCanvasRef.current.toJSON());
    const newHistory = canvasHistory.slice(0, historyIndex + 1);
    newHistory.push(state);
    setCanvasHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0 && fabricCanvasRef.current) {
      const newIndex = historyIndex - 1;
      const state = canvasHistory[newIndex];
      fabricCanvasRef.current.loadFromJSON(state, () => {
        fabricCanvasRef.current?.renderAll();
        setHistoryIndex(newIndex);
      });
    }
  };

  const redo = () => {
    if (historyIndex < canvasHistory.length - 1 && fabricCanvasRef.current) {
      const newIndex = historyIndex + 1;
      const state = canvasHistory[newIndex];
      fabricCanvasRef.current.loadFromJSON(state, () => {
        fabricCanvasRef.current?.renderAll();
        setHistoryIndex(newIndex);
      });
    }
  };

  const clearCanvas = () => {
    if (!fabricCanvasRef.current) return;
    
    const objects = fabricCanvasRef.current.getObjects();
    objects.forEach(obj => fabricCanvasRef.current?.remove(obj));
    fabricCanvasRef.current.renderAll();
    saveCanvasState();
  };

  const saveToPDF = async () => {
    setSaving(true);
    try {
      await autoSaveToPDF();
      toast({
        title: "Success",
        description: "PDF annotations saved to the document successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save PDF annotations",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const changeScale = (newScale: number) => {
    if (newScale >= 0.5 && newScale <= 3) {
      setScale(newScale);
    }
  };

  const exportAnnotatedPDF = async () => {
    if (!fabricCanvasRef.current || !pdfDoc) return;

    try {
      setSaving(true);
      
      const canvas = fabricCanvasRef.current.getElement();
      const dataURL = canvas.toDataURL('image/png', 1.0);
      
      const link = document.createElement('a');
      link.download = `${fileName}_page_${currentPage}_annotated.png`;
      link.href = dataURL;
      link.click();
      
      toast({
        title: "Export Complete",
        description: "Annotated PDF page exported successfully",
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: "Error",
        description: "Failed to export annotated PDF",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Update brush properties when color or stroke width changes
  useEffect(() => {
    if (fabricCanvasRef.current && fabricCanvasRef.current.freeDrawingBrush) {
      fabricCanvasRef.current.freeDrawingBrush.color = drawingColor;
      fabricCanvasRef.current.freeDrawingBrush.width = strokeWidth;
      console.log('Updated brush - color:', drawingColor, 'width:', strokeWidth);
    }
  }, [drawingColor, strokeWidth]);

  // Load canvas state when page changes
  useEffect(() => {
    if (fabricCanvasRef.current && !loading && initialized && currentPage > 0) {
      setTimeout(() => loadCanvasState(currentPage), 100);
    }
  }, [currentPage, initialized, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading enhanced PDF editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="enhanced-pdf-editor flex flex-col lg:flex-row gap-6 h-full bg-gray-50 p-4 rounded-lg">
      {/* PDF Viewer with Drawing Canvas */}
      <div className="flex-1" ref={containerRef}>
        {/* Header Controls */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => changePage(currentPage - 1)}
                disabled={currentPage <= 1}
                size="sm"
                variant="outline"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="bg-gray-100 px-3 py-1 rounded text-sm font-medium">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                onClick={() => changePage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                size="sm"
                variant="outline"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                onClick={() => changeScale(scale - 0.25)}
                size="sm"
                variant="outline"
                disabled={scale <= 0.5}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <div className="bg-gray-100 px-3 py-1 rounded text-sm font-medium min-w-[80px] text-center">
                {Math.round(scale * 100)}%
              </div>
              <Button
                onClick={() => changeScale(scale + 0.25)}
                size="sm"
                variant="outline"
                disabled={scale >= 3}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
            
            {saving && (
              <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-1 rounded">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm">Saving to document...</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Canvas Container */}
        <div className="bg-white rounded-lg shadow-sm p-4 overflow-auto max-h-[70vh]">
          <div className="flex justify-center">
            <canvas ref={canvasRef} className="border border-gray-200 rounded shadow-sm" />
          </div>
        </div>
      </div>

      {/* Enhanced Controls Panel */}
      <div className="w-full lg:w-96 space-y-4">
        {/* Drawing Tools */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Drawing Tools
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              <Button
                onClick={() => handleToolChange('select')}
                variant={activeTool === 'select' ? 'default' : 'outline'}
                size="sm"
                className="flex flex-col items-center gap-1 h-auto py-2"
              >
                <Move className="h-4 w-4" />
                <span className="text-xs">Select</span>
              </Button>
              <Button
                onClick={() => handleToolChange('draw')}
                variant={activeTool === 'draw' ? 'default' : 'outline'}
                size="sm"
                className="flex flex-col items-center gap-1 h-auto py-2"
              >
                <Brush className="h-4 w-4" />
                <span className="text-xs">Draw</span>
              </Button>
              <Button
                onClick={() => handleToolChange('text')}
                variant={activeTool === 'text' ? 'default' : 'outline'}
                size="sm"
                className="flex flex-col items-center gap-1 h-auto py-2"
              >
                <Type className="h-4 w-4" />
                <span className="text-xs">Text</span>
              </Button>
              <Button
                onClick={() => handleToolChange('erase')}
                variant={activeTool === 'erase' ? 'default' : 'outline'}
                size="sm"
                className="flex flex-col items-center gap-1 h-auto py-2"
              >
                <Eraser className="h-4 w-4" />
                <span className="text-xs">Erase</span>
              </Button>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={() => handleToolChange('rectangle')}
                variant={activeTool === 'rectangle' ? 'default' : 'outline'}
                size="sm"
                className="flex flex-col items-center gap-1 h-auto py-2"
              >
                <Square className="h-4 w-4" />
                <span className="text-xs">Rectangle</span>
              </Button>
              <Button
                onClick={() => handleToolChange('circle')}
                variant={activeTool === 'circle' ? 'default' : 'outline'}
                size="sm"
                className="flex flex-col items-center gap-1 h-auto py-2"
              >
                <Circle className="h-4 w-4" />
                <span className="text-xs">Circle</span>
              </Button>
              <Button
                onClick={() => handleToolChange('image')}
                variant={activeTool === 'image' ? 'default' : 'outline'}
                size="sm"
                className="flex flex-col items-center gap-1 h-auto py-2"
              >
                <ImageIcon className="h-4 w-4" />
                <span className="text-xs">Image</span>
              </Button>
            </div>
            
            {activeTool === 'draw' && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700 font-medium mb-1">Drawing Mode Active</p>
                <p className="text-xs text-blue-600">Click and drag on the PDF to draw freely</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Style Controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Style Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Stroke Color:</label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={drawingColor}
                  onChange={(e) => setDrawingColor(e.target.value)}
                  className="w-16 h-10 p-1 border rounded"
                />
                <Input
                  type="text"
                  value={drawingColor}
                  onChange={(e) => setDrawingColor(e.target.value)}
                  className="flex-1 text-sm"
                  placeholder="#ff0000"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Fill Color:</label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={fillColor === 'transparent' ? '#ffffff' : fillColor}
                  onChange={(e) => setFillColor(e.target.value)}
                  className="w-16 h-10 p-1 border rounded"
                />
                <Button
                  onClick={() => setFillColor('transparent')}
                  variant={fillColor === 'transparent' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                >
                  Transparent
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Stroke Width: {strokeWidth}px</label>
              <Input
                type="range"
                min="1"
                max="20"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        {/* History & Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={undo} 
                disabled={historyIndex <= 0}
                variant="outline" 
                size="sm"
              >
                <Undo className="h-4 w-4 mr-2" />
                Undo
              </Button>
              <Button 
                onClick={redo} 
                disabled={historyIndex >= canvasHistory.length - 1}
                variant="outline" 
                size="sm"
              >
                <Redo className="h-4 w-4 mr-2" />
                Redo
              </Button>
            </div>
            
            <Button onClick={clearCanvas} variant="outline" size="sm" className="w-full">
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Page
            </Button>
            
            <div className="space-y-2">
              <Button
                onClick={saveToPDF}
                disabled={saving}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving to Document...' : 'Save to Document'}
              </Button>
              
              <Button
                onClick={exportAnnotatedPDF}
                disabled={saving}
                variant="outline"
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Page as Image
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Hidden file input for image uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default EnhancedPDFEditor;
