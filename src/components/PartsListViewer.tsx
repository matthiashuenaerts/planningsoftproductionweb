
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { partsListService, Part, PartsList } from '@/services/partsListService';
import { Loader2, Package, Circle } from 'lucide-react';

interface PartsListViewerProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskTitle: string;
}

const getColorClass = (color: string) => {
  switch (color) {
    case 'green':
      return 'text-green-600 fill-green-600';
    case 'orange':
      return 'text-orange-600 fill-orange-600';
    case 'red':
      return 'text-red-600 fill-red-600';
    default:
      return 'text-gray-400 fill-gray-400';
  }
};

const ColorButton: React.FC<{
  color: 'none' | 'green' | 'orange' | 'red';
  isActive: boolean;
  onClick: () => void;
}> = ({ color, isActive, onClick }) => {
  const colorClasses = {
    none: 'text-gray-400 hover:text-gray-600',
    green: 'text-green-600 hover:text-green-700',
    orange: 'text-orange-600 hover:text-orange-700',
    red: 'text-red-600 hover:text-red-700'
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={`p-1 h-8 w-8 ${colorClasses[color]} ${isActive ? 'bg-muted' : ''}`}
    >
      <Circle className={`h-4 w-4 ${isActive ? 'fill-current' : ''}`} />
    </Button>
  );
};

export const PartsListViewer: React.FC<PartsListViewerProps> = ({
  isOpen,
  onClose,
  taskId,
  taskTitle
}) => {
  const [partsLists, setPartsLists] = useState<PartsList[]>([]);
  const [selectedPartsList, setSelectedPartsList] = useState<PartsList | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingPart, setUpdatingPart] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && taskId) {
      loadPartsLists();
    }
  }, [isOpen, taskId]);

  const loadPartsLists = async () => {
    setLoading(true);
    try {
      const lists = await partsListService.getPartsListsByTask(taskId);
      setPartsLists(lists);
      
      if (lists.length === 1) {
        // Auto-select if only one parts list
        setSelectedPartsList(lists[0]);
        loadParts(lists[0].id);
      }
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

  const loadParts = async (partsListId: string) => {
    setLoading(true);
    try {
      const partsData = await partsListService.getPartsByPartsList(partsListId);
      setParts(partsData);
    } catch (error) {
      console.error('Error loading parts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load parts',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePartColor = async (partId: string, color: 'none' | 'green' | 'orange' | 'red') => {
    setUpdatingPart(partId);
    try {
      await partsListService.updatePartColor(partId, color);
      setParts(prev => prev.map(part => 
        part.id === partId ? { ...part, color_status: color } : part
      ));
      toast({
        title: 'Color updated',
        description: 'Part color status has been updated'
      });
    } catch (error) {
      console.error('Error updating part color:', error);
      toast({
        title: 'Error',
        description: 'Failed to update part color',
        variant: 'destructive'
      });
    } finally {
      setUpdatingPart(null);
    }
  };

  const selectPartsList = (partsList: PartsList) => {
    setSelectedPartsList(partsList);
    loadParts(partsList.id);
  };

  const getStatusCounts = () => {
    return {
      total: parts.length,
      none: parts.filter(p => p.color_status === 'none').length,
      green: parts.filter(p => p.color_status === 'green').length,
      orange: parts.filter(p => p.color_status === 'orange').length,
      red: parts.filter(p => p.color_status === 'red').length
    };
  };

  const statusCounts = getStatusCounts();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Parts List - {taskTitle}
          </DialogTitle>
        </DialogHeader>

        {loading && !selectedPartsList ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : partsLists.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No parts lists found for this task
          </div>
        ) : (
          <div className="space-y-4">
            {partsLists.length > 1 && (
              <div className="space-y-2">
                <h3 className="font-medium">Select Parts List:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {partsLists.map(partsList => (
                    <Button
                      key={partsList.id}
                      variant={selectedPartsList?.id === partsList.id ? "default" : "outline"}
                      onClick={() => selectPartsList(partsList)}
                      className="justify-start"
                    >
                      {partsList.file_name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {selectedPartsList && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{selectedPartsList.file_name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Circle className="h-4 w-4 text-gray-400" />
                        <span>Unprocessed: {statusCounts.none}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Circle className="h-4 w-4 text-green-600 fill-green-600" />
                        <span>Complete: {statusCounts.green}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Circle className="h-4 w-4 text-orange-600 fill-orange-600" />
                        <span>In Progress: {statusCounts.orange}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Circle className="h-4 w-4 text-red-600 fill-red-600" />
                        <span>Issues: {statusCounts.red}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <ScrollArea className="h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Materiaal</TableHead>
                        <TableHead>Dikte</TableHead>
                        <TableHead>Afmetingen</TableHead>
                        <TableHead>Aantal</TableHead>
                        <TableHead>Wand Naam</TableHead>
                        <TableHead>CNC Pos</TableHead>
                        <TableHead>Commentaar</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parts.map(part => (
                        <TableRow key={part.id}>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Circle className={`h-4 w-4 ${getColorClass(part.color_status)}`} />
                              <div className="flex gap-1 ml-2">
                                <ColorButton
                                  color="none"
                                  isActive={part.color_status === 'none'}
                                  onClick={() => updatePartColor(part.id, 'none')}
                                />
                                <ColorButton
                                  color="green"
                                  isActive={part.color_status === 'green'}
                                  onClick={() => updatePartColor(part.id, 'green')}
                                />
                                <ColorButton
                                  color="orange"
                                  isActive={part.color_status === 'orange'}
                                  onClick={() => updatePartColor(part.id, 'orange')}
                                />
                                <ColorButton
                                  color="red"
                                  isActive={part.color_status === 'red'}
                                  onClick={() => updatePartColor(part.id, 'red')}
                                />
                              </div>
                              {updatingPart === part.id && (
                                <Loader2 className="h-3 w-3 animate-spin ml-2" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{part.materiaal || '-'}</TableCell>
                          <TableCell>{part.dikte || '-'}</TableCell>
                          <TableCell>
                            {part.lengte && part.breedte 
                              ? `${part.lengte} x ${part.breedte}` 
                              : part.lengte || part.breedte || '-'
                            }
                          </TableCell>
                          <TableCell>{part.aantal || '-'}</TableCell>
                          <TableCell>{part.wand_naam || '-'}</TableCell>
                          <TableCell>{part.cnc_pos || '-'}</TableCell>
                          <TableCell>
                            <div className="max-w-32 truncate" title={part.commentaar || part.commentaar_2 || ''}>
                              {part.commentaar || part.commentaar_2 || '-'}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
