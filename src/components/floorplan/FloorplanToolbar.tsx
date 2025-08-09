import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Edit, Plus, Save, X, Palette, Settings, Users, Activity, Files, Package, UserCheck, Truck, ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ProjectFilesPopup from '@/components/ProjectFilesPopup';
import { PartsListDialog } from '@/components/PartsListDialog';
import { ProjectTeamAssignmentsPopup } from '@/components/ProjectTeamAssignmentsPopup';
import { ProjectTruckAssignmentPopup } from '@/components/ProjectTruckAssignmentPopup';
import { OrderPopup } from '@/components/OrderPopup';

interface FloorplanToolbarProps {
  isEditing: boolean;
  onToggleEditing: () => void;
  onAddFlowLine: (line: {
    name: string;
    start_x: number;
    start_y: number;
    end_x: number;
    end_y: number;
    color: string;
    stroke_width: number;
  }) => void;
  totalWorkstations: number;
  activeWorkstations: number;
  totalActiveUsers: number;
  isAdmin: boolean;
  projectId?: string;
  projectName?: string;
}

export const FloorplanToolbar: React.FC<FloorplanToolbarProps> = ({
  isEditing,
  onToggleEditing,
  onAddFlowLine,
  totalWorkstations,
  activeWorkstations,
  totalActiveUsers,
  isAdmin,
  projectId = "default-project",
  projectName = "Default Project"
}) => {
  const [isAddingLine, setIsAddingLine] = useState(false);
  const [newLine, setNewLine] = useState({
    name: '',
    color: '#3B82F6',
    stroke_width: 3
  });
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  
  // Project popups state
  const [isProjectFilesOpen, setIsProjectFilesOpen] = useState(false);
  const [isPartsListOpen, setIsPartsListOpen] = useState(false);
  const [isTeamAssignmentsOpen, setIsTeamAssignmentsOpen] = useState(false);
  const [isTruckAssignmentOpen, setIsTruckAssignmentOpen] = useState(false);
  const [isOrderPopupOpen, setIsOrderPopupOpen] = useState(false);

  const handleAddLine = () => {
    if (newLine.name && startPoint) {
      // This would be called when user clicks end point
      // For now, we'll use default end point
      onAddFlowLine({
        ...newLine,
        start_x: startPoint.x,
        start_y: startPoint.y,
        end_x: startPoint.x + 10,
        end_y: startPoint.y + 10
      });
      
      setNewLine({ name: '', color: '#3B82F6', stroke_width: 3 });
      setStartPoint(null);
      setIsAddingLine(false);
    }
  };

  const flowLineColors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'
  ];

  return (
    <div className="absolute top-4 left-4 z-10 bg-background/95 backdrop-blur rounded-lg shadow-lg p-4 space-y-4">
      {/* Status Overview */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Workstations</span>
          <Badge variant="outline">{totalWorkstations}</Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          <Activity className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium">Active</span>
          <Badge variant="default" className="bg-green-500">{activeWorkstations}</Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          <Users className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">Users</span>
          <Badge variant="default" className="bg-blue-500">{totalActiveUsers}</Badge>
        </div>
      </div>

      {/* Project Actions */}
      <div className="flex items-center space-x-2 pt-2 border-t">
        <Button
          onClick={() => setIsProjectFilesOpen(true)}
          variant="outline"
          size="sm"
          className="flex items-center space-x-2"
        >
          <Files className="h-4 w-4" />
          <span>Files</span>
        </Button>

        <Button
          onClick={() => setIsPartsListOpen(true)}
          variant="outline"
          size="sm"
          className="flex items-center space-x-2"
        >
          <Package className="h-4 w-4" />
          <span>Parts</span>
        </Button>

        <Button
          onClick={() => setIsTeamAssignmentsOpen(true)}
          variant="outline"
          size="sm"
          className="flex items-center space-x-2"
        >
          <UserCheck className="h-4 w-4" />
          <span>Team</span>
        </Button>

        <Button
          onClick={() => setIsTruckAssignmentOpen(true)}
          variant="outline"
          size="sm"
          className="flex items-center space-x-2"
        >
          <Truck className="h-4 w-4" />
          <span>Truck</span>
        </Button>

        <Button
          onClick={() => setIsOrderPopupOpen(true)}
          variant="outline"
          size="sm"
          className="flex items-center space-x-2"
        >
          <ShoppingCart className="h-4 w-4" />
          <span>Orders</span>
        </Button>
      </div>

      {/* Admin Controls */}
      {isAdmin && (
        <div className="flex items-center space-x-2 pt-2 border-t">
          <Button
            onClick={onToggleEditing}
            variant={isEditing ? "default" : "outline"}
            size="sm"
            className="flex items-center space-x-2"
          >
            {isEditing ? <Save className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
            <span>{isEditing ? 'Save Changes' : 'Edit Layout'}</span>
          </Button>

          {isEditing && (
            <Dialog open={isAddingLine} onOpenChange={setIsAddingLine}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Add Flow Line</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Production Flow Line</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="lineName">Line Name</Label>
                    <Input
                      id="lineName"
                      value={newLine.name}
                      onChange={(e) => setNewLine({ ...newLine, name: e.target.value })}
                      placeholder="e.g. Assembly to Packaging"
                    />
                  </div>
                  
                  <div>
                    <Label>Color</Label>
                    <div className="flex space-x-2 mt-2">
                      {flowLineColors.map((color) => (
                        <button
                          key={color}
                          onClick={() => setNewLine({ ...newLine, color })}
                          className={`w-8 h-8 rounded-full border-2 ${
                            newLine.color === color ? 'border-primary' : 'border-gray-300'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="strokeWidth">Line Width</Label>
                    <Input
                      id="strokeWidth"
                      type="number"
                      min="1"
                      max="10"
                      value={newLine.stroke_width}
                      onChange={(e) => setNewLine({ ...newLine, stroke_width: parseInt(e.target.value) })}
                    />
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    After clicking "Create Line", click on the floorplan to set start and end points.
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button 
                      onClick={handleAddLine}
                      disabled={!newLine.name}
                      className="flex-1"
                    >
                      Create Line
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsAddingLine(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}

      {isEditing && (
        <div className="text-xs text-muted-foreground pt-2 border-t">
          <div>• Drag workstation dots to reposition</div>
          <div>• Click flow lines to delete them</div>
          <div>• Click "Save Changes" when done</div>
        </div>
      )}

      {/* Project Popups */}
      <ProjectFilesPopup
        isOpen={isProjectFilesOpen}
        onClose={() => setIsProjectFilesOpen(false)}
        projectId={projectId}
        projectName={projectName}
      />

      <PartsListDialog
        isOpen={isPartsListOpen}
        onClose={() => setIsPartsListOpen(false)}
        projectId={projectId}
        onImportComplete={() => {}}
      />

      <ProjectTeamAssignmentsPopup
        isOpen={isTeamAssignmentsOpen}
        onClose={() => setIsTeamAssignmentsOpen(false)}
        projectId={projectId}
        onTeamAssigned={() => {}}
      />

      <ProjectTruckAssignmentPopup
        isOpen={isTruckAssignmentOpen}
        onClose={() => setIsTruckAssignmentOpen(false)}
        projectId={projectId}
        onTruckAssigned={() => {}}
      />

      <OrderPopup
        isOpen={isOrderPopupOpen}
        onClose={() => setIsOrderPopupOpen(false)}
        projectId={projectId}
        onOrderCreated={() => {}}
      />
    </div>
  );
};