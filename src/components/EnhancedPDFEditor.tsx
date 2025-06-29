
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

    // Set up drawing mode
    fabricCanvas.isDrawingMode = false;
    
    // Configure free drawing brush
    if (fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color = drawingColor;
      fabricCanvas.freeDrawingBrush.width = strokeWidth;
    }

    // Handle canvas events
    fabricCanvas.on('path:created', handleDrawingCreated);
    fabricCanvas.on('object:added', handleObjectAdded);
    fabricCanvas.on('object:modified', handleObjectModified);
    fabricCanvas.on('object:removed', handleObjectRemoved);

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

  const saveCanvasState = () => {
    if (!fabricCanvasRef.current) return;
    
    const state = JSON.stringify(fabricCanvasRef.current.toJSON());
    const newHistory = canvasHistory.slice(0, historyIndex + 1);
    newHistory.push(state);
    setCanvasHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleDrawingCreated = () => {
    saveCanvasState();
    autoSaveToPDF();
  };

  const handleObjectAdded = () => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.renderAll();
    }
  };

  const handleObjectModified = () => {
    saveCanvasState();
    autoSaveToPDF();
  };

  const handleObjectRemoved = () => {
    saveCanvasState();
    autoSaveToPDF();
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
        
        if (fabricCanvasRef.current.freeDrawingBrush) {
          fabricCanvasRef.current.freeDrawingBrush.color = drawingColor;
          fabricCanvasRef.current.freeDrawingBrush.width = strokeWidth;
        }
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
        enableEraseMode();
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

  const enableEraseMode = () => {
    if (!fabricCanvasRef.current) return;
    
    fabricCanvasRef.current.selection = false;
    fabricCanvasRef.current.isDrawingMode = false;
    
    // Add click event to remove objects
    fabricCanvasRef.current.on('mouse:down', (e) => {
      if (activeTool === 'erase' && e.target) {
        fabricCanvasRef.current?.remove(e.target);
        saveCanvasState();
      }
    });
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

  const autoSaveToPDF = async () => {
    if (!fabricCanvasRef.current) return;

    setSaving(true);
    try {
      const canvas = fabricCanvasRef.current.getElement();
      const annotatedImageData = canvas.toDataURL('image/png', 1.0);
      
      const response = await fetch(annotatedImageData);
      const blob = await response.blob();
      
      const annotatedFileName = `${fileName.replace('.pdf', '')}_page_${currentPage}_annotated.png`;
      const filePath = `${projectId}/${annotatedFileName}`;
      
      const { error } = await supabase
        .storage
        .from('project_files')
        .upload(filePath, blob, { upsert: true });

      if (error) throw error;

      onSave?.();
    } catch (error) {
      console.error('Error auto-saving to PDF:', error);
    } finally {
      setSaving(false);
    }
  };

  const saveToPDF = async () => {
    setSaving(true);
    try {
      await autoSaveToPDF();
      toast({
        title: "Success",
        description: "PDF annotations saved successfully",
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

  const changePage = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
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
    }
  }, [drawingColor, strokeWidth]);

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
                <span className="text-sm">Saving...</span>
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
                {saving ? 'Saving to PDF...' : 'Save to PDF'}
              </Button>
              
              <Button
                onClick={exportAnnotatedPDF}
                disabled={saving}
                variant="outline"
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Page
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
