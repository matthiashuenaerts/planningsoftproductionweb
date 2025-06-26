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
  ShoppingCart,
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
  project_name: string;
  workstation: string;
  priority: string;
  canComplete: boolean;
  isActive: boolean;
}

interface EnhancedDailyTimelineProps {
  tasks: EnhancedTimelineTask[];
  onStartTask?: (taskId: string) => void;
  onCompleteTask?: (taskId: string) => void;
  onShowFiles?: (projectId: string) => void;
  onShowParts?: (projectId: string) => void;
  onShowBarcode?: (projectId: string) => void;
  onShowOrders?: (projectId: string) => void;
}

const EnhancedDailyTimeline: React.FC<EnhancedDailyTimelineProps> = ({
  tasks,
  onStartTask,
  onCompleteTask,
  onShowFiles,
  onShowParts,
  onShowBarcode,
  onShowOrders
}) => {
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'scheduled': { color: 'bg-blue-100 text-blue-800 border-blue-300', label: 'Scheduled' },
      'in_progress': { color: 'bg-amber-100 text-amber-800 border-amber-300', label: 'In Progress' },
      'completed': { color: 'bg-green-100 text-green-800 border-green-300', label: 'Completed' },
      'todo': { color: 'bg-gray-100 text-gray-800 border-gray-300', label: 'To Do' },
      'hold': { color: 'bg-red-100 text-red-800 border-red-300', label: 'On Hold' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['scheduled'];
    return <Badge className={`${config.color} text-xs font-medium`}>{config.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return <Badge className="bg-red-100 text-red-800 border-red-300 text-xs">Urgent</Badge>;
      case 'high':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-300 text-xs">High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">Medium</Badge>;
      case 'low':
        return <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">Low</Badge>;
      default:
        return <Badge className="text-xs">{priority || 'Medium'}</Badge>;
    }
  };

  const formatTime = (timeString: string) => {
    try {
      return format(parseISO(timeString), 'HH:mm');
    } catch {
      return timeString;
    }
  };

  const calculateDuration = (startTime: string, endTime: string) => {
    try {
      const start = parseISO(startTime);
      const end = parseISO(endTime);
      const diffMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
      
      if (diffMinutes < 60) {
        return `${diffMinutes}min`;
      } else {
        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;
        return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
      }
    } catch {
      return '';
    }
  };

  const truncateTitle = (title: string, maxLength: number = 60) => {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
  };

  const handleStartTask = (taskId: string) => {
    console.log('Starting task:', taskId);
    if (onStartTask) {
      onStartTask(taskId);
    }
  };

  const handlePauseTask = (taskId: string) => {
    console.log('Pausing task:', taskId);
    if (onStartTask) {
      onStartTask(taskId);
    }
  };

  const handleCompleteTask = (taskId: string) => {
    console.log('Completing task:', taskId);
    if (onCompleteTask) {
      onCompleteTask(taskId);
    }
  };

  const handleShowFiles = (taskId: string) => {
    console.log('Show files for task:', taskId);
    if (onShowFiles) {
      onShowFiles(taskId);
    }
  };

  const handleShowParts = (taskId: string) => {
    console.log('Show parts for task:', taskId);
    if (onShowParts) {
      onShowParts(taskId);
    }
  };

  const handleShowBarcode = (taskId: string) => {
    console.log('Show barcode for task:', taskId);
    if (onShowBarcode) {
      onShowBarcode(taskId);
    }
  };

  const handleShowOrders = (taskId: string) => {
    console.log('Show orders for task:', taskId);
    if (onShowOrders) {
      onShowOrders(taskId);
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

  // Sort tasks by start time
  const sortedTasks = [...tasks].sort((a, b) => 
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold mb-4">Daily Timeline</h2>
      
      {/* Timeline container with time markers */}
      <div className="relative">
        {/* Time line */}
        <div className="absolute left-16 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        
        {sortedTasks.map((task, index) => {
          const duration = calculateDuration(task.start_time, task.end_time);
          const isSmallTask = duration && (duration.includes('min') && !duration.includes('h'));
          
          return (
            <div key={task.id} className="relative flex items-start mb-4">
              {/* Time marker */}
              <div className="flex-shrink-0 w-14 text-right pr-4">
                <div className="text-sm font-medium text-gray-600">
                  {formatTime(task.start_time)}
                </div>
                <div className="text-xs text-gray-400">
                  {duration}
                </div>
              </div>
              
              {/* Timeline dot */}
              <div className="relative flex-shrink-0">
                <div className={`w-3 h-3 rounded-full border-2 ${
                  task.isActive 
                    ? 'bg-green-500 border-green-500 animate-pulse' 
                    : task.status === 'completed'
                    ? 'bg-green-500 border-green-500'
                    : task.status === 'in_progress'
                    ? 'bg-amber-500 border-amber-500'
                    : 'bg-white border-gray-300'
                }`}></div>
              </div>
              
              {/* Task card */}
              <div className="flex-1 ml-4">
                <Card className={`transition-all hover:shadow-md ${
                  task.isActive ? 'ring-2 ring-green-500 ring-opacity-50' : ''
                } ${isSmallTask ? 'py-2' : ''}`}>
                  <CardHeader className={`${isSmallTask ? 'py-3 pb-2' : 'pb-3'}`}>
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className={`${isSmallTask ? 'text-base' : 'text-lg'} leading-tight mb-1`}>
                          {truncateTitle(task.title, isSmallTask ? 40 : 60)}
                        </CardTitle>
                        <CardDescription className="text-sm font-medium text-blue-600 mb-2">
                          {task.project_name || 'No Project'}
                        </CardDescription>
                        
                        {/* Time range */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatTime(task.start_time)} - {formatTime(task.end_time)}</span>
                          {task.workstation && (
                            <>
                              <User className="h-3 w-3 ml-2" />
                              <span>{task.workstation}</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Status indicator */}
                      {task.isActive && (
                        <div className="flex items-center gap-1 text-green-600 flex-shrink-0">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-xs font-medium">Active</span>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className={`space-y-3 ${isSmallTask ? 'py-2 pt-0' : 'pt-0'}`}>
                    {/* Badges */}
                    <div className="flex flex-wrap gap-2">
                      {getStatusBadge(task.status)}
                      {task.priority && getPriorityBadge(task.priority)}
                    </div>

                    {/* Description for larger tasks */}
                    {!isSmallTask && task.description && (
                      <p className="text-sm text-muted-foreground">
                        {truncateTitle(task.description, 100)}
                      </p>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                      {/* Quick action buttons */}
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleShowFiles(task.id);
                          }}
                          title="Project Files"
                        >
                          <FileText className="h-3 w-3" />
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleShowOrders(task.id);
                          }}
                          title="Project Orders"
                        >
                          <ShoppingCart className="h-3 w-3" />
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleShowParts(task.id);
                          }}
                          title="Parts List"
                        >
                          <Package2 className="h-3 w-3" />
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleShowBarcode(task.id);
                          }}
                          title="Project Barcode"
                        >
                          <QrCode className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Task control buttons */}
                      <div className="flex gap-1 ml-auto">
                        {(task.status === 'todo' || task.status === 'scheduled') && !task.isActive && (
                          <Button
                            size="sm"
                            className="h-7 px-3 text-xs"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleStartTask(task.id);
                            }}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Start
                          </Button>
                        )}
                        
                        {task.isActive && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-3 text-xs"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handlePauseTask(task.id);
                            }}
                          >
                            <Square className="h-3 w-3 mr-1" />
                            Pause
                          </Button>
                        )}
                        
                        {task.canComplete && (
                          <Button
                            size="sm"
                            className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleCompleteTask(task.id);
                            }}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EnhancedDailyTimeline;
