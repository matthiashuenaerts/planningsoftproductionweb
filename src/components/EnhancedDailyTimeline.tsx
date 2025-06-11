
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  User, 
  Calendar, 
  Play, 
  Square, 
  CheckCircle, 
  FileText, 
  Package2, 
  QrCode, 
  ExternalLink 
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface EnhancedTimelineTask {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  description: string;
  status: string;
  projectName: string;
  projectId?: string;
  taskId?: string;
  priority?: string;
  workstation?: string;
  isActive?: boolean;
  canStart?: boolean;
  canComplete?: boolean;
}

interface EnhancedDailyTimelineProps {
  tasks: EnhancedTimelineTask[];
  onTaskAction?: (taskId: string, action: string) => void;
  onShowFiles?: (projectId: string) => void;
  onShowParts?: (projectId: string) => void;
  onShowBarcode?: (projectId: string) => void;
}

const EnhancedDailyTimeline: React.FC<EnhancedDailyTimelineProps> = ({
  tasks,
  onTaskAction,
  onShowFiles,
  onShowParts,
  onShowBarcode
}) => {
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'scheduled': { color: 'bg-blue-100 text-blue-800 border-blue-300', label: 'Scheduled' },
      'in_progress': { color: 'bg-amber-100 text-amber-800 border-amber-300', label: 'In Progress' },
      'completed': { color: 'bg-green-100 text-green-800 border-green-300', label: 'Completed' },
      'hold': { color: 'bg-red-100 text-red-800 border-red-300', label: 'On Hold' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['scheduled'];
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return <Badge className="bg-red-100 text-red-800 border-red-300">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Medium</Badge>;
      case 'low':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Low</Badge>;
      default:
        return <Badge>{priority || 'Medium'}</Badge>;
    }
  };

  const formatTime = (timeString: string) => {
    try {
      return format(parseISO(timeString), 'HH:mm');
    } catch {
      return timeString;
    }
  };

  const formatDate = (timeString: string) => {
    try {
      return format(parseISO(timeString), 'MMM dd, yyyy');
    } catch {
      return timeString;
    }
  };

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">No scheduled tasks for today.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Daily Timeline</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {tasks.map((task) => (
          <Card key={task.id} className="h-fit">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-1">{task.projectName}</CardTitle>
                  <CardDescription className="text-base font-medium">
                    {task.title}
                  </CardDescription>
                </div>
                {task.isActive && (
                  <div className="flex items-center gap-1 text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium">Active</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{formatTime(task.start_time)} - {formatTime(task.end_time)}</span>
                <Calendar className="h-4 w-4 ml-2" />
                <span>{formatDate(task.start_time)}</span>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {getStatusBadge(task.status)}
                {task.priority && getPriorityBadge(task.priority)}
              </div>

              {task.workstation && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Workstation: {task.workstation}</span>
                </div>
              )}

              {task.description && (
                <p className="text-sm text-muted-foreground">{task.description}</p>
              )}

              {/* Action Buttons */}
              {task.projectId && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onShowFiles?.(task.projectId!)}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Files
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onShowParts?.(task.projectId!)}
                  >
                    <Package2 className="h-4 w-4 mr-1" />
                    Parts
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onShowBarcode?.(task.projectId!)}
                  >
                    <QrCode className="h-4 w-4 mr-1" />
                    Barcode
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/projects/${task.projectId}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Project
                  </Button>
                </div>
              )}

              {/* Task Control Buttons */}
              {task.taskId && onTaskAction && (
                <div className="flex gap-2 pt-2 border-t">
                  {task.canStart && (
                    <Button
                      size="sm"
                      onClick={() => onTaskAction(task.taskId!, 'IN_PROGRESS')}
                      className="flex-1"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Start
                    </Button>
                  )}
                  
                  {task.isActive && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onTaskAction(task.taskId!, 'TODO')}
                      className="flex-1"
                    >
                      <Square className="h-4 w-4 mr-1" />
                      Pause
                    </Button>
                  )}
                  
                  {task.canComplete && (
                    <Button
                      size="sm"
                      onClick={() => onTaskAction(task.taskId!, 'COMPLETED')}
                      className="flex-1"
                      variant="default"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Complete
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default EnhancedDailyTimeline;
