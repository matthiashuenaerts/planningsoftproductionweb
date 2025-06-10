
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
  ChevronRight
} from 'lucide-react';
import { TextAnnotation, PDFEditorProps, PDFDocument } from '@/types/pdf';
import './PDFEditorStyles.css';

const PDFEditor: React.FC<PDFEditorProps> = ({ 
  pdfUrl, 
  projectId, 
  fileName, 
  onSave,
  onAnnotationChange
}) => {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [annotations, setAnnotations] = useState<TextAnnotation[]>([]);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [isAddingText, setIsAddingText] = useState(false);
  const [newText, setNewText] = useState('');
  const [pdfDoc, setPdfDoc] = useState<PDFDocument | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load PDF.js library and initialize
  useEffect(() => {
    const loadPdfJs = async () => {
      try {
        setLoading(true);
        
        // Check if PDF.js is already loaded
        if (window.pdfjsLib) {
          await loadPDF();
          return;
        }

        // Load PDF.js from CDN
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = async () => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
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
    loadAnnotations();

    return () => {
      // Cleanup if needed
    };
  }, [pdfUrl]);

  // Re-render page when page or scale changes
  useEffect(() => {
    if (pdfDoc && !loading) {
      renderPage(currentPage);
    }
  }, [currentPage, scale, pdfDoc]);

  // Re-render annotations when annotations change
  useEffect(() => {
    if (!loading) {
      renderAnnotations();
    }
  }, [annotations, selectedAnnotation, currentPage]);

  const loadPDF = async () => {
    try {
      const pdf = await window.pdfjsLib.getDocument(pdfUrl).promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      await renderPage(1);
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

  const renderPage = async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current || loading) return;

    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;
      renderAnnotations();
    } catch (error) {
      console.error('Error rendering page:', error);
      toast({
        title: "Error",
        description: "Failed to render PDF page",
        variant: "destructive"
      });
    }
  };

  const renderAnnotations = () => {
    if (!canvasRef.current || loading) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    // Get annotations for current page
    const pageAnnotations = annotations.filter(ann => ann.page === currentPage);
    
    pageAnnotations.forEach(annotation => {
      context.save();
      context.fillStyle = annotation.color;
      context.font = `${annotation.fontSize}px Arial`;
      context.textBaseline = 'top';
      
      // Add background for better readability
      const textMetrics = context.measureText(annotation.text);
      const textHeight = annotation.fontSize;
      
      context.fillStyle = 'rgba(255, 255, 255, 0.8)';
      context.fillRect(
        annotation.x - 2,
        annotation.y - 2,
        textMetrics.width + 4,
        textHeight + 4
      );
      
      // Draw text
      context.fillStyle = annotation.color;
      context.fillText(annotation.text, annotation.x, annotation.y);
      
      // Add selection border if selected
      if (selectedAnnotation === annotation.id) {
        context.strokeStyle = '#3b82f6';
        context.lineWidth = 2;
        context.strokeRect(
          annotation.x - 4, 
          annotation.y - 4, 
          textMetrics.width + 8, 
          textHeight + 8
        );
      }
      
      context.restore();
    });
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || loading) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvasRef.current.width / rect.width);
    const y = (event.clientY - rect.top) * (canvasRef.current.height / rect.height);

    if (isAddingText) {
      addTextAnnotation(x, y);
    } else {
      selectAnnotationAt(x, y);
    }
  };

  const addTextAnnotation = (x: number, y: number) => {
    if (!newText.trim()) {
      toast({
        title: "Error",
        description: "Please enter text to add",
        variant: "destructive"
      });
      return;
    }

    const annotation: TextAnnotation = {
      id: `annotation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      x,
      y,
      text: newText,
      fontSize: 16,
      color: '#000000',
      page: currentPage,
      createdAt: new Date().toISOString()
    };

    const newAnnotations = [...annotations, annotation];
    setAnnotations(newAnnotations);
    onAnnotationChange?.(newAnnotations);
    setNewText('');
    setIsAddingText(false);
    autoSave(newAnnotations);
    
    toast({
      title: "Success",
      description: "Text annotation added",
    });
  };

  const selectAnnotationAt = (x: number, y: number) => {
    const pageAnnotations = annotations.filter(ann => ann.page === currentPage);
    
    if (!canvasRef.current) return;
    const context = canvasRef.current.getContext('2d');
    if (!context) return;
    
    for (const annotation of pageAnnotations) {
      context.font = `${annotation.fontSize}px Arial`;
      const textMetrics = context.measureText(annotation.text);
      const textHeight = annotation.fontSize;
      
      if (
        x >= annotation.x - 4 && 
        x <= annotation.x + textMetrics.width + 4 &&
        y >= annotation.y - 4 && 
        y <= annotation.y + textHeight + 4
      ) {
        setSelectedAnnotation(annotation.id);
        return;
      }
    }
    
    setSelectedAnnotation(null);
  };

  const updateAnnotation = (id: string, updates: Partial<TextAnnotation>) => {
    const newAnnotations = annotations.map(ann => 
      ann.id === id ? { ...ann, ...updates, updatedAt: new Date().toISOString() } : ann
    );
    setAnnotations(newAnnotations);
    onAnnotationChange?.(newAnnotations);
    autoSave(newAnnotations);
  };

  const deleteAnnotation = (id: string) => {
    const newAnnotations = annotations.filter(ann => ann.id !== id);
    setAnnotations(newAnnotations);
    onAnnotationChange?.(newAnnotations);
    setSelectedAnnotation(null);
    autoSave(newAnnotations);
    
    toast({
      title: "Success",
      description: "Text annotation deleted",
    });
  };

  const loadAnnotations = async () => {
    try {
      const annotationKey = `${projectId}/${fileName}_annotations.json`;
      const { data, error } = await supabase
        .storage
        .from('project_files')
        .download(annotationKey);

      if (error) {
        // No annotations file exists yet, that's okay
        console.log('No existing annotations found');
        return;
      }

      const text = await data.text();
      const savedAnnotations = JSON.parse(text);
      setAnnotations(savedAnnotations);
      onAnnotationChange?.(savedAnnotations);
    } catch (error) {
      console.error('Error loading annotations:', error);
    }
  };

  const autoSave = async (annotationsToSave = annotations) => {
    setSaving(true);
    try {
      const annotationKey = `${projectId}/${fileName}_annotations.json`;
      const blob = new Blob([JSON.stringify(annotationsToSave, null, 2)], { 
        type: 'application/json' 
      });
      
      const { error } = await supabase
        .storage
        .from('project_files')
        .upload(annotationKey, blob, { upsert: true });

      if (error) throw error;

      onSave?.();
    } catch (error) {
      console.error('Error saving annotations:', error);
      toast({
        title: "Error",
        description: "Failed to save annotations",
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

  const selectedAnnotationData = selectedAnnotation 
    ? annotations.find(ann => ann.id === selectedAnnotation)
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading PDF editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-editor-container flex flex-col lg:flex-row gap-4 h-full">
      {/* PDF Viewer */}
      <div className="flex-1" ref={containerRef}>
        <div className="pdf-page-controls mb-4">
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
          
          <div className="pdf-zoom-controls">
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
            <div className="saving-indicator">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
              Saving...
            </div>
          )}
        </div>
        
        <div className="border rounded-lg overflow-auto max-h-[70vh] bg-gray-50 p-4">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="pdf-canvas"
          />
        </div>
      </div>

      {/* Controls Panel */}
      <div className="w-full lg:w-80 space-y-4">
        <div className="editor-panel">
          <h3>Add Text Annotation</h3>
          <div className="space-y-3">
            <Textarea
              placeholder="Enter text to add..."
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              rows={3}
            />
            <Button
              onClick={() => setIsAddingText(true)}
              disabled={!newText.trim() || isAddingText}
              className="w-full"
              variant={isAddingText ? "secondary" : "default"}
            >
              <Plus className="h-4 w-4 mr-2" />
              {isAddingText ? "Click on PDF to place text" : "Add Text"}
            </Button>
            {isAddingText && (
              <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                Click anywhere on the PDF to place your text annotation
              </div>
            )}
          </div>
        </div>

        {selectedAnnotationData && (
          <div className="editor-panel">
            <h3>Edit Selected Annotation</h3>
            <div className="space-y-3">
              <div className="form-group">
                <label className="form-label">Text:</label>
                <Textarea
                  value={selectedAnnotationData.text}
                  onChange={(e) => updateAnnotation(selectedAnnotation!, { text: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <div className="form-group flex-1">
                  <label className="form-label">Size:</label>
                  <Input
                    type="number"
                    min="8"
                    max="72"
                    value={selectedAnnotationData.fontSize}
                    onChange={(e) => updateAnnotation(selectedAnnotation!, { fontSize: parseInt(e.target.value) || 16 })}
                    className="text-size-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Color:</label>
                  <Input
                    type="color"
                    value={selectedAnnotationData.color}
                    onChange={(e) => updateAnnotation(selectedAnnotation!, { color: e.target.value })}
                    className="color-input"
                  />
                </div>
              </div>
              <Button
                onClick={() => deleteAnnotation(selectedAnnotation!)}
                variant="destructive"
                size="sm"
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Annotation
              </Button>
            </div>
          </div>
        )}

        <div className="editor-panel">
          <h3>Annotations ({annotations.length})</h3>
          <div className="annotation-list">
            {annotations.map(annotation => (
              <div
                key={annotation.id}
                className={`annotation-item ${
                  selectedAnnotation === annotation.id ? 'selected' : ''
                }`}
                onClick={() => {
                  setSelectedAnnotation(annotation.id);
                  if (annotation.page !== currentPage) {
                    setCurrentPage(annotation.page);
                  }
                }}
              >
                <div className="font-medium truncate text-sm">{annotation.text}</div>
                <div className="text-gray-500 text-xs">Page {annotation.page}</div>
              </div>
            ))}
            {annotations.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">
                No annotations yet. Add some text to get started!
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Button
            onClick={() => autoSave()}
            disabled={saving}
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Annotations'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PDFEditor;
