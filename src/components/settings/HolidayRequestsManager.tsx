
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { holidayRequestService, HolidayRequest } from '@/services/holidayRequestService';
import { useAuth } from '@/context/AuthContext';
import { CalendarDays, Clock, User, FileText, CheckCircle, XCircle, Eye } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

const HolidayRequestsManager: React.FC = () => {
  const [selectedRequest, setSelectedRequest] = useState<HolidayRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ['holidayRequests', 'all'],
    queryFn: holidayRequestService.getAllRequests,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, adminNotes }: { id: string; status: 'approved' | 'rejected'; adminNotes?: string }) =>
      holidayRequestService.updateRequestStatus(id, status, adminNotes, currentEmployee?.name),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Holiday request status updated successfully"
      });
      queryClient.invalidateQueries({ queryKey: ['holidayRequests'] });
      setSelectedRequest(null);
      setAdminNotes('');
    },
    onError: (error) => {
      console.error('Error updating request status:', error);
      toast({
        title: "Error",
        description: "Failed to update holiday request status",
        variant: "destructive"
      });
    }
  });

  const handleStatusUpdate = (status: 'approved' | 'rejected') => {
    if (!selectedRequest) return;
    
    updateStatusMutation.mutate({
      id: selectedRequest.id,
      status,
      adminNotes: adminNotes.trim() || undefined
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const calculateDuration = (startDate: string, endDate: string) => {
    return differenceInDays(new Date(endDate), new Date(startDate)) + 1;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Holiday Requests Management</h2>
        <p className="text-gray-600">Review and manage employee holiday requests</p>
      </div>

      {!requests || requests.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <CalendarDays className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Holiday Requests</h3>
            <p className="text-gray-500">No holiday requests have been submitted yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-gray-500" />
                    <div>
                      <CardTitle className="text-lg">{request.employee_name}</CardTitle>
                      <CardDescription>
                        {format(new Date(request.start_date), 'MMM dd, yyyy')} - {format(new Date(request.end_date), 'MMM dd, yyyy')}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(request.status)}
                    <Dialog open={detailsOpen && selectedRequest?.id === request.id} onOpenChange={setDetailsOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedRequest(request);
                            setAdminNotes(request.admin_notes || '');
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <CalendarDays className="h-5 w-5" />
                            Holiday Request Details
                          </DialogTitle>
                        </DialogHeader>
                        
                        {selectedRequest && (
                          <div className="space-y-6">
                            {/* Employee Info */}
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                  <User className="h-5 w-5" />
                                  Employee Information
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm text-gray-600">Name</p>
                                    <p className="font-medium">{selectedRequest.employee_name}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">Status</p>
                                    {getStatusBadge(selectedRequest.status)}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Date & Duration */}
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                  <Clock className="h-5 w-5" />
                                  Date & Duration
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                    <p className="text-sm text-gray-600">Start Date</p>
                                    <p className="font-medium">{format(new Date(selectedRequest.start_date), 'EEEE, MMM dd, yyyy')}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">End Date</p>
                                    <p className="font-medium">{format(new Date(selectedRequest.end_date), 'EEEE, MMM dd, yyyy')}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">Duration</p>
                                    <p className="font-medium">{calculateDuration(selectedRequest.start_date, selectedRequest.end_date)} days</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Reason */}
                            {selectedRequest.reason && (
                              <Card>
                                <CardHeader className="pb-3">
                                  <CardTitle className="flex items-center gap-2 text-lg">
                                    <FileText className="h-5 w-5" />
                                    Request Reason
                                  </CardTitle>
                                </CardHeader>
                                <CardContent>
                                  <p className="text-gray-700">{selectedRequest.reason}</p>
                                </CardContent>
                              </Card>
                            )}

                            {/* Admin Notes */}
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-lg">Admin Notes</CardTitle>
                                <CardDescription>
                                  Add notes for your decision (optional)
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div>
                                  <Label htmlFor="admin-notes">Notes</Label>
                                  <Textarea
                                    id="admin-notes"
                                    placeholder="Add any additional notes or comments..."
                                    value={adminNotes}
                                    onChange={(e) => setAdminNotes(e.target.value)}
                                    rows={3}
                                  />
                                </div>
                                
                                {selectedRequest.status === 'pending' && (
                                  <div className="flex gap-3 pt-4">
                                    <Button
                                      onClick={() => handleStatusUpdate('approved')}
                                      disabled={updateStatusMutation.isPending}
                                      className="flex-1 bg-green-600 hover:bg-green-700"
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Approve Request
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      onClick={() => handleStatusUpdate('rejected')}
                                      disabled={updateStatusMutation.isPending}
                                      className="flex-1"
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Reject Request
                                    </Button>
                                  </div>
                                )}

                                {selectedRequest.admin_notes && (
                                  <div className="pt-4 border-t">
                                    <p className="text-sm text-gray-600">Previous Admin Notes:</p>
                                    <p className="text-gray-700 mt-1">{selectedRequest.admin_notes}</p>
                                    {selectedRequest.approved_by && (
                                      <p className="text-sm text-gray-500 mt-2">
                                        Decision by: {selectedRequest.approved_by}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </CardContent>
                            </Card>

                            {/* Request Metadata */}
                            <div className="text-sm text-gray-500 border-t pt-4">
                              <p>Submitted: {format(new Date(selectedRequest.created_at), 'PPP pp')}</p>
                              {selectedRequest.updated_at !== selectedRequest.created_at && (
                                <p>Last updated: {format(new Date(selectedRequest.updated_at), 'PPP pp')}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span>{calculateDuration(request.start_date, request.end_date)} days</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CalendarDays className="h-4 w-4 text-gray-500" />
                    <span>Submitted {format(new Date(request.created_at), 'MMM dd, yyyy')}</span>
                  </div>
                  {request.reason && (
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="truncate">{request.reason}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default HolidayRequestsManager;
