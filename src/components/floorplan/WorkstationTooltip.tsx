import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { WorkstationStatus } from '@/services/floorplanService';

interface WorkstationTooltipProps {
  workstation: any;
  status?: WorkstationStatus;
  children: React.ReactNode;
}

export const WorkstationTooltip: React.FC<WorkstationTooltipProps> = ({
  workstation,
  status,
  children
}) => {
  const getStatusText = () => {
    if (!status) return 'No Status';
    if (status.has_error) return 'Error Status';
    if (status.is_active) return `Active (${status.active_users_count} users)`;
    return 'Not in Use';
  };

  const getStatusColor = () => {
    if (!status) return 'bg-orange-500';
    if (status.has_error) return 'bg-red-500';
    if (status.is_active) return 'bg-green-500';
    return 'bg-orange-500';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent className="max-w-sm p-4">
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold text-sm">{workstation.name}</h4>
              {workstation.description && (
                <p className="text-xs text-muted-foreground mt-1">{workstation.description}</p>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
              <span className="text-xs">{getStatusText()}</span>
            </div>

            {status?.active_user_names && status.active_user_names.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">Active Users:</p>
                <div className="flex flex-wrap gap-1">
                  {status.active_user_names.map((name, index) => (
                    <Badge key={index} variant="secondary" className="text-xs py-0">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {status?.active_tasks && status.active_tasks.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">Active Tasks:</p>
                <div className="space-y-1">
                  {status.active_tasks.map((task, index) => (
                    <div key={index} className="text-xs">
                      <span className="font-medium">{task.task_title}</span>
                      {task.project_name && (
                        <span className="text-muted-foreground"> ({task.project_name})</span>
                      )}
                      <br />
                      <span className="text-muted-foreground">by {task.employee_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {status?.workstation_tasks && status.workstation_tasks.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">Workstation Tasks:</p>
                <div className="space-y-1">
                  {status.workstation_tasks.map((task, index) => (
                    <div key={index} className="text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{task.task_name}</span>
                        <Badge variant="outline" className="text-xs py-0">
                          {task.priority}
                        </Badge>
                      </div>
                      {task.description && (
                        <p className="text-muted-foreground mt-1">{task.description}</p>
                      )}
                      {task.duration && (
                        <p className="text-muted-foreground">Duration: {task.duration} min</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {status?.current_projects && status.current_projects.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">Current Projects:</p>
                <div className="space-y-1">
                  {status.current_projects.map((project, index) => (
                    <div key={index} className="text-xs">
                      <span className="font-medium">{project.project_name}</span>
                      <span className="text-muted-foreground"> ({project.task_count} tasks)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};