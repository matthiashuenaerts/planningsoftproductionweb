import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { standardTaskChecklistService, type StandardTaskChecklistItem } from '@/services/standardTaskChecklistService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

interface StandardTaskChecklistManagerProps {
  standardTaskId: string;
  standardTaskName: string;
}

export const StandardTaskChecklistManager: React.FC<StandardTaskChecklistManagerProps> = ({
  standardTaskId,
  standardTaskName
}) => {
  const [checklistItems, setChecklistItems] = useState<StandardTaskChecklistItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { currentEmployee } = useAuth();

  // Check if user is admin
  const isAdmin = currentEmployee?.role === 'admin';
  
  useEffect(() => {
    console.log('StandardTaskChecklistManager - Current user:', currentEmployee);
    console.log('StandardTaskChecklistManager - Is admin:', isAdmin);
  }, [currentEmployee, isAdmin]);

  useEffect(() => {
    loadChecklistItems();
  }, [standardTaskId]);

  const loadChecklistItems = async () => {
    try {
      setLoading(true);
      const items = await standardTaskChecklistService.getChecklistItems(standardTaskId);
      setChecklistItems(items);
    } catch (error) {
      console.error('Failed to load checklist items:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to load checklist items: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    console.log('Attempting to add checklist item...');
    console.log('New item text:', newItemText);
    console.log('Current user:', currentEmployee);
    console.log('Is admin:', isAdmin);
    
    if (!newItemText.trim()) {
      toast({
        variant: "destructive",
        title: "Invalid Input",
        description: "Please enter a checklist item description"
      });
      return;
    }
    
    if (!isAdmin) {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: `Only administrators can modify checklist items. Your role: ${currentEmployee?.role || 'unknown'}`
      });
      return;
    }

    try {
      setSaving(true);
      console.log('Creating checklist item for standard task:', standardTaskId);
      const newItem = await standardTaskChecklistService.createChecklistItem(
        standardTaskId,
        newItemText.trim(),
        checklistItems.length
      );
      console.log('Successfully created checklist item:', newItem);
      setChecklistItems(prev => [...prev, newItem]);
      setNewItemText('');
      toast({
        title: "Success",
        description: "Checklist item added successfully"
      });
    } catch (error) {
      console.error('Failed to add checklist item:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to add checklist item: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!isAdmin) {
      toast({
        variant: "destructive",
        title: "Access Denied", 
        description: "Only administrators can modify checklist items"
      });
      return;
    }

    try {
      setSaving(true);
      await standardTaskChecklistService.deleteChecklistItem(itemId);
      setChecklistItems(prev => prev.filter(item => item.id !== itemId));
      toast({
        title: "Success",
        description: "Checklist item deleted successfully"
      });
    } catch (error) {
      console.error('Failed to delete checklist item:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete checklist item"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRequired = async (itemId: string, isRequired: boolean) => {
    if (!isAdmin) {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "Only administrators can modify checklist items"
      });
      return;
    }

    try {
      setSaving(true);
      await standardTaskChecklistService.updateChecklistItem(itemId, { is_required: isRequired });
      setChecklistItems(prev =>
        prev.map(item =>
          item.id === itemId ? { ...item, is_required: isRequired } : item
        )
      );
      toast({
        title: "Success",
        description: "Checklist item updated successfully"
      });
    } catch (error) {
      console.error('Failed to update checklist item:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update checklist item"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateText = async (itemId: string, newText: string) => {
    if (!newText.trim()) return;
    if (!isAdmin) {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: "Only administrators can modify checklist items"
      });
      return;
    }

    try {
      setSaving(true);
      await standardTaskChecklistService.updateChecklistItem(itemId, { item_text: newText });
      setChecklistItems(prev =>
        prev.map(item =>
          item.id === itemId ? { ...item, item_text: newText } : item
        )
      );
      toast({
        title: "Success",
        description: "Checklist item updated successfully"
      });
    } catch (error) {
      console.error('Failed to update checklist item:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update checklist item"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Checklist for {standardTaskName}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Checklist for {standardTaskName}
          <Badge variant="secondary">
            {checklistItems.length} items
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isAdmin ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>You need administrator privileges to manage checklists</p>
          </div>
        ) : (
          <>
            {/* Add new item */}
            <div className="flex gap-2">
              <Input
                placeholder="Enter checklist item..."
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddItem();
                  }
                }}
                disabled={saving}
              />
              <Button 
                onClick={handleAddItem} 
                disabled={!newItemText.trim() || saving}
                size="sm"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Checklist items */}
            {checklistItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No checklist items configured</p>
                <p className="text-sm">Add items above to create a checklist for this task</p>
              </div>
            ) : (
              <div className="space-y-2">
                {checklistItems.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                    
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={item.is_required}
                        onCheckedChange={(checked) =>
                          handleToggleRequired(item.id, checked as boolean)
                        }
                        disabled={saving}
                      />
                      <span className="text-sm text-muted-foreground">Required</span>
                    </div>

                    <Input
                      value={item.item_text}
                      onChange={(e) => {
                        setChecklistItems(prev =>
                          prev.map(prevItem =>
                            prevItem.id === item.id 
                              ? { ...prevItem, item_text: e.target.value }
                              : prevItem
                          )
                        );
                      }}
                      onBlur={(e) => {
                        if (e.target.value !== item.item_text) {
                          handleUpdateText(item.id, e.target.value);
                        }
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdateText(item.id, (e.target as HTMLInputElement).value);
                        }
                      }}
                      disabled={saving}
                      className="flex-1"
                    />

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteItem(item.id)}
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {checklistItems.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <p>• Required items must be completed before the task can be finished</p>
                <p>• Drag items to reorder them</p>
                <p>• Press Enter or click away to save text changes</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};