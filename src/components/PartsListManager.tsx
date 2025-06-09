
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { partsListService, PartsList } from '@/services/partsListService';
import { Loader2, Package, FileText, Trash2, Eye } from 'lucide-react';
import { PartsListViewer } from '@/components/PartsListViewer';

interface PartsListManagerProps {
  projectId: string;
  tasks: any[];
  onTaskSelect: (taskId: string) => void;
  refreshKey: number;
}

export const PartsListManager: React.FC<PartsListManagerProps> = ({
  projectId,
  tasks,
  onTaskSelect,
  refreshKey
}) => {
  const [partsLists, setPartsLists] = useState<PartsList[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPartsList, setSelectedPartsList] = useState<PartsList | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPartsLists();
  }, [projectId, refreshKey]);

  const loadPartsLists = async () => {
    setLoading(true);
    try {
      const lists = await partsListService.getPartsListsByProject(projectId);
      setPartsLists(lists);
    } catch (error) {
      console.error('Error loading parts lists:', error);
      toast({
        title: 'Error',
        description: 'Failed to load parts lists',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (partsListId: string) => {
    if (!confirm('Are you sure you want to delete this parts list?')) return;

    try {
      await partsListService.deletePartsList(partsListId);
      toast({
        title: 'Success',
        description: 'Parts list deleted successfully'
      });
      loadPartsLists();
    } catch (error) {
      console.error('Error deleting parts list:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete parts list',
        variant: 'destructive'
      });
    }
  };

  const handleView = (partsList: PartsList) => {
    if (partsList.task_id) {
      setSelectedPartsList(partsList);
      setViewerOpen(true);
    } else {
      toast({
        title: 'No Task Associated',
        description: 'This parts list is not associated with a specific task',
        variant: 'destructive'
      });
    }
  };

  const getTaskTitle = (taskId: string | null) => {
    if (!taskId) return 'General Project';
    const task = tasks.find(t => t.id === taskId);
    return task?.title || 'Unknown Task';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Project Parts Lists ({partsLists.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {partsLists.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No parts lists found for this project</p>
              <p className="text-sm">Import a CSV file to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Associated Task</TableHead>
                  <TableHead>Imported</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partsLists.map(partsList => (
                  <TableRow key={partsList.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {partsList.file_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={partsList.task_id ? "default" : "secondary"}>
                        {getTaskTitle(partsList.task_id)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(partsList.imported_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleView(partsList)}
                          disabled={!partsList.task_id}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(partsList.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Task Selection for Viewing */}
      {partsLists.some(pl => pl.task_id) && (
        <Card>
          <CardHeader>
            <CardTitle>View Parts by Task</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {tasks.map(task => {
                const taskPartsLists = partsLists.filter(pl => pl.task_id === task.id);
                if (taskPartsLists.length === 0) return null;
                
                return (
                  <Button
                    key={task.id}
                    variant="outline"
                    onClick={() => onTaskSelect(task.id)}
                    className="justify-between h-auto p-4"
                  >
                    <div className="text-left">
                      <div className="font-medium">{task.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {taskPartsLists.length} parts list{taskPartsLists.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <Badge>{taskPartsLists.length}</Badge>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parts List Viewer Modal */}
      {selectedPartsList && (
        <PartsListViewer
          isOpen={viewerOpen}
          onClose={() => {
            setViewerOpen(false);
            setSelectedPartsList(null);
          }}
          taskId={selectedPartsList.task_id!}
          taskTitle={getTaskTitle(selectedPartsList.task_id)}
        />
      )}
    </>
  );
};
