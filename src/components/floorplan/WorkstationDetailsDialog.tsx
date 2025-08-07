import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Clock, Activity, AlertCircle, FolderOpen, CheckCircle } from 'lucide-react';
import { WorkstationStatus } from '@/services/floorplanService';
import WorkstationRushOrdersDisplay from '@/components/WorkstationRushOrdersDisplay';

interface WorkstationDetailsDialogProps {
  workstation: {
    id: string;
    name: string;
    description?: string;
  } | null;
  status?: WorkstationStatus;
  isOpen: boolean;
  onClose: () => void;
}

export const WorkstationDetailsDialog: React.FC<WorkstationDetailsDialogProps> = ({
  workstation,
  status,
  isOpen,
  onClose
}) => {
  if (!workstation) return null;

  const getStatusInfo = () => {
    if (!status) {
      return {
        color: 'orange',
        text: 'Not in use',
        icon: <Activity className="h-4 w-4 text-orange-500" />
      };
    }
    
    if (status.has_error) {
      return {
        color: 'red',
        text: 'Error',
        icon: <AlertCircle className="h-4 w-4 text-red-500" />
      };
    }
    
    if (status.is_active) {
      return {
        color: 'green',
        text: `In Use (${status.active_users_count} user${status.active_users_count > 1 ? 's' : ''})`,
        icon: <Users className="h-4 w-4 text-green-500" />
      };
    }
    
    return {
      color: 'orange',
      text: 'Available',
      icon: <Activity className="h-4 w-4 text-orange-500" />
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <span>{workstation.name}</span>
            <Badge variant={statusInfo.color === 'green' ? 'default' : 'destructive'} className="ml-2">
              {statusInfo.text}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Workstation Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {workstation.description && (
                <div>
                  <span className="text-sm font-medium">Description:</span>
                  <p className="text-sm text-muted-foreground mt-1">{workstation.description}</p>
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                {statusInfo.icon}
                <span className="text-sm font-medium">Status:</span>
                <span className="text-sm">{statusInfo.text}</span>
              </div>
            </CardContent>
          </Card>

          {/* Active Tasks */}
          {status && status.active_tasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5" />
                  <span>Active Tasks ({status.active_tasks.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {status.active_tasks.map((task, index) => (
                    <div key={index} className="p-3 bg-muted rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{task.task_title}</span>
                        <Badge variant="outline">Active</Badge>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span>Employee: {task.employee_name}</span>
                        </div>
                        {task.project_name && (
                          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                            <FolderOpen className="h-3 w-3" />
                            <span>Project: {task.project_name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Current Projects */}
          {status && status.current_projects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FolderOpen className="h-5 w-5" />
                  <span>Current Projects ({status.current_projects.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {status.current_projects.map((project, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                      <div>
                        <span className="text-sm font-medium">{project.project_name}</span>
                        <div className="text-xs text-muted-foreground">
                          {project.task_count} task{project.task_count > 1 ? 's' : ''} pending
                        </div>
                      </div>
                      <Badge variant="secondary">{project.task_count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rush Orders */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <span>Rush Orders</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WorkstationRushOrdersDisplay workstationId={workstation.id} />
            </CardContent>
          </Card>

          {/* Additional Information */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                <p>• View detailed workstation schedule</p>
                <p>• Check assigned tasks and deadlines</p>
                <p>• Monitor equipment status</p>
                <p>• Review production metrics</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};