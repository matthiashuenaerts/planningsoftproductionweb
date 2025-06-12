
import React, { useState, useEffect } from 'react';
import { format, isAfter, isBefore, startOfDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays, Package, Truck, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Project {
  id: string;
  name: string;
  client: string;
  installation_date: string;
  status: string;
  progress: number;
}

interface TeamAssignment {
  id: string;
  project_id: string;
  team: string;
  start_date: string;
  duration: number;
}

const UpcomingDeliveries = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [teamAssignments, setTeamAssignments] = useState<TeamAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchUpcomingProjects();
  }, []);

  const fetchUpcomingProjects = async () => {
    try {
      setLoading(true);
      
      // Get projects with installation dates in the future
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .not('installation_date', 'is', null)
        .gte('installation_date', today)
        .order('installation_date', { ascending: true })
        .limit(20);

      if (projectError) throw projectError;

      // Get team assignments for these projects
      const projectIds = projectData?.map(p => p.id) || [];
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('project_team_assignments')
        .select('*')
        .in('project_id', projectIds);

      if (assignmentError) throw assignmentError;

      setProjects(projectData || []);
      setTeamAssignments(assignmentData || []);
    } catch (error) {
      console.error('Error fetching upcoming projects:', error);
      toast({
        title: "Error",
        description: "Failed to load upcoming installations",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getInstallationStatus = (projectId: string) => {
    const assignment = teamAssignments.find(a => a.project_id === projectId);
    return assignment ? 'planned' : 'to plan';
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getInstallationStatusColor = (status: string) => {
    switch (status) {
      case 'planned':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'to plan':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Upcoming Installations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Upcoming Installations ({projects.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No upcoming installations scheduled</p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => {
              const installationStatus = getInstallationStatus(project.id);
              const assignment = teamAssignments.find(a => a.project_id === project.id);
              
              return (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{project.name}</h4>
                      <Badge className={getStatusColor(project.status)} variant="outline">
                        {project.status}
                      </Badge>
                      <Badge className={getInstallationStatusColor(installationStatus)} variant="outline">
                        {installationStatus}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{project.client}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {format(new Date(project.installation_date), 'MMM d, yyyy')}
                      </span>
                      {assignment && (
                        <span className="flex items-center gap-1">
                          <Truck className="h-3 w-3" />
                          {assignment.team} team
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Progress: {project.progress}%
                      </span>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.href = `/projects/${project.id}`}
                  >
                    View Details
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UpcomingDeliveries;
