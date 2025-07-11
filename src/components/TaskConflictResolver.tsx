
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, User, Clock, CheckCircle } from 'lucide-react';
import { format, isValid } from 'date-fns';

interface TaskConflict {
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  projectName?: string;
  priority: string;
  duration: number;
  assignedUsers: Array<{
    userId: string;
    userName: string;
    totalOpenTaskHours: number;
    scheduleItems: Array<{
      id: string;
      startTime: string;
      endTime: string;
    }>;
  }>;
}

interface TaskConflictResolverProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: TaskConflict[];
  onResolve: (resolutions: Record<string, string[]>) => void;
}

const TaskConflictResolver: React.FC<TaskConflictResolverProps> = ({
  isOpen,
  onClose,
  conflicts,
  onResolve
}) => {
  const [resolutions, setResolutions] = useState<Record<string, string[]>>({});
  const [isResolving, setIsResolving] = useState(false);

  const handleUserSelection = (taskId: string, userId: string) => {
    setResolutions(prev => {
      const currentSelections = prev[taskId] || [];
      const isSelected = currentSelections.includes(userId);
      
      if (isSelected) {
        // Remove user from selection
        return {
          ...prev,
          [taskId]: currentSelections.filter(id => id !== userId)
        };
      } else {
        // Add user to selection
        return {
          ...prev,
          [taskId]: [...currentSelections, userId]
        };
      }
    });
  };

  const handleResolveAll = async () => {
    // Check if all conflicts have at least one user selected
    const unresolvedConflicts = conflicts.filter(conflict => 
      !resolutions[conflict.taskId] || resolutions[conflict.taskId].length === 0
    );
    
    if (unresolvedConflicts.length > 0) {
      return;
    }

    setIsResolving(true);
    try {
      await onResolve(resolutions);
      onClose();
    } catch (error) {
      console.error('Error resolving conflicts:', error);
    } finally {
      setIsResolving(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const formatTime = (timeString: string) => {
    try {
      const date = new Date(timeString);
      if (isValid(date)) {
        return format(date, 'HH:mm');
      } else {
        console.warn('Invalid date string:', timeString);
        return 'Invalid time';
      }
    } catch (error) {
      console.error('Error formatting time:', error, timeString);
      return 'Invalid time';
    }
  };

  const allResolved = conflicts.length > 0 && conflicts.every(conflict => 
    resolutions[conflict.taskId] && resolutions[conflict.taskId].length > 0
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
            Task Assignment Conflicts ({conflicts.length})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The following tasks have been assigned to multiple users. Click on user names to select who should keep the task (you can select multiple users).
          </p>

          {conflicts.map((conflict) => (
            <Card key={conflict.taskId} className="border-amber-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">{conflict.taskTitle}</CardTitle>
                {conflict.projectName && (
                  <div className="text-sm text-blue-600 font-medium">
                    Project: {conflict.projectName}
                  </div>
                )}
                {conflict.taskDescription && (
                  <p className="text-sm text-muted-foreground">{conflict.taskDescription}</p>
                )}
                <div className="flex items-center space-x-2">
                  <Badge className={getPriorityColor(conflict.priority)}>
                    {conflict.priority}
                  </Badge>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="h-3 w-3 mr-1" />
                    {conflict.duration} minutes
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium block">
                    Select users to assign this task (click to select/deselect):
                  </label>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {conflict.assignedUsers.map((user) => {
                      const isSelected = resolutions[conflict.taskId]?.includes(user.userId) || false;
                      
                      return (
                        <div 
                          key={user.userId} 
                          className={`border rounded-lg p-3 cursor-pointer transition-all hover:border-primary ${
                            isSelected
                              ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                              : 'border-gray-200'
                          }`}
                          onClick={() => handleUserSelection(conflict.taskId, user.userId)}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <User className="h-4 w-4 mr-2" />
                              <span className="font-medium">{user.userName}</span>
                            </div>
                            {isSelected && (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            )}
                          </div>
                          
                          <div className="space-y-1 text-xs text-muted-foreground mb-2">
                            <div className="flex items-center text-blue-600 font-medium">
                              <Clock className="h-3 w-3 mr-1" />
                              Total open tasks: {user.totalOpenTaskHours.toFixed(1)}h
                            </div>
                            {user.scheduleItems.map((item, index) => (
                              <div key={item.id}>
                                Schedule {index + 1}: {formatTime(item.startTime)} - {formatTime(item.endTime)}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {resolutions[conflict.taskId] && resolutions[conflict.taskId].length > 0 && (
                    <div className="mt-2 p-2 bg-green-50 rounded border-l-4 border-green-400">
                      <p className="text-sm text-green-800">
                        Selected users: {conflict.assignedUsers
                          .filter(user => resolutions[conflict.taskId]?.includes(user.userId))
                          .map(user => user.userName)
                          .join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleResolveAll}
              disabled={!allResolved || isResolving}
            >
              {isResolving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Resolving...
                </>
              ) : (
                `Resolve All Conflicts`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskConflictResolver;
