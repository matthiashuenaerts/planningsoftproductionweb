import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate} from 'react-router-dom';
import PDFViewerEditor from '@/components/PDFViewerEditor';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const PDFEditorFullscreen: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const pdfUrl = searchParams.get('url') || '';
  const projectId = searchParams.get('projectId') || '';
  const fileName = searchParams.get('fileName') || '';
  const returnUrl = searchParams.get('returnUrl') || '';

  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    // Validate required params
    if (pdfUrl && projectId && fileName) {
      setIsValid(true);
    }
  }, [pdfUrl, projectId, fileName]);

  const handleClose = () => {
    if (returnUrl) {
      navigate(returnUrl);
    } else {
      window.close();
    }
  };

  if (!isValid) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-xl font-semibold text-foreground">Invalid PDF URL</h1>
          <p className="text-muted-foreground">Missing required parameters to open the PDF editor.</p>
          <Button onClick={() => window.close()} variant="outline">
            Close Tab
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Minimal header with back button */}
      <div className="flex items-center gap-3 p-2 border-b bg-card shrink-0">
        <Button onClick={handleClose} variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <span className="text-sm font-medium text-foreground truncate">
          {fileName}
        </span>
      </div>
      
      {/* Full-screen PDF editor */}
      <div className="flex-1 overflow-hidden">
        <PDFViewerEditor
          pdfUrl={pdfUrl}
          projectId={projectId}
          fileName={fileName}
          onClose={handleClose}
          fullscreen
        />
      </div>
    </div>
  );
};

export default PDFEditorFullscreen;
