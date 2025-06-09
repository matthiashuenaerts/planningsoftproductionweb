
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PartsListImporter } from '@/components/PartsListImporter';
import { PartsListViewer } from '@/components/PartsListViewer';

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

  const handleTaskSelect = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    setSelectedTaskId(taskId);
    setSelectedTaskTitle(task?.title || '');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Parts Lists</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="import" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import">Import Parts List</TabsTrigger>
            <TabsTrigger value="view" disabled={!selectedTaskId}>View Parts Lists</TabsTrigger>
          </TabsList>
          
          <TabsContent value="import" className="space-y-4">
            <PartsListImporter
              projectId={projectId}
              tasks={tasks}
              onImportComplete={() => {
                onImportComplete?.();
              }}
            />
            
            {tasks.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-medium">Select a task to view its parts lists:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {tasks.map(task => (
                    <button
                      key={task.id}
                      onClick={() => handleTaskSelect(task.id)}
                      className={`p-2 text-left border rounded ${
                        selectedTaskId === task.id 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-background hover:bg-muted'
                      }`}
                    >
                      {task.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="view">
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
