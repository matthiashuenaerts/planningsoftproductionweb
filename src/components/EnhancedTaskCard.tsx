import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, User, Calendar, Play, Square, CheckCircle, FileText, Package2, QrCode, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'HOLD';
  priority: string;
  due_date: string;
  assignee_id: string;
  workstation: string;
  phase_id: string;
  duration: number;
  standard_task_id?: string;
  phases: {
    name: string;
    projects: {
      id: string;
      name: string;
      client: string;
    };
  };
}

interface EnhancedTaskCardProps {
  task: Task;
  isActive: boolean;
  canComplete: boolean;
  onStatusChange: (taskId: string, status: Task['status']) => void;
  onShowFiles: (projectId: string) => void;
  onShowParts: (projectId: string) => void;
  onShowBarcode: (projectId: string) => void;
}

const EnhancedTaskCard: React.FC<EnhancedTaskCardProps> = ({
  task,
  isActive,
  canComplete,
  onStatusChange,
  onShowFiles,
  onShowParts,
  onShowBarcode
}) => {
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'TODO': { color: 'bg-blue-100 text-blue-800 border-blue-300', label: 'To Do' },
      'IN_PROGRESS': { color: 'bg-amber-100 text-amber-800 border-amber-300', label: 'In Progress' },
      'COMPLETED': { color: 'bg-green-100 text-green-800 border-green-300', label: 'Completed' },
      'HOLD': { color: 'bg-red-100 text-red-800 border-red-300', label: 'On Hold' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['TODO'];
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return <Badge className="bg-red-100 text-red-800 border-red-300">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Medium</Badge>;
      case 'low':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Low</Badge>;
      default:
        return <Badge>{priority}</Badge>;
    }
  };

  return (
    <Card className={`h-fit transition-all duration-200 ${isActive ? 'ring-2 ring-green-500 bg-green-50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="space-y-2">
          {/* Project Information */}
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base font-semibold text-gray-900 truncate">
                {task.phases.projects.name}
              </CardTitle>
              <p className="text-sm text-gray-600 truncate">
                {task.phases.projects.client}
              </p>
            </div>
            {isActive && (
              <Badge className="bg-green-100 text-green-800 border-green-300 ml-2 whitespace-nowrap">
                Active
              </Badge>
            )}
          </div>
          
          {/* Task Title */}
          <div>
            <h4 className="font-medium text-gray-900 text-sm">
              {task.title}
            </h4>
            <p className="text-xs text-gray-500">
              Phase: {task.phases.name}
            </p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Status and Priority */}
        <div className="flex flex-wrap gap-2">
          {getStatusBadge(task.status)}
          {getPriorityBadge(task.priority)}
        </div>

        {/* Task Details */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <User className="h-3 w-3" />
            <span className="truncate">Workstation: {task.workstation}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Calendar className="h-3 w-3" />
            <span>Due: {format(new Date(task.due_date), 'MMM dd, yyyy')}</span>
          </div>
          {task.duration && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Clock className="h-3 w-3" />
              <span>Duration: {task.duration}h</span>
            </div>
          )}
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-gray-600 line-clamp-2">
            {task.description}
          </p>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          {/* Project Actions */}
          <div className="grid grid-cols-2 gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onShowFiles(task.phases.projects.id)}
              className="text-xs h-8"
            >
              <FileText className="h-3 w-3 mr-1" />
              Files
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onShowParts(task.phases.projects.id)}
              className="text-xs h-8"
            >
              <Package2 className="h-3 w-3 mr-1" />
              Parts
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onShowBarcode(task.phases.projects.id)}
              className="text-xs h-8"
            >
              <QrCode className="h-3 w-3 mr-1" />
              Barcode
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/projects/${task.phases.projects.id}`, '_blank')}
              className="text-xs h-8"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Project
            </Button>
          </div>

          {/* Task Control Buttons */}
          <div className="flex gap-1">
            {task.status !== 'IN_PROGRESS' && task.status !== 'COMPLETED' && !isActive && (
              <Button
                size="sm"
                onClick={() => onStatusChange(task.id, 'IN_PROGRESS')}
                className="flex-1 h-8 text-xs"
              >
                <Play className="h-3 w-3 mr-1" />
                Start
              </Button>
            )}
            
            {isActive && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onStatusChange(task.id, 'TODO')}
                className="flex-1 h-8 text-xs"
              >
                <Square className="h-3 w-3 mr-1" />
                Pause
              </Button>
            )}
            
            {canComplete && (
              <Button
                size="sm"
                onClick={() => onStatusChange(task.id, 'COMPLETED')}
                className="flex-1 h-8 text-xs"
                variant="default"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Complete
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedTaskCard;
