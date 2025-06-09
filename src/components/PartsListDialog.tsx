
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PartsListImporter } from '@/components/PartsListImporter';
import { PartsListViewer } from '@/components/PartsListViewer';
import { PartsListManager } from '@/components/PartsListManager';

interface PartsListDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  tasks: any[];
  onImportComplete?: () => void;
}

export const PartsListDialog: React.FC<PartsListDialogProps> = ({
  isOpen,
  onClose,
  projectId,
  tasks,
  onImportComplete
}) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [selectedTaskTitle, setSelectedTaskTitle] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTaskSelect = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    setSelectedTaskId(taskId);
    setSelectedTaskTitle(task?.title || '');
  };

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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manage">Manage Parts Lists</TabsTrigger>
            <TabsTrigger value="import">Import CSV</TabsTrigger>
            <TabsTrigger value="view" disabled={!selectedTaskId}>View Task Parts</TabsTrigger>
          </TabsList>
          
          <TabsContent value="manage" className="space-y-4 h-full overflow-auto">
            <PartsListManager
              projectId={projectId}
              tasks={tasks}
              onTaskSelect={handleTaskSelect}
              refreshKey={refreshKey}
            />
          </TabsContent>
          
          <TabsContent value="import" className="space-y-4 h-full overflow-auto">
            <PartsListImporter
              projectId={projectId}
              tasks={tasks}
              onImportComplete={handleImportComplete}
            />
          </TabsContent>
          
          <TabsContent value="view" className="h-full overflow-auto">
            {selectedTaskId && (
              <PartsListViewer
                isOpen={true}
                onClose={() => {}}
                taskId={selectedTaskId}
                taskTitle={selectedTaskTitle}
              />
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
