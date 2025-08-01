
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { partsListService, Part } from '@/services/partsListService';
import { Loader2, Package, Circle } from 'lucide-react';

interface ProjectPartsViewerProps {
  isOpen: boolean;
  onClose: () => void;
  partsListId: string;
  fileName: string;
}

const getBackgroundColor = (color: string) => {
  switch (color) {
    case 'green':
      return 'bg-green-100 border-green-300';
    case 'orange':
      return 'bg-orange-100 border-orange-300';
    case 'red':
      return 'bg-red-100 border-red-300';
    default:
      return 'bg-gray-50 border-gray-200';
  }
};

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

export const ProjectPartsViewer: React.FC<ProjectPartsViewerProps> = ({
  isOpen,
  onClose,
  partsListId,
  fileName
}) => {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingPart, setUpdatingPart] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && partsListId) {
      loadParts();
    }
  }, [isOpen, partsListId]);

  const loadParts = async () => {
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
            Parts List - {fileName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : parts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No parts found in this list
          </div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{fileName}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-50 border border-gray-200 rounded"></div>
                    <span>Unprocessed: {statusCounts.none}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
                    <span>Complete: {statusCounts.green}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded"></div>
                    <span>In Progress: {statusCounts.orange}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
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
                    <TableRow key={part.id} className={`border ${getBackgroundColor(part.color_status)}`}>
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
