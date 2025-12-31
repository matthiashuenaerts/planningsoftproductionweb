import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { holidayRequestService, HolidayRequest } from '@/services/holidayRequestService';
import { CalendarDays, Clock, User, CheckCircle, XCircle, RefreshCw, Eye } from 'lucide-react';
import { format, parseISO, isAfter, startOfToday, isBefore, isToday } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useLanguage } from '@/context/LanguageContext';

interface HolidayRequestsListProps {
  showAllRequests?: boolean;
}

const HolidayRequestsList: React.FC<HolidayRequestsListProps> = ({ showAllRequests = false }) => {
  const [requests, setRequests] = useState<HolidayRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<HolidayRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const canManageRequests = currentEmployee?.role === 'admin' || 
                           currentEmployee?.role === 'teamleader' || 
                           currentEmployee?.role === 'manager';

  useEffect(() => {
    fetchRequests();
  }, [currentEmployee, showAllRequests]);

  const fetchRequests = async () => {
    if (!currentEmployee) {
      console.log('No current employee, skipping fetch');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      console.log('Fetching requests for user:', currentEmployee.id, 'showAllRequests:', showAllRequests);
      
      let data: HolidayRequest[];
      
      if (showAllRequests && canManageRequests) {
        console.log('Fetching all requests for admin/manager');
        data = await holidayRequestService.getAllRequests();
      } else {
        console.log('Fetching user requests for:', currentEmployee.id);
        data = await holidayRequestService.getUserRequests(currentEmployee.id);
      }
      
      console.log('Fetched holiday requests:', data);
      
      const sortedData = data.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setRequests(sortedData);
    } catch (error) {
      console.error('Error fetching holiday requests:', error);
      toast({
        title: "Error",
        description: "Failed to load holiday requests. Please try again.",
        variant: "destructive"
      });
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (requestId: string, status: 'approved' | 'rejected') => {
    if (!currentEmployee || !canManageRequests) {
      toast({
        title: "Error",
        description: "You don't have permission to update request status",
        variant: "destructive"
      });
      return;
    }

    setProcessingId(requestId);
    try {
      console.log('Updating request status:', { requestId, status, adminNotes: adminNotes.trim() });
      
      await holidayRequestService.updateRequestStatus(
        requestId,
        status,
        adminNotes.trim() || undefined
      );

      toast({
        title: "Success",
        description: `Holiday request ${status} successfully`,
      });

      setSelectedRequest(null);
      setAdminNotes('');
      await fetchRequests();
    } catch (error) {
      console.error('Error updating request status:', error);
      toast({
        title: "Error",
        description: "Failed to update request status. Please try again.",
        variant: "destructive"
      });
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'rejected':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const today = startOfToday();
  
  const upcomingRequests = requests.filter(request => {
    const startDate = parseISO(request.start_date);
    return isAfter(startDate, today) || isToday(startDate) || request.status === 'pending';
  });
  
  const pastRequests = requests.filter(request => {
    const startDate = parseISO(request.start_date);
    return isBefore(startDate, today) && request.status !== 'pending';
  });

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved':
        return t('approved');
      case 'rejected':
        return t('rejected');
      default:
        return t('pending');
    }
  };

  const renderRequestCard = (request: HolidayRequest) => (
    <div
      key={request.id}
      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <User className="h-5 w-5 text-gray-500" />
          <div>
            <p className="font-medium">{request.employee_name}</p>
            <p className="text-sm text-gray-500">
              {format(parseISO(request.start_date), 'MMM dd')} - {format(parseISO(request.end_date), 'MMM dd, yyyy')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusBadgeVariant(request.status)} className="flex items-center gap-1">
            {getStatusIcon(request.status)}
            {getStatusLabel(request.status)}
          </Badge>
          {canManageRequests && showAllRequests && request.status === 'pending' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedRequest(request);
                setAdminNotes('');
              }}
            >
              {t('review')}
            </Button>
          )}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('request_details')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">{t('employee')}</label>
                  <p className="text-sm text-gray-600">{request.employee_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">{t('dates')}</label>
                  <p className="text-sm text-gray-600">
                    {format(parseISO(request.start_date), 'MMMM dd, yyyy')} - {format(parseISO(request.end_date), 'MMMM dd, yyyy')}
                  </p>
                </div>
                {request.reason && (
                  <div>
                    <label className="text-sm font-medium">{t('reason')}</label>
                    <p className="text-sm text-gray-600">{request.reason}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium">{t('status')}</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={getStatusBadgeVariant(request.status)} className="flex items-center gap-1">
                      {getStatusIcon(request.status)}
                      {getStatusLabel(request.status)}
                    </Badge>
                  </div>
                </div>
                {request.admin_notes && (
                  <div>
                    <label className="text-sm font-medium">{t('admin_notes')}</label>
                    <p className="text-sm text-gray-600 bg-blue-50 p-2 rounded">{request.admin_notes}</p>
                  </div>
                )}
                <div className="text-xs text-gray-500">
                  <p>{t('submitted')}: {format(parseISO(request.created_at), 'MMM dd, yyyy HH:mm')}</p>
                  {request.updated_at !== request.created_at && (
                    <p>{t('updated')}: {format(parseISO(request.updated_at), 'MMM dd, yyyy HH:mm')}</p>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {request.reason && (
        <div className="mb-2">
          <p className="text-sm text-gray-600">
            <strong>{t('reason')}:</strong> {request.reason}
          </p>
        </div>
      )}
      
      {request.admin_notes && (
        <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-400">
          <p className="text-sm text-blue-800">
            <strong>{t('admin_notes')}:</strong> {request.admin_notes}
          </p>
        </div>
      )}
      
      <div className="flex justify-between text-xs text-gray-500 mt-2">
        <span>{t('requested')}: {format(parseISO(request.created_at), 'MMM dd, yyyy HH:mm')}</span>
        {request.updated_at !== request.created_at && (
          <span>{t('updated')}: {format(parseISO(request.updated_at), 'MMM dd, yyyy HH:mm')}</span>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            {t('holiday_requests')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              {showAllRequests ? t('all_holiday_requests') : t('my_holiday_requests')}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchRequests}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CalendarDays className="mx-auto h-12 w-12 mb-4 opacity-30" />
              <p>{t('no_holiday_requests')}</p>
              {!showAllRequests && (
                <p className="text-sm mt-2">{t('submit_first_request')}</p>
              )}
            </div>
          ) : (
            <Tabs defaultValue="upcoming" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upcoming">
                  {t('upcoming')} ({upcomingRequests.length})
                </TabsTrigger>
                <TabsTrigger value="past">
                  {t('past')} ({pastRequests.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="upcoming" className="space-y-4 mt-4">
                {upcomingRequests.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CalendarDays className="mx-auto h-8 w-8 mb-2 opacity-30" />
                    <p>{t('no_upcoming_requests')}</p>
                  </div>
                ) : (
                  upcomingRequests.map(renderRequestCard)
                )}
              </TabsContent>
              
              <TabsContent value="past" className="space-y-4 mt-4">
                {pastRequests.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CalendarDays className="mx-auto h-8 w-8 mb-2 opacity-30" />
                    <p>{t('no_past_requests')}</p>
                  </div>
                ) : (
                  pastRequests.map(renderRequestCard)
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {selectedRequest && (
        <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('review_holiday_request')}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">{t('employee')}</label>
                  <p className="text-sm text-gray-600">{selectedRequest.employee_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">{t('dates')}</label>
                  <p className="text-sm text-gray-600">
                    {format(parseISO(selectedRequest.start_date), 'MMM dd')} - {format(parseISO(selectedRequest.end_date), 'MMM dd, yyyy')}
                  </p>
                </div>
              </div>
              
              {selectedRequest.reason && (
                <div>
                  <label className="text-sm font-medium">{t('reason')}</label>
                  <p className="text-sm text-gray-600">{selectedRequest.reason}</p>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium mb-2 block">{t('admin_notes_optional')}</label>
                <Textarea
                  placeholder={t('add_notes_placeholder')}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setSelectedRequest(null)}
                  disabled={processingId === selectedRequest.id}
                >
                  {t('cancel')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleStatusUpdate(selectedRequest.id, 'rejected')}
                  disabled={processingId === selectedRequest.id}
                >
                  {processingId === selectedRequest.id ? t('processing') : t('reject')}
                </Button>
                <Button
                  onClick={() => handleStatusUpdate(selectedRequest.id, 'approved')}
                  disabled={processingId === selectedRequest.id}
                >
                  {processingId === selectedRequest.id ? t('processing') : t('approve')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default HolidayRequestsList;
