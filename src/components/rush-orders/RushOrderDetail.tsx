import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { rushOrderService } from '@/services/rushOrderService';
import { standardTasksService } from '@/services/standardTasksService';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { RushOrder } from '@/types/rushOrder';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { Check, Clock, UserCheck, ListChecks, File as FileIcon, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import RushOrderChat from './RushOrderChat';
import { useLanguage } from '@/context/LanguageContext';
import { ImageModal } from '@/components/ui/image-modal';
import { useAuth } from '@/context/AuthContext';

interface RushOrderDetailProps {
  rushOrderId: string;
  onStatusChange?: () => void;
}

const RushOrderDetail: React.FC<RushOrderDetailProps> = ({ rushOrderId, onStatusChange }) => {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [isStartingTimeRegistration, setIsStartingTimeRegistration] = useState(false);
  const { t } = useLanguage();
  const { currentEmployee } = useAuth();
  
  const { data: rushOrder, isLoading, error, refetch } = useQuery({
    queryKey: ['rushOrder', rushOrderId],
    queryFn: () => rushOrderService.getRushOrderById(rushOrderId),
  });
  
  // Query for getting standard task details for each task
  const { data: standardTasks } = useQuery({
    queryKey: ['standardTasks'],
    queryFn: standardTasksService.getAll,
    enabled: !!rushOrder?.tasks,
  });
  
  // Query for getting employee details for each assignment
  const { data: assignedEmployees } = useQuery({
    queryKey: ['assignedEmployees', rushOrderId],
    queryFn: async () => {
      if (!rushOrder?.assignments) return [];
      
      const employeeIds = rushOrder.assignments.map(a => a.employee_id);
      
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, role')
        .in('id', employeeIds);
        
      if (error) throw error;
      return data;
    },
    enabled: !!rushOrder?.assignments && rushOrder.assignments.length > 0,
  });

  // Query for project details if project_id exists
  const { data: projectData } = useQuery({
    queryKey: ['project', rushOrder?.project_id],
    queryFn: async () => {
      if (!rushOrder?.project_id) return null;
      
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, client')
        .eq('id', rushOrder.project_id)
        .single();
        
      if (error) throw error;
      return data;
    },
    enabled: !!rushOrder?.project_id,
  });
  
  const isImage = (url: string | undefined): boolean => {
    if (!url) return false;
    return /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(url);
  };
  
  const handleStatusUpdate = async (newStatus: "pending" | "in_progress" | "completed") => {
    try {
      setIsUpdating(true);
      const success = await rushOrderService.updateRushOrderStatus(rushOrderId, newStatus);
      
      if (success) {
        toast({
          title: t('status_updated'),
          description: t('status_updated_description', { status: t(`status_${newStatus}`) }),
        });
        
        refetch();
        if (onStatusChange) onStatusChange();
      } else {
        throw new Error("Failed to update status");
      }
    } catch (error: any) {
      toast({
        title: t('status_update_error'),
        description: t('status_update_error_description', { error: error.message }),
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleStartTimeRegistration = async () => {
    if (!currentEmployee || !rushOrder) return;
    
    try {
      setIsStartingTimeRegistration(true);
      
      const projectName = projectData ? `${projectData.name} - ${projectData.client}` : undefined;
      
      await timeRegistrationService.startRushOrderTask(
        currentEmployee.id,
        rushOrder.id,
        projectName,
        rushOrder.project_id
      );
      
      toast({
        title: t('time_registration_started'),
        description: t('time_registration_started_description', { 
          title: rushOrder.title,
          project: projectName || t('no_project')
        }),
      });
    } catch (error: any) {
      toast({
        title: t('time_registration_error'),
        description: t('time_registration_error_description', { error: error.message }),
        variant: "destructive"
      });
    } finally {
      setIsStartingTimeRegistration(false);
    }
  };

  const getTaskName = (taskId: string) => {
    const task = standardTasks?.find(t => t.id === taskId);
    return task ? `${task.task_name} (Task #${task.task_number})` : t('unknown_task');
  };
  
  const getEmployeeName = (employeeId: string) => {
    const employee = assignedEmployees?.find(e => e.id === employeeId);
    return employee ? `${employee.name} (${employee.role})` : t('unknown_employee');
  };
  
  if (isLoading) {
    return <div className="text-center py-8">{t('loading_rush_order_details')}</div>;
  }
  
  if (error || !rushOrder) {
    return (
      <Card className="bg-red-50 border-red-200">
        <CardHeader>
          <CardTitle>{t('error_loading_rush_order')}</CardTitle>
          <CardDescription>{t('error_loading_rush_order_description')}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button onClick={() => refetch()}>{t('try_again')}</Button>
        </CardFooter>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div>
              <CardTitle className="text-xl">{rushOrder.title}</CardTitle>
              <CardDescription>
                {t('created_at_label')}: {format(parseISO(rushOrder.created_at), 'MMM d, yyyy HH:mm')}
              </CardDescription>
            </div>
            <Badge className={`
              ${rushOrder.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                rushOrder.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 
                'bg-green-100 text-green-800'} 
              px-3 py-1 text-sm capitalize
            `}>
              {t(`status_${rushOrder.status}`)}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">{t('description_label')}</h3>
              <p className="text-gray-800 whitespace-pre-wrap">{rushOrder.description}</p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">{t('deadline_label')}</h3>
              <div className="flex items-center">
                <Clock className="h-4 w-4 text-red-500 mr-2" />
                <p className="text-red-600 font-medium">
                  {format(parseISO(rushOrder.deadline), 'MMMM d, yyyy HH:mm')}
                </p>
              </div>
            </div>
          </div>
          
          {rushOrder.image_url && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">{t('attachment_label')}</h3>
              <div className="overflow-hidden rounded-lg border">
                {isImage(rushOrder.image_url) ? (
                  <img 
                    src={rushOrder.image_url} 
                    alt={rushOrder.title} 
                    className="w-full h-auto max-h-96 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setShowImageModal(true)}
                  />
                ) : (
                  <a 
                    href={rushOrder.image_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <FileIcon className="h-10 w-10 text-gray-500 flex-shrink-0" />
                      <div className="flex-grow overflow-hidden">
                        <p className="font-medium truncate">{decodeURIComponent(rushOrder.image_url.split('/').pop() ?? 'Document')}</p>
                        <span className="text-sm text-blue-600 hover:underline">
                          {t('view_document')}
                        </span>
                      </div>
                    </div>
                  </a>
                )}
              </div>
            </div>
          )}

          {rushOrder.project_id && projectData && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">{t('project_label')}</h3>
              <div className="flex items-center">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  {projectData.name} - {projectData.client}
                </Badge>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center mb-2">
                <ListChecks className="h-5 w-5 text-blue-500 mr-2" />
                <h3 className="text-md font-medium">{t('required_tasks_label')}</h3>
              </div>
              
              {(!rushOrder.tasks || rushOrder.tasks.length === 0) ? (
                <p className="text-gray-500 text-sm">{t('no_tasks_assigned')}</p>
              ) : (
                <ul className="space-y-2">
                  {rushOrder.tasks.map((task) => (
                    <li key={task.id} className="flex items-center bg-gray-50 p-3 rounded-md">
                      <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-sm">{getTaskName(task.standard_task_id)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            <div>
              <div className="flex items-center mb-2">
                <UserCheck className="h-5 w-5 text-indigo-500 mr-2" />
                <h3 className="text-md font-medium">{t('assigned_team_members_label')}</h3>
              </div>
              
              {(!rushOrder.assignments || rushOrder.assignments.length === 0) ? (
                <p className="text-gray-500 text-sm">{t('no_team_members_assigned')}</p>
              ) : (
                <ul className="space-y-2">
                  {rushOrder.assignments.map((assignment) => (
                    <li key={assignment.id} className="flex items-center bg-gray-50 p-3 rounded-md">
                      <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-medium mr-3 flex-shrink-0">
                        {getEmployeeName(assignment.employee_id).charAt(0)}
                      </div>
                      <span className="text-sm">{getEmployeeName(assignment.employee_id)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between flex-wrap gap-3">
          <Badge variant="outline" className={`
            ${rushOrder.priority === 'critical' ? 'bg-red-100 text-red-800 border-red-300' : 'bg-orange-100 text-orange-800 border-orange-300'}
            px-3 py-1
          `}>
            {rushOrder.priority.toUpperCase()} {t('priority_label')}
          </Badge>
          
          <div className="flex gap-3">
            <Button 
              variant="outline"
              onClick={handleStartTimeRegistration}
              disabled={isStartingTimeRegistration || !currentEmployee}
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
            >
              <Play className="h-4 w-4 mr-2" />
              {isStartingTimeRegistration ? t('starting') : t('start_time_registration')}
            </Button>
            
            {rushOrder.status === 'pending' && (
              <Button 
                variant="secondary"
                onClick={() => handleStatusUpdate('in_progress')}
                disabled={isUpdating}
              >
                {t('mark_as_in_progress')}
              </Button>
            )}
            
            {(rushOrder.status === 'pending' || rushOrder.status === 'in_progress') && (
              <Button 
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleStatusUpdate('completed')}
                disabled={isUpdating}
              >
                {t('mark_as_completed')}
              </Button>
            )}
            
            {rushOrder.status === 'completed' && (
              <Button 
                variant="outline"
                onClick={() => handleStatusUpdate('in_progress')}
                disabled={isUpdating}
              >
                {t('reopen')}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
      
      {/* Rush Order Chat */}
      <RushOrderChat rushOrderId={rushOrderId} />
      
      {/* Fullscreen Image Modal */}
      {rushOrder.image_url && isImage(rushOrder.image_url) && (
        <ImageModal
          src={rushOrder.image_url}
          alt={rushOrder.title}
          isOpen={showImageModal}
          onClose={() => setShowImageModal(false)}
        />
      )}
    </div>
  );
};

export default RushOrderDetail;
