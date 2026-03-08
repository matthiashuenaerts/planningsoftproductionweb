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
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();

  const canManageRequests = currentEmployee?.role === 'admin' || 
                           currentEmployee?.role === 'teamleader' || 
                           currentEmployee?.role === 'manager';

  useEffect(() => {
    fetchRequests();
  }, [currentEmployee, showAllRequests]);

  const fetchRequests = async () => {
    if (!currentEmployee) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      let data: HolidayRequest[];
      
      if (showAllRequests && canManageRequests) {
        data = await holidayRequestService.getAllRequests();
      } else {
        data = await holidayRequestService.getUserRequests(currentEmployee.id);
      }
      
      const sortedData = data.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setRequests(sortedData);
    } catch (error) {
      console.error('Error fetching holiday requests:', error);
      toast({
        title: "Error",
        description: "Failed to load holiday requests.",
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
        description: "Failed to update request status.",
        variant: "destructive"
      });
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved': return 'default';
      case 'rejected': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="h-3.5 w-3.5" />;
      case 'rejected': return <XCircle className="h-3.5 w-3.5" />;
      default: return <Clock className="h-3.5 w-3.5" />;
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
      case 'approved': return t('approved');
      case 'rejected': return t('rejected');
      default: return t('pending');
    }
  };

  const renderRequestCard = (request: HolidayRequest) => {
    if (isMobile) {
      return (
        <div
          key={request.id}
          className="bg-card border border-border rounded-xl p-3.5 space-y-2.5"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{request.employee_name}</p>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(request.start_date), 'MMM dd')} – {format(parseISO(request.end_date), 'MMM dd, yyyy')}
                </p>
              </div>
            </div>
            <Badge variant={getStatusBadgeVariant(request.status)} className="flex items-center gap-1 text-xs shrink-0">
              {getStatusIcon(request.status)}
              {getStatusLabel(request.status)}
            </Badge>
          </div>

          {request.reason && (
            <p className="text-xs text-muted-foreground line-clamp-2 pl-[42px]">{request.reason}</p>
          )}

          {request.admin_notes && (
            <div className="bg-primary/5 p-2.5 rounded-lg border-l-2 border-primary ml-[42px]">
              <p className="text-xs text-foreground">{request.admin_notes}</p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            {canManageRequests && showAllRequests && request.status === 'pending' && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs"
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
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {t('request_details')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[calc(100vw-1.5rem)] w-[calc(100vw-1.5rem)] p-4">
                <DialogHeader>
                  <DialogTitle className="text-base">{t('request_details')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">{t('employee')}</label>
                    <p className="text-sm text-foreground">{request.employee_name}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">{t('dates')}</label>
                    <p className="text-sm text-foreground">
                      {format(parseISO(request.start_date), 'MMMM dd, yyyy')} – {format(parseISO(request.end_date), 'MMMM dd, yyyy')}
                    </p>
                  </div>
                  {request.reason && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">{t('reason')}</label>
                      <p className="text-sm text-foreground">{request.reason}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">{t('status')}</label>
                    <div className="mt-1">
                      <Badge variant={getStatusBadgeVariant(request.status)} className="flex items-center gap-1 w-fit">
                        {getStatusIcon(request.status)}
                        {getStatusLabel(request.status)}
                      </Badge>
                    </div>
                  </div>
                  {request.admin_notes && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">{t('admin_notes')}</label>
                      <p className="text-sm text-foreground bg-muted p-2 rounded-lg">{request.admin_notes}</p>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground pt-2 border-t border-border">
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
      );
    }

    // Desktop card
    return (
      <div
        key={request.id}
        className="border border-border rounded-lg p-4 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">{request.employee_name}</p>
              <p className="text-sm text-muted-foreground">
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
                    <p className="text-sm text-muted-foreground">{request.employee_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('dates')}</label>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(request.start_date), 'MMMM dd, yyyy')} - {format(parseISO(request.end_date), 'MMMM dd, yyyy')}
                    </p>
                  </div>
                  {request.reason && (
                    <div>
                      <label className="text-sm font-medium">{t('reason')}</label>
                      <p className="text-sm text-muted-foreground">{request.reason}</p>
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
                      <p className="text-sm text-muted-foreground bg-muted p-2 rounded">{request.admin_notes}</p>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
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
            <p className="text-sm text-muted-foreground">
              <strong>{t('reason')}:</strong> {request.reason}
            </p>
          </div>
        )}
        
        {request.admin_notes && (
          <div className="bg-primary/5 p-3 rounded border-l-4 border-primary">
            <p className="text-sm text-foreground">
              <strong>{t('admin_notes')}:</strong> {request.admin_notes}
            </p>
          </div>
        )}
        
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>{t('requested')}: {format(parseISO(request.created_at), 'MMM dd, yyyy HH:mm')}</span>
          {request.updated_at !== request.created_at && (
            <span>{t('updated')}: {format(parseISO(request.updated_at), 'MMM dd, yyyy HH:mm')}</span>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-none">
        <CardContent className="p-0">
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={isMobile ? 'border-0 shadow-none' : ''}>
        <CardHeader className={isMobile ? 'px-0 pt-0 pb-3' : ''}>
          <div className="flex items-center justify-between">
            <CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-sm' : ''}`}>
              <CalendarDays className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
              {showAllRequests ? t('all_holiday_requests') : t('my_holiday_requests')}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchRequests}
              disabled={loading}
              className={isMobile ? 'h-8 w-8 p-0' : ''}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className={isMobile ? 'px-0 pb-0' : ''}>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <CalendarDays className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm">{t('no_holiday_requests')}</p>
              {!showAllRequests && (
                <p className="text-xs mt-1">{t('submit_first_request')}</p>
              )}
            </div>
          ) : (
            <Tabs defaultValue="upcoming" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upcoming" className={isMobile ? 'text-xs' : ''}>
                  {t('upcoming')} ({upcomingRequests.length})
                </TabsTrigger>
                <TabsTrigger value="past" className={isMobile ? 'text-xs' : ''}>
                  {t('past')} ({pastRequests.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="upcoming" className={`space-y-${isMobile ? '3' : '4'} mt-4`}>
                {upcomingRequests.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <CalendarDays className="mx-auto h-8 w-8 mb-2 opacity-30" />
                    <p className="text-sm">{t('no_upcoming_requests')}</p>
                  </div>
                ) : (
                  upcomingRequests.map(renderRequestCard)
                )}
              </TabsContent>
              
              <TabsContent value="past" className={`space-y-${isMobile ? '3' : '4'} mt-4`}>
                {pastRequests.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <CalendarDays className="mx-auto h-8 w-8 mb-2 opacity-30" />
                    <p className="text-sm">{t('no_past_requests')}</p>
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
          <DialogContent className={isMobile ? 'max-w-[calc(100vw-1.5rem)] w-[calc(100vw-1.5rem)] p-4' : 'max-w-2xl'}>
            <DialogHeader>
              <DialogTitle className={isMobile ? 'text-base' : ''}>{t('review_holiday_request')}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{t('employee')}</label>
                  <p className="text-sm text-foreground">{selectedRequest.employee_name}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{t('dates')}</label>
                  <p className="text-sm text-foreground">
                    {format(parseISO(selectedRequest.start_date), 'MMM dd')} – {format(parseISO(selectedRequest.end_date), 'MMM dd, yyyy')}
                  </p>
                </div>
              </div>
              
              {selectedRequest.reason && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">{t('reason')}</label>
                  <p className="text-sm text-foreground">{selectedRequest.reason}</p>
                </div>
              )}
              
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t('admin_notes_optional')}</label>
                <Textarea
                  placeholder={t('add_notes_placeholder')}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  className={isMobile ? 'text-sm' : ''}
                />
              </div>
              
              <div className={`flex ${isMobile ? 'flex-col' : 'justify-end'} gap-2 pt-3 border-t border-border`}>
                {isMobile ? (
                  <>
                    <Button
                      onClick={() => handleStatusUpdate(selectedRequest.id, 'approved')}
                      disabled={processingId === selectedRequest.id}
                      className="h-10"
                    >
                      {processingId === selectedRequest.id ? t('processing') : t('approve')}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleStatusUpdate(selectedRequest.id, 'rejected')}
                      disabled={processingId === selectedRequest.id}
                      className="h-10"
                    >
                      {processingId === selectedRequest.id ? t('processing') : t('reject')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setSelectedRequest(null)}
                      disabled={processingId === selectedRequest.id}
                      className="h-10"
                    >
                      {t('cancel')}
                    </Button>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default HolidayRequestsList;
