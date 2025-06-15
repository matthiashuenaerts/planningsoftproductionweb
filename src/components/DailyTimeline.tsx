import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Calendar, ChevronLeft, ChevronRight, FileText, Package2, QrCode, ExternalLink, Play, CheckCircle } from 'lucide-react';
import { format, addDays, subDays, startOfDay, endOfDay, isToday, isSameDay } from 'date-fns';

interface TimelineTask {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  description?: string;
  project_name?: string;
  status?: string;
  workstation?: string;
  priority?: string;
  canStart?: boolean;
  canComplete?: boolean;
  isActive?: boolean;
}

interface DailyTimelineProps {
  tasks: TimelineTask[];
  onShowFiles?: (projectId: string) => void;
  onShowParts?: (projectId: string) => void;
  onShowBarcode?: (projectId: string) => void;
  onStartTask?: (taskId: string) => void;
  onCompleteTask?: (taskId: string) => void;
}

const DailyTimeline: React.FC<DailyTimelineProps> = ({ 
  tasks, 
  onShowFiles, 
  onShowParts, 
  onShowBarcode, 
  onStartTask, 
  onCompleteTask 
}) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Filter tasks for selected date
  const dayTasks = tasks.filter(task => {
    const taskDate = new Date(task.start_time);
    return isSameDay(taskDate, selectedDate);
  });

  // Sort tasks by start time
  const sortedTasks = dayTasks.sort((a, b) => 
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  // Generate time slots for the day (6 AM to 6 PM)
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 6; hour < 18; hour++) {
      slots.push({
        hour,
        time: `${hour.toString().padStart(2, '0')}:00`,
        displayTime: format(new Date().setHours(hour, 0, 0, 0), 'HH:mm')
      });
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Get task position and height
  const getTaskStyle = (task: TimelineTask) => {
    const startTime = new Date(task.start_time);
    const endTime = new Date(task.end_time);
    
    const startHour = startTime.getHours();
    const startMinute = startTime.getMinutes();
    const endHour = endTime.getHours();
    const endMinute = endTime.getMinutes();
    
    // Calculate position from 6 AM (hour 6)
    const startPosition = ((startHour - 6) * 60 + startMinute) / 60;
    const duration = ((endHour - startHour) * 60 + (endMinute - startMinute)) / 60;
    
    return {
      top: `${startPosition * 6}rem`, // 6rem per hour
      height: `${Math.max(duration * 6, 1.5)}rem`, // minimum 1.5rem height
    };
  };

  // Get current time indicator position
  const getCurrentTimePosition = () => {
    if (!isToday(selectedDate)) return null;
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    if (currentHour < 6 || currentHour >= 18) return null;
    
    const position = ((currentHour - 6) * 60 + currentMinute) / 60;
    return `${position * 6}rem`;
  };

  const currentTimePosition = getCurrentTimePosition();

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'todo':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getPriorityBadge = (priority?: string) => {
    if (!priority) return null;
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
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Daily Timeline
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(subDays(selectedDate, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium min-w-[120px] text-center">
              {format(selectedDate, 'MMM dd, yyyy')}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(new Date())}
            >
              Today
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Time grid */}
          <div className="grid grid-cols-[80px_1fr] gap-4">
            {/* Time labels */}
            <div className="space-y-0">
              {timeSlots.map(slot => (
                <div key={slot.hour} className="h-24 flex items-start text-sm text-muted-foreground pt-1">
                  {slot.displayTime}
                </div>
              ))}
            </div>
            
            {/* Timeline area */}
            <div className="relative border-l border-gray-200 min-h-[72rem]">
              {/* Hour lines */}
              {timeSlots.map((slot, index) => (
                <div
                  key={slot.hour}
                  className="absolute w-full border-t border-gray-100"
                  style={{ top: `${index * 6}rem` }}
                />
              ))}
              
              {/* Current time indicator */}
              {currentTimePosition && (
                <div
                  className="absolute w-full z-20 border-t-2 border-red-500"
                  style={{ top: currentTimePosition }}
                >
                  <div className="absolute -left-1 -top-1 w-2 h-2 bg-red-500 rounded-full" />
                  <div className="absolute left-2 -top-2 text-xs text-red-500 font-medium">
                    {format(currentTime, 'HH:mm')}
                  </div>
                </div>
              )}
              
              {/* Tasks */}
              {sortedTasks.map(task => {
                const style = getTaskStyle(task);
                const blockHeight = parseFloat(style.height); // height in rem

                return (
                  <div
                    key={task.id}
                    className="absolute left-2 right-2 z-10"
                    style={style}
                  >
                    <Card className="h-full shadow-sm border-l-4 border-l-blue-500 overflow-hidden">
                      <CardContent className={`p-2 h-full flex ${blockHeight <= 3.75 ? 'flex-row items-center justify-start gap-2' : 'flex-col justify-between'}`}>
                        {blockHeight <= 3.75 ? (
                          // Compact view
                          <>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-sm truncate" title={task.project_name || task.title}>
                                {task.project_name || task.title}
                              </h3>
                              {task.project_name && (
                                <h4 className="font-medium text-xs truncate text-muted-foreground" title={task.title}>
                                  {task.title}
                                </h4>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                              <Clock className="h-3 w-3" />
                              {format(new Date(task.start_time), 'HH:mm')} - 
                              {format(new Date(task.end_time), 'HH:mm')}
                            </div>
                            {task.status && (
                              <Badge className={`text-xs whitespace-nowrap shrink-0 ${getStatusColor(task.status)}`}>
                                {task.status}
                              </Badge>
                            )}
                          </>
                        ) : (
                          // Full view
                          <>
                            <div className="flex-grow overflow-y-auto pr-1"> {/* Main content area */}
                              <div className="flex justify-between items-start mb-1">
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-medium text-sm truncate" title={task.project_name || task.title}>
                                    {task.project_name || task.title}
                                  </h3>
                                  {task.project_name && (
                                    <h4 className="font-medium text-xs truncate text-muted-foreground" title={task.title}>
                                      {task.title}
                                    </h4>
                                  )}
                                </div>
                                {task.status && (
                                  <Badge className={`text-xs whitespace-nowrap ${getStatusColor(task.status)}`}>
                                    {task.status}
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(task.start_time), 'HH:mm')} - 
                                {format(new Date(task.end_time), 'HH:mm')}
                              </div>
                              
                              {task.workstation && (
                                <div className="text-xs text-muted-foreground mb-1">
                                  Workstation: {task.workstation}
                                </div>
                              )}

                              {task.priority && (
                                <div className="mb-1">
                                  {getPriorityBadge(task.priority)}
                                </div>
                              )}
                              
                              {blockHeight > 5.25 && task.description && (
                                <p className="text-xs text-muted-foreground">
                                  {task.description}
                                </p>
                              )}

                              {/* Action Buttons */}
                              {blockHeight > 6.75 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {onShowFiles && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => onShowFiles(task.id)}
                                      className="text-xs px-2 py-1 h-6"
                                    >
                                      <FileText className="h-3 w-3 mr-1" />
                                      Files
                                    </Button>
                                  )}
                                  
                                  {onShowParts && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => onShowParts(task.id)}
                                      className="text-xs px-2 py-1 h-6"
                                    >
                                      <Package2 className="h-3 w-3 mr-1" />
                                      Parts
                                    </Button>
                                  )}
                                  
                                  {onShowBarcode && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => onShowBarcode(task.id)}
                                      className="text-xs px-2 py-1 h-6"
                                    >
                                      <QrCode className="h-3 w-3 mr-1" />
                                      Barcode
                                    </Button>
                                  )}
                                  
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(`/projects/${task.id}`, '_blank')}
                                    className="text-xs px-2 py-1 h-6"
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    Project
                                  </Button>
                                </div>
                              )}
                            </div>

                            {/* Task Control Buttons */}
                            {(task.canStart && onStartTask || task.canComplete && onCompleteTask) && (
                              <div className="flex-shrink-0 flex gap-1 pt-2 mt-1 border-t">
                                {task.canStart && onStartTask && (
                                  <Button
                                    size="sm"
                                    onClick={() => onStartTask(task.id)}
                                    className="flex-1 text-xs px-2 py-1 h-6"
                                  >
                                    <Play className="h-3 w-3 mr-1" />
                                    Start
                                  </Button>
                                )}
                                
                                {task.canComplete && onCompleteTask && (
                                  <Button
                                    size="sm"
                                    onClick={() => onCompleteTask(task.id)}
                                    className="flex-1 text-xs px-2 py-1 h-6"
                                    variant="default"
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Complete
                                  </Button>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
              
              {/* No tasks message */}
              {sortedTasks.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No tasks scheduled for this day</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DailyTimeline;
