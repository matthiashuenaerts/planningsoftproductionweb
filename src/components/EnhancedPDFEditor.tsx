
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
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
  Redo
} from 'lucide-react';
import { Canvas as FabricCanvas, Rect, Circle as FabricCircle, Textbox, FabricImage } from 'fabric';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocument | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [activeTool, setActiveTool] = useState<'select' | 'draw' | 'text' | 'rectangle' | 'circle'>('select');
  const [drawingColor, setDrawingColor] = useState('#ff0000');
  const [strokeWidth, setStrokeWidth] = useState(2);

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
      preserveObjectStacking: true
    });

    fabricCanvasRef.current = fabricCanvas;

    // Set up drawing mode immediately
    fabricCanvas.isDrawingMode = false;
    
    // Initialize free drawing brush properly for Fabric.js v6
    console.log('Setting up drawing brush...');
    
    // Set up the brush properties immediately after canvas creation
    if (fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color = drawingColor;
      fabricCanvas.freeDrawingBrush.width = strokeWidth;
      console.log('Drawing brush configured successfully');
    } else {
      console.warn('freeDrawingBrush not available immediately');
      // Use a shorter timeout to ensure brush is available
      setTimeout(() => {
        if (fabricCanvas.freeDrawingBrush) {
          fabricCanvas.freeDrawingBrush.color = drawingColor;
          fabricCanvas.freeDrawingBrush.width = strokeWidth;
          console.log('Drawing brush configured via timeout');
        } else {
          console.error('freeDrawingBrush still not available');
        }
      }, 50);
    }

    // Handle canvas events
    fabricCanvas.on('path:created', handleDrawingCreated);
    fabricCanvas.on('object:added', handleObjectAdded);
    fabricCanvas.on('object:modified', handleObjectModified);
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

        // Set PDF as background using Fabric.js v6 API
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

  const handleDrawingCreated = () => {
    console.log('Drawing created, auto-saving to PDF...');
    saveToPDF();
  };

  const handleObjectAdded = () => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.renderAll();
    }
  };

  const handleObjectModified = () => {
    console.log('Object modified, auto-saving to PDF...');
    saveToPDF();
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
        if (fabricCanvasRef.current.freeDrawingBrush) {
          fabricCanvasRef.current.freeDrawingBrush.color = drawingColor;
          fabricCanvasRef.current.freeDrawingBrush.width = strokeWidth;
          console.log('Drawing mode enabled with brush color:', drawingColor);
        } else {
          console.error('freeDrawingBrush not available when switching to draw mode');
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
      case 'select':
        fabricCanvasRef.current.selection = true;
        console.log('Selection mode enabled');
        break;
    }
  };

  const addTextbox = () => {
    if (!fabricCanvasRef.current) return;

    const textbox = new Textbox('Click to edit text', {
      left: 100,
      top: 100,
      width: 200,
      fontSize: 16,
      fill: drawingColor,
      fontFamily: 'Arial'
    });

    fabricCanvasRef.current.add(textbox);
    fabricCanvasRef.current.setActiveObject(textbox);
    textbox.enterEditing();
    saveToPDF();
  };

  const addRectangle = () => {
    if (!fabricCanvasRef.current) return;

    const rect = new Rect({
      left: 100,
      top: 100,
      fill: 'transparent',
      stroke: drawingColor,
      strokeWidth: strokeWidth,
      width: 100,
      height: 100
    });

    fabricCanvasRef.current.add(rect);
    saveToPDF();
  };

  const addCircle = () => {
    if (!fabricCanvasRef.current) return;

    const circle = new FabricCircle({
      left: 100,
      top: 100,
      fill: 'transparent',
      stroke: drawingColor,
      strokeWidth: strokeWidth,
      radius: 50
    });

    fabricCanvasRef.current.add(circle);
    saveToPDF();
  };

  const saveToPDF = async () => {
    if (!fabricCanvasRef.current) return;

    setSaving(true);
    try {
      // Get the canvas with annotations as image
      const canvas = fabricCanvasRef.current.getElement();
      const annotatedImageData = canvas.toDataURL('image/png');
      
      // Convert to blob and save the annotated version
      const response = await fetch(annotatedImageData);
      const blob = await response.blob();
      
      // Save the annotated PDF page as a new file
      const annotatedFileName = `${fileName.replace('.pdf', '')}_page_${currentPage}_annotated.pdf`;
      const filePath = `${projectId}/${annotatedFileName}`;
      
      const { error } = await supabase
        .storage
        .from('project_files')
        .upload(filePath, blob, { upsert: true });

      if (error) throw error;

      onSave?.();
      
      toast({
        title: "Success",
        description: "Annotations saved to PDF successfully",
      });
      
      console.log('Annotations saved to PDF successfully');
    } catch (error) {
      console.error('Error saving to PDF:', error);
      toast({
        title: "Error",
        description: "Failed to save annotations to PDF",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const clearCanvas = () => {
    if (!fabricCanvasRef.current) return;
    
    const objects = fabricCanvasRef.current.getObjects();
    objects.forEach(obj => fabricCanvasRef.current?.remove(obj));
    fabricCanvasRef.current.renderAll();
    saveToPDF();
  };

  const undo = () => {
    if (!fabricCanvasRef.current) return;
    
    const objects = fabricCanvasRef.current.getObjects();
    if (objects.length > 0) {
      fabricCanvasRef.current.remove(objects[objects.length - 1]);
      saveToPDF();
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
      
      // Get the current annotated canvas
      const canvas = fabricCanvasRef.current.getElement();
      const dataURL = canvas.toDataURL('image/png');
      
      // Create a download link for the annotated page
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
      console.log('Brush properties updated:', { color: drawingColor, width: strokeWidth });
    }
  }, [drawingColor, strokeWidth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading enhanced PDF editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="enhanced-pdf-editor flex flex-col lg:flex-row gap-4 h-full">
      {/* PDF Viewer with Drawing Canvas */}
      <div className="flex-1" ref={containerRef}>
        <div className="pdf-controls mb-4 flex flex-wrap gap-2 items-center">
          <Button
            onClick={() => changePage(currentPage - 1)}
            disabled={currentPage <= 1}
            size="sm"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <span className="text-sm font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            onClick={() => changePage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            size="sm"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
          
          <div className="flex items-center gap-2">
            <span className="text-sm">Zoom:</span>
            <Button
              onClick={() => changeScale(scale - 0.25)}
              size="sm"
              variant="outline"
              disabled={scale <= 0.5}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm min-w-[60px] text-center font-medium">
              {Math.round(scale * 100)}%
            </span>
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
            <div className="flex items-center gap-2 text-green-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
              Saving to PDF...
            </div>
          )}
        </div>
        
        <div className="border rounded-lg overflow-auto max-h-[70vh] bg-gray-50 p-4">
          <canvas ref={canvasRef} className="border border-gray-300 rounded" />
        </div>
      </div>

      {/* Controls Panel */}
      <div className="w-full lg:w-80 space-y-4">
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Drawing Tools</h3>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <Button
                onClick={() => handleToolChange('select')}
                variant={activeTool === 'select' ? 'default' : 'outline'}
                size="sm"
              >
                Select
              </Button>
              <Button
                onClick={() => handleToolChange('draw')}
                variant={activeTool === 'draw' ? 'default' : 'outline'}
                size="sm"
              >
                <Edit3 className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => handleToolChange('text')}
                variant={activeTool === 'text' ? 'default' : 'outline'}
                size="sm"
              >
                <Type className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => handleToolChange('rectangle')}
                variant={activeTool === 'rectangle' ? 'default' : 'outline'}
                size="sm"
              >
                <Square className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => handleToolChange('circle')}
                variant={activeTool === 'circle' ? 'default' : 'outline'}
                size="sm"
              >
                <Circle className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Color:</label>
                <Input
                  type="color"
                  value={drawingColor}
                  onChange={(e) => setDrawingColor(e.target.value)}
                  className="w-full h-8 mt-1"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Stroke Width:</label>
                <Input
                  type="range"
                  min="1"
                  max="10"
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                  className="w-full mt-1"
                />
                <span className="text-xs text-gray-500">{strokeWidth}px</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Actions</h3>
            <div className="space-y-2">
              <Button onClick={undo} variant="outline" size="sm" className="w-full">
                <Undo className="h-4 w-4 mr-2" />
                Undo Last
              </Button>
              <Button onClick={clearCanvas} variant="outline" size="sm" className="w-full">
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Page
              </Button>
              <Button
                onClick={() => saveToPDF()}
                disabled={saving}
                className="w-full"
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
    </div>
  );
};

export default EnhancedPDFEditor;
