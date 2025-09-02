import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { partsListService, Part, PartsList } from '@/services/partsListService';
import { Loader2, Package, Circle, Plus, Trash2, Printer, Edit3, Save, X } from 'lucide-react';

interface OrderPartsListEditorProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderName: string;
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

export const OrderPartsListEditor: React.FC<OrderPartsListEditorProps> = ({
  isOpen,
  onClose,
  orderId,
  orderName
}) => {
  const [partsLists, setPartsLists] = useState<PartsList[]>([]);
  const [selectedPartsList, setSelectedPartsList] = useState<PartsList | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingPart, setUpdatingPart] = useState<string | null>(null);
  const [editingPart, setEditingPart] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Part>>({});
  const [newPart, setNewPart] = useState<Partial<Part>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && orderId) {
      loadPartsLists();
    }
  }, [isOpen, orderId]);

  const loadPartsLists = async () => {
    setLoading(true);
    try {
      const lists = await partsListService.getPartsListsByOrder(orderId);
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

  const startEditing = (part: Part) => {
    setEditingPart(part.id);
    setEditForm({
      materiaal: part.materiaal,
      dikte: part.dikte,
      lengte: part.lengte,
      breedte: part.breedte,
      aantal: part.aantal,
      wand_naam: part.wand_naam,
      cnc_pos: part.cnc_pos,
      commentaar: part.commentaar
    });
  };

  const saveEdit = async (partId: string) => {
    try {
      await partsListService.updatePart(partId, editForm);
      setParts(prev => prev.map(part => 
        part.id === partId ? { ...part, ...editForm } : part
      ));
      setEditingPart(null);
      setEditForm({});
      toast({
        title: 'Part updated',
        description: 'Part has been updated successfully'
      });
    } catch (error) {
      console.error('Error updating part:', error);
      toast({
        title: 'Error',
        description: 'Failed to update part',
        variant: 'destructive'
      });
    }
  };

  const cancelEdit = () => {
    setEditingPart(null);
    setEditForm({});
  };

  const addNewPart = async () => {
    if (!selectedPartsList || !newPart.materiaal || !newPart.aantal) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in at least Materiaal and Aantal',
        variant: 'destructive'
      });
      return;
    }

    try {
      const part = await partsListService.createPart({
        ...newPart,
        parts_list_id: selectedPartsList.id,
        color_status: 'none'
      } as Omit<Part, 'id' | 'created_at' | 'updated_at'>);
      
      setParts(prev => [...prev, part]);
      setNewPart({});
      setShowAddForm(false);
      toast({
        title: 'Part added',
        description: 'New part has been added successfully'
      });
    } catch (error) {
      console.error('Error adding part:', error);
      toast({
        title: 'Error',
        description: 'Failed to add part',
        variant: 'destructive'
      });
    }
  };

  const deletePart = async (partId: string) => {
    if (!confirm('Are you sure you want to delete this part?')) return;

    try {
      await partsListService.deletePart(partId);
      setParts(prev => prev.filter(part => part.id !== partId));
      toast({
        title: 'Part deleted',
        description: 'Part has been deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting part:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete part',
        variant: 'destructive'
      });
    }
  };

  const printPartsList = () => {
    if (!selectedPartsList || parts.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const statusCounts = getStatusCounts();
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Parts List - ${selectedPartsList.file_name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .status-summary { margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 5px; }
            .status-item { display: inline-block; margin-right: 20px; }
            .status-dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 5px; }
            .status-none { background-color: #ccc; }
            .status-green { background-color: #22c55e; }
            .status-orange { background-color: #f97316; }
            .status-red { background-color: #ef4444; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <h1>Parts List: ${selectedPartsList.file_name}</h1>
          <p><strong>Order:</strong> ${orderName}</p>
          
          <div class="status-summary">
            <h3>Status Summary</h3>
            <div class="status-item">
              <span class="status-dot status-none"></span>
              Unprocessed: ${statusCounts.none}
            </div>
            <div class="status-item">
              <span class="status-dot status-green"></span>
              Complete: ${statusCounts.green}
            </div>
            <div class="status-item">
              <span class="status-dot status-orange"></span>
              In Progress: ${statusCounts.orange}
            </div>
            <div class="status-item">
              <span class="status-dot status-red"></span>
              Issues: ${statusCounts.red}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Materiaal</th>
                <th>Dikte</th>
                <th>Afmetingen</th>
                <th>Aantal</th>
                <th>Wand Naam</th>
                <th>CNC Pos</th>
                <th>Commentaar</th>
              </tr>
            </thead>
            <tbody>
              ${parts.map(part => `
                <tr>
                  <td>
                    <span class="status-dot status-${part.color_status}"></span>
                    ${part.color_status === 'none' ? 'Unprocessed' : 
                      part.color_status === 'green' ? 'Complete' : 
                      part.color_status === 'orange' ? 'In Progress' : 'Issues'}
                  </td>
                  <td>${part.materiaal || '-'}</td>
                  <td>${part.dikte || '-'}</td>
                  <td>${part.lengte && part.breedte ? `${part.lengte} x ${part.breedte}` : part.lengte || part.breedte || '-'}</td>
                  <td>${part.aantal || '-'}</td>
                  <td>${part.wand_naam || '-'}</td>
                  <td>${part.cnc_pos || '-'}</td>
                  <td>${part.commentaar || part.commentaar_2 || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
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
      <DialogContent className="max-w-7xl max-h-[95vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Parts List - {orderName}
            </div>
            {selectedPartsList && (
              <Button onClick={printPartsList} variant="outline" size="sm">
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && !selectedPartsList ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : partsLists.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No parts lists found for this order
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
                    <CardTitle className="text-lg flex items-center justify-between">
                      {selectedPartsList.file_name}
                      <Button 
                        onClick={() => setShowAddForm(!showAddForm)} 
                        variant="outline" 
                        size="sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Part
                      </Button>
                    </CardTitle>
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

                {showAddForm && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Add New Part</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <Input
                          placeholder="Materiaal *"
                          value={newPart.materiaal || ''}
                          onChange={(e) => setNewPart(prev => ({ ...prev, materiaal: e.target.value }))}
                        />
                        <Input
                          placeholder="Dikte"
                          value={newPart.dikte || ''}
                          onChange={(e) => setNewPart(prev => ({ ...prev, dikte: e.target.value }))}
                        />
                        <Input
                          placeholder="Lengte"
                          value={newPart.lengte || ''}
                          onChange={(e) => setNewPart(prev => ({ ...prev, lengte: e.target.value }))}
                        />
                        <Input
                          placeholder="Breedte"
                          value={newPart.breedte || ''}
                          onChange={(e) => setNewPart(prev => ({ ...prev, breedte: e.target.value }))}
                        />
                        <Input
                          placeholder="Aantal *"
                          type="number"
                          value={newPart.aantal?.toString() || ''}
                          onChange={(e) => setNewPart(prev => ({ ...prev, aantal: parseInt(e.target.value) || undefined }))}
                        />
                        <Input
                          placeholder="Wand Naam"
                          value={newPart.wand_naam || ''}
                          onChange={(e) => setNewPart(prev => ({ ...prev, wand_naam: e.target.value }))}
                        />
                        <Input
                          placeholder="CNC Pos"
                          value={newPart.cnc_pos || ''}
                          onChange={(e) => setNewPart(prev => ({ ...prev, cnc_pos: e.target.value }))}
                        />
                        <Input
                          placeholder="Commentaar"
                          value={newPart.commentaar || ''}
                          onChange={(e) => setNewPart(prev => ({ ...prev, commentaar: e.target.value }))}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={addNewPart} size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Part
                        </Button>
                        <Button onClick={() => setShowAddForm(false)} variant="outline" size="sm">
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

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
                        <TableHead>Actions</TableHead>
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
                          <TableCell>
                            {editingPart === part.id ? (
                              <Input
                                value={editForm.materiaal || ''}
                                onChange={(e) => setEditForm(prev => ({ ...prev, materiaal: e.target.value }))}
                                className="h-8"
                              />
                            ) : (
                              part.materiaal || '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {editingPart === part.id ? (
                              <Input
                                value={editForm.dikte || ''}
                                onChange={(e) => setEditForm(prev => ({ ...prev, dikte: e.target.value }))}
                                className="h-8"
                              />
                            ) : (
                              part.dikte || '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {editingPart === part.id ? (
                              <div className="flex gap-1">
                                <Input
                                  placeholder="L"
                                  value={editForm.lengte || ''}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, lengte: e.target.value }))}
                                  className="h-8 w-16"
                                />
                                <Input
                                  placeholder="B"
                                  value={editForm.breedte || ''}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, breedte: e.target.value }))}
                                  className="h-8 w-16"
                                />
                              </div>
                            ) : (
                              part.lengte && part.breedte 
                                ? `${part.lengte} x ${part.breedte}` 
                                : part.lengte || part.breedte || '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {editingPart === part.id ? (
                              <Input
                                type="number"
                                value={editForm.aantal?.toString() || ''}
                                onChange={(e) => setEditForm(prev => ({ ...prev, aantal: parseInt(e.target.value) || undefined }))}
                                className="h-8 w-20"
                              />
                            ) : (
                              part.aantal || '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {editingPart === part.id ? (
                              <Input
                                value={editForm.wand_naam || ''}
                                onChange={(e) => setEditForm(prev => ({ ...prev, wand_naam: e.target.value }))}
                                className="h-8"
                              />
                            ) : (
                              part.wand_naam || '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {editingPart === part.id ? (
                              <Input
                                value={editForm.cnc_pos || ''}
                                onChange={(e) => setEditForm(prev => ({ ...prev, cnc_pos: e.target.value }))}
                                className="h-8"
                              />
                            ) : (
                              part.cnc_pos || '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {editingPart === part.id ? (
                              <Input
                                value={editForm.commentaar || ''}
                                onChange={(e) => setEditForm(prev => ({ ...prev, commentaar: e.target.value }))}
                                className="h-8"
                              />
                            ) : (
                              <div className="max-w-32 truncate" title={part.commentaar || part.commentaar_2 || ''}>
                                {part.commentaar || part.commentaar_2 || '-'}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {editingPart === part.id ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => saveEdit(part.id)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={cancelEdit}
                                    className="h-8 w-8 p-0"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => startEditing(part)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => deletePart(part.id)}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
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