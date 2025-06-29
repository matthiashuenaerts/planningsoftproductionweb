
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { holidayRequestService, HolidayRequest } from '@/services/holidayRequestService';
import { CalendarDays, Clock, User, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

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
      
      console.log('Fetched holiday requests:', data);
      setRequests(data);
    } catch (error) {
      console.error('Error fetching holiday requests:', error);
      toast({
        title: "Error",
        description: "Failed to load holiday requests",
        variant: "destructive"
      });
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (requestId: string, status: 'approved' | 'rejected') => {
    if (!currentEmployee || !canManageRequests) return;

    setProcessingId(requestId);
    try {
      await holidayRequestService.updateRequestStatus(
        requestId,
        status,
        adminNotes.trim() || undefined,
        currentEmployee.id
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
        description: "Failed to update request status",
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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Holiday Requests
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
              {showAllRequests ? 'All Holiday Requests' : 'My Holiday Requests'}
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
              <p>No holiday requests found</p>
              {!showAllRequests && (
                <p className="text-sm mt-2">Submit your first holiday request to see it here</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
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
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
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
                          Review
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {request.reason && (
                    <div className="mb-2">
                      <p className="text-sm text-gray-600">
                        <strong>Reason:</strong> {request.reason}
                      </p>
                    </div>
                  )}
                  
                  {request.admin_notes && (
                    <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-400">
                      <p className="text-sm text-blue-800">
                        <strong>Admin Notes:</strong> {request.admin_notes}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex justify-between text-xs text-gray-500 mt-2">
                    <span>Requested: {format(parseISO(request.created_at), 'MMM dd, yyyy HH:mm')}</span>
                    {request.updated_at !== request.created_at && (
                      <span>Updated: {format(parseISO(request.updated_at), 'MMM dd, yyyy HH:mm')}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      {selectedRequest && (
        <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Review Holiday Request</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Employee</label>
                  <p className="text-sm text-gray-600">{selectedRequest.employee_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Dates</label>
                  <p className="text-sm text-gray-600">
                    {format(parseISO(selectedRequest.start_date), 'MMM dd')} - {format(parseISO(selectedRequest.end_date), 'MMM dd, yyyy')}
                  </p>
                </div>
              </div>
              
              {selectedRequest.reason && (
                <div>
                  <label className="text-sm font-medium">Reason</label>
                  <p className="text-sm text-gray-600">{selectedRequest.reason}</p>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium mb-2 block">Admin Notes (Optional)</label>
                <Textarea
                  placeholder="Add notes about this request..."
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
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleStatusUpdate(selectedRequest.id, 'rejected')}
                  disabled={processingId === selectedRequest.id}
                >
                  {processingId === selectedRequest.id ? 'Processing...' : 'Reject'}
                </Button>
                <Button
                  onClick={() => handleStatusUpdate(selectedRequest.id, 'approved')}
                  disabled={processingId === selectedRequest.id}
                >
                  {processingId === selectedRequest.id ? 'Processing...' : 'Approve'}
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
