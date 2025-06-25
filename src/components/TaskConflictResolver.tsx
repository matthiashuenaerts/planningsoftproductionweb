
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, User, Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface TaskConflict {
  taskId: string;
  taskTitle: string;
  taskDescription?: string;
  priority: string;
  duration: number;
  assignedUsers: Array<{
    userId: string;
    userName: string;
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
  onResolve: (resolutions: Record<string, string>) => void;
}

const TaskConflictResolver: React.FC<TaskConflictResolverProps> = ({
  isOpen,
  onClose,
  conflicts,
  onResolve
}) => {
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const [isResolving, setIsResolving] = useState(false);

  const handleUserSelection = (taskId: string, userId: string) => {
    setResolutions(prev => ({
      ...prev,
      [taskId]: userId
    }));
  };

  const handleResolveAll = async () => {
    // Check if all conflicts have been resolved
    const unresolvedConflicts = conflicts.filter(conflict => !resolutions[conflict.taskId]);
    
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

  const allResolved = conflicts.length > 0 && conflicts.every(conflict => resolutions[conflict.taskId]);

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
            The following tasks have been assigned to multiple users. Please select which user should be assigned to each task.
          </p>

          {conflicts.map((conflict) => (
            <Card key={conflict.taskId} className="border-amber-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">{conflict.taskTitle}</CardTitle>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {conflict.assignedUsers.map((user) => (
                    <div key={user.userId} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-2" />
                          <span className="font-medium">{user.userName}</span>
                        </div>
                        {resolutions[conflict.taskId] === user.userId && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {user.scheduleItems.map((item, index) => (
                          <div key={item.id}>
                            Schedule {index + 1}: {format(new Date(item.startTime), 'HH:mm')} - {format(new Date(item.endTime), 'HH:mm')}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Assign this task to:
                  </label>
                  <Select 
                    value={resolutions[conflict.taskId] || ''} 
                    onValueChange={(value) => handleUserSelection(conflict.taskId, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select user to assign this task" />
                    </SelectTrigger>
                    <SelectContent>
                      {conflict.assignedUsers.map((user) => (
                        <SelectItem key={user.userId} value={user.userId}>
                          {user.userName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
