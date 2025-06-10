
export interface TextAnnotation {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  page: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PDFEditorProps {
  pdfUrl: string;
  projectId: string;
  fileName: string;
  onSave?: () => void;
  onAnnotationChange?: (annotations: TextAnnotation[]) => void;
}

export interface PDFViewerState {
  currentPage: number;
  totalPages: number;
  scale: number;
  isLoading: boolean;
  error: string | null;
}

// PDF.js types
declare global {
  interface Window {
    pdfjsLib: {
      getDocument: (url: string) => {
        promise: Promise<PDFDocument>;
      };
      GlobalWorkerOptions: {
        workerSrc: string;
      };
    };
  }
}

export interface PDFDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PDFPage>;
}

export interface PDFPage {
  getViewport: (options: { scale: number }) => PDFViewport;
  render: (context: PDFRenderContext) => { promise: Promise<void> };
}

export interface PDFViewport {
  width: number;
  height: number;
}

export interface PDFRenderContext {
  canvasContext: CanvasRenderingContext2D;
  viewport: PDFViewport;
}
