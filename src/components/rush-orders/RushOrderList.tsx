import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { rushOrderService } from '@/services/rushOrderService';
import { RushOrder } from '@/types/rushOrder';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, File as FileIcon } from 'lucide-react';

interface RushOrderListProps {
  statusFilter?: "pending" | "in_progress" | "completed" | "all";
}

const RushOrderList: React.FC<RushOrderListProps> = ({ statusFilter = "all" }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const { data: rushOrders, isLoading, error, refetch } = useQuery({
    queryKey: ['rushOrders', statusFilter],
    queryFn: rushOrderService.getAllRushOrders,
  });
  
  const isImage = (url: string | undefined): boolean => {
    if (!url) return false;
    return /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(url);
  };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">Pending</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">In Progress</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Completed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  // Filter the rush orders based on the statusFilter prop
  const filteredOrders = rushOrders?.filter(order => 
    statusFilter === "all" ? true : order.status === statusFilter
  );
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="shadow-sm">
            <CardHeader className="pb-4">
              <Skeleton className="h-6 w-2/3" />
              <div className="flex justify-between">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/6" />
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-16 w-full" />
            </CardContent>
            <CardFooter>
              <div className="w-full flex justify-between">
                <Skeleton className="h-10 w-20" />
                <Skeleton className="h-10 w-32" />
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }
  
  if (error) {
    return (
      <Card className="bg-red-50 border-red-200">
        <CardHeader>
          <CardTitle>Error Loading Rush Orders</CardTitle>
          <CardDescription>There was a problem loading the rush orders.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button onClick={() => refetch()}>Try Again</Button>
        </CardFooter>
      </Card>
    );
  }
  
  if (!filteredOrders || filteredOrders.length === 0) {
    return (
      <Card className="bg-gray-50 border-gray-200 text-center py-8">
        <CardContent>
          <p className="text-gray-500">No rush orders found</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-4">
      {filteredOrders.map((order: RushOrder) => (
        <Card key={order.id} className="shadow-sm transition-shadow hover:shadow-md">
          <CardHeader className="pb-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center">
                <CardTitle>{order.title}</CardTitle>
                {(order.unread_messages_count && order.unread_messages_count > 0) && (
                  <Badge className="ml-2 bg-red-500 text-white border-0">
                    <MessageCircle className="h-3 w-3 mr-1" />
                    {order.unread_messages_count}
                  </Badge>
                )}
              </div>
              {getStatusBadge(order.status)}
            </div>
            <CardDescription className="flex justify-between">
              <span>Created: {format(parseISO(order.created_at), 'MMM d, yyyy')}</span>
              <span className="font-medium text-red-600">
                Deadline: {format(parseISO(order.deadline), 'MMM d, yyyy')}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 line-clamp-2">{order.description}</p>
            
            {order.image_url && (
              <div className="mt-4">
                {isImage(order.image_url) ? (
                  <img 
                    src={order.image_url} 
                    alt={order.title} 
                    className="h-40 w-full object-cover rounded-md"
                  />
                ) : (
                  <div className="h-40 w-full rounded-md bg-gray-100 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                        <FileIcon className="mx-auto h-12 w-12" />
                        <p className="text-sm mt-2">Document Attached</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Tasks</p>
                <p className="text-sm font-medium">{order.tasks?.length || 0} tasks assigned</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Assigned to</p>
                <p className="text-sm font-medium">{order.assignments?.length || 0} team members</p>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <div className="w-full flex justify-between">
              <Badge variant="outline" className={`
                ${order.priority === 'critical' ? 'bg-red-100 text-red-800 border-red-300' : 'bg-orange-100 text-orange-800 border-orange-300'}
              `}>
                {order.priority === 'critical' ? 'CRITICAL' : 'HIGH'}
              </Badge>
              <Button 
                variant="outline"
                onClick={() => navigate(`/rush-orders/${order.id}`)}
              >
                View Details
              </Button>
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};

export default RushOrderList;
