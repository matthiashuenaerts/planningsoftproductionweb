
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PartsListImporter } from '@/components/PartsListImporter';
import { PartsListManager } from '@/components/PartsListManager';

interface PartsListDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onImportComplete?: () => void;
}

export const PartsListDialog: React.FC<PartsListDialogProps> = ({
  isOpen,
  onClose,
  projectId,
  onImportComplete
}) => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleImportComplete = () => {
    setRefreshKey(prev => prev + 1);
    onImportComplete?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Parts Lists Management</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="manage" className="w-full h-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manage">Manage Parts Lists</TabsTrigger>
            <TabsTrigger value="import">Import CSV</TabsTrigger>
          </TabsList>
          
          <TabsContent value="manage" className="space-y-4 h-full overflow-auto">
            <PartsListManager
              projectId={projectId}
              refreshKey={refreshKey}
            />
          </TabsContent>
          
          <TabsContent value="import" className="space-y-4 h-full overflow-auto">
            <PartsListImporter
              projectId={projectId}
              onImportComplete={handleImportComplete}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
