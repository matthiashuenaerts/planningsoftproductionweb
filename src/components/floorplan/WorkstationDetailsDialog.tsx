import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Clock, Activity, AlertCircle } from 'lucide-react';
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
    if (!status || !status.is_active) {
      return {
        color: 'green',
        text: 'Available',
        icon: <Activity className="h-4 w-4 text-green-500" />
      };
    }
    
    return {
      color: 'red',
      text: `In Use (${status.active_users_count} user${status.active_users_count > 1 ? 's' : ''})`,
      icon: <Users className="h-4 w-4 text-red-500" />
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

          {/* Active Users */}
          {status && status.is_active && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Active Users ({status.active_users_count})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {status.active_user_names.map((name, index) => (
                    <div key={index} className="flex items-center space-x-2 p-2 bg-muted rounded-md">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">{name}</span>
                      <Badge variant="outline" className="ml-auto">Active</Badge>
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