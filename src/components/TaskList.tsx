import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, User, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { Task } from '@/services/dataService';
import { useLanguage } from '@/context/LanguageContext';

interface TaskWithTimeData extends Task {
  timeRemaining?: string;
  isOvertime?: boolean;
  assignee_name?: string;
  actual_duration_minutes?: number;
  efficiency_percentage?: number;
}

interface TaskListProps {
  tasks: TaskWithTimeData[];
  title: string;
  onTaskStatusChange?: (taskId: string, newStatus: Task['status']) => void;
  showCompleteButton?: boolean;
  showEfficiencyData?: boolean;
  compact?: boolean;
}

const TaskList: React.FC<TaskListProps> = ({ 
  tasks, 
  title, 
  onTaskStatusChange, 
  showCompleteButton = false,
  showEfficiencyData = false,
  compact = false
}) => {
  const { t } = useLanguage();

  const formatDuration = (minutes?: number | null) => {
    if (!minutes) return '0min';
    if (minutes < 60) return `${minutes}min`;
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) return `${hours}h`;
    return `${hours}h ${remainingMinutes}min`;
  };

  const getStatusColor = (status: string) => {
    const validStatuses = ['TODO', 'IN_PROGRESS', 'COMPLETED', 'HOLD'];
    if (!validStatuses.includes(status)) {
      return 'bg-gray-100 text-gray-800';
    }
    
    switch (status) {
      case 'TODO':
        return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'HOLD':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'low':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className={compact ? "text-sm" : "text-lg"}>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">{t('no_tasks_found')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className={compact ? "text-sm" : "text-lg"}>{title}</CardTitle>
      </CardHeader>
      <CardContent className={compact ? "space-y-2" : "space-y-4"}>
        {tasks.map((task) => (
          <div key={task.id} className={`border rounded-lg ${compact ? "p-2" : "p-4"} ${compact ? "space-y-1" : "space-y-3"}`}>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h4 className={`font-medium ${compact ? "text-sm" : ""}`}>{task.title}</h4>
                {task.description && !compact && (
                  <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                )}
              </div>
              <div className="flex gap-2 ml-4">
                <Badge className={`${getPriorityColor(task.priority)} ${compact ? "text-xs px-1 py-0" : ""}`}>
                  {task.priority}
                </Badge>
                <Badge className={`${getStatusColor(task.status)} ${compact ? "text-xs px-1 py-0" : ""}`}>
                  {task.status}
                </Badge>
              </div>
            </div>

            <div className={`grid grid-cols-1 ${compact ? "md:grid-cols-2" : "md:grid-cols-3"} gap-4 text-sm`}>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{task.workstation}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{new Date(task.due_date).toLocaleDateString()}</span>
              </div>
              {!compact && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{t('duration')}: {formatDuration(task.total_duration || task.duration)}</span>
                </div>
              )}
            </div>

            {showEfficiencyData && task.status === 'COMPLETED' && !compact && (
              <div className="bg-gray-50 p-3 rounded space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">
                    Actual: {formatDuration(task.actual_duration_minutes)}
                    {task.total_duration && ` / Planned: ${formatDuration(task.total_duration)}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {task.efficiency_percentage !== null && task.efficiency_percentage !== undefined && (
                    <>
                      {task.efficiency_percentage >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                      <span className={`font-medium ${task.efficiency_percentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {task.efficiency_percentage >= 0 ? '+' : ''}{task.efficiency_percentage}% efficiency
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            {onTaskStatusChange && !compact && (
              <div className="flex gap-2 pt-2">
                {task.status === 'TODO' && (
                  <Button
                    size="sm"
                    onClick={() => onTaskStatusChange(task.id, 'IN_PROGRESS')}
                  >
                    {t('start_task')}
                  </Button>
                )}
                {task.status === 'IN_PROGRESS' && (
                  <>
                    {showCompleteButton && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onTaskStatusChange(task.id, 'COMPLETED')}
                      >
                        {t('complete')}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onTaskStatusChange(task.id, 'TODO')}
                    >
                      {t('pause')}
                    </Button>
                  </>
                )}
                {task.status === 'HOLD' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onTaskStatusChange(task.id, 'TODO')}
                  >
                    {t('resume')}
                  </Button>
                )}
                {task.status !== 'COMPLETED' && (
                  <Select
                    value={task.status}
                    onValueChange={(value) => onTaskStatusChange(task.id, value as Task['status'])}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODO">{t('todo')}</SelectItem>
                      <SelectItem value="IN_PROGRESS">{t('in_progress')}</SelectItem>
                      <SelectItem value="COMPLETED">{t('completed')}</SelectItem>
                      <SelectItem value="HOLD">{t('on_hold')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default TaskList;
