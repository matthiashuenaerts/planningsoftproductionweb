
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { holidayRequestService, HolidayRequest } from '@/services/holidayRequestService';
import { format } from 'date-fns';
import { Check, X } from 'lucide-react';

const HolidayRequestsAdmin: React.FC = () => {
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['holiday-requests-admin'],
    queryFn: () => holidayRequestService.getAllRequests(),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ requestId, status, notes }: { 
      requestId: string; 
      status: 'approved' | 'rejected'; 
      notes?: string;
    }) => holidayRequestService.updateRequestStatus(requestId, status, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holiday-requests-admin'] });
      toast({
        title: 'Success',
        description: 'Holiday request updated successfully'
      });
    },
    onError: (error) => {
      console.error('Error updating request:', error);
      toast({
        title: 'Error',
        description: 'Failed to update holiday request',
        variant: 'destructive'
      });
    },
  });

  const handleUpdateStatus = (requestId: string, status: 'approved' | 'rejected') => {
    const notes = adminNotes[requestId];
    updateStatusMutation.mutate({ requestId, status, notes });
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    
    return (
      <Badge className={variants[status as keyof typeof variants] || variants.pending}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (isLoading) {
    return <div>Loading holiday requests...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Holiday Requests Management</h2>
      
      {requests.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-500">No holiday requests found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{request.employee_name}</CardTitle>
                    <p className="text-sm text-gray-500">
                      {format(new Date(request.start_date), 'PPP')} - {format(new Date(request.end_date), 'PPP')}
                    </p>
                  </div>
                  {getStatusBadge(request.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {request.reason && (
                  <div>
                    <h4 className="font-medium mb-1">Reason:</h4>
                    <p className="text-sm text-gray-600">{request.reason}</p>
                  </div>
                )}
                
                <div className="text-sm text-gray-500">
                  <p>Requested on: {format(new Date(request.created_at), 'PPP')}</p>
                  <p>Duration: {Math.ceil((new Date(request.end_date).getTime() - new Date(request.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1} days</p>
                </div>

                {request.status === 'pending' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Admin Notes (Optional)</label>
                      <Textarea
                        placeholder="Add notes about this request..."
                        value={adminNotes[request.id] || ''}
                        onChange={(e) => setAdminNotes(prev => ({ ...prev, [request.id]: e.target.value }))}
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleUpdateStatus(request.id, 'approved')}
                        disabled={updateStatusMutation.isPending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleUpdateStatus(request.id, 'rejected')}
                        disabled={updateStatusMutation.isPending}
                        variant="destructive"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                )}

                {request.admin_notes && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <h4 className="font-medium mb-1">Admin Notes:</h4>
                    <p className="text-sm">{request.admin_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default HolidayRequestsAdmin;
