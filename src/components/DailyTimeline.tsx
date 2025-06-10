
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, addDays, subDays, startOfDay, endOfDay, isToday, isSameDay } from 'date-fns';

interface TimelineTask {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  description?: string;
  project_name?: string;
  status?: string;
}

interface DailyTimelineProps {
  tasks: TimelineTask[];
}

const DailyTimeline: React.FC<DailyTimelineProps> = ({ tasks }) => {
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

  // Generate time slots for the day (6 AM to 10 PM)
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 6; hour <= 22; hour++) {
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
      top: `${startPosition * 4}rem`, // 4rem per hour
      height: `${Math.max(duration * 4, 1)}rem`, // minimum 1rem height
    };
  };

  // Get current time indicator position
  const getCurrentTimePosition = () => {
    if (!isToday(selectedDate)) return null;
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    if (currentHour < 6 || currentHour > 22) return null;
    
    const position = ((currentHour - 6) * 60 + currentMinute) / 60;
    return `${position * 4}rem`;
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
                <div key={slot.hour} className="h-16 flex items-start text-sm text-muted-foreground">
                  {slot.displayTime}
                </div>
              ))}
            </div>
            
            {/* Timeline area */}
            <div className="relative border-l border-gray-200 min-h-[64rem]">
              {/* Hour lines */}
              {timeSlots.map((slot, index) => (
                <div
                  key={slot.hour}
                  className="absolute w-full border-t border-gray-100"
                  style={{ top: `${index * 4}rem` }}
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
                return (
                  <div
                    key={task.id}
                    className="absolute left-2 right-2 z-10"
                    style={style}
                  >
                    <Card className="h-full shadow-sm border-l-4 border-l-blue-500">
                      <CardContent className="p-3 h-full flex flex-col">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-medium text-sm truncate flex-1">
                            {task.title}
                          </h4>
                          {task.status && (
                            <Badge className={`text-xs ${getStatusColor(task.status)}`}>
                              {task.status}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(task.start_time), 'HH:mm')} - 
                          {format(new Date(task.end_time), 'HH:mm')}
                        </div>
                        
                        {task.project_name && (
                          <div className="text-xs text-muted-foreground mb-1">
                            Project: {task.project_name}
                          </div>
                        )}
                        
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
                            {task.description}
                          </p>
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
