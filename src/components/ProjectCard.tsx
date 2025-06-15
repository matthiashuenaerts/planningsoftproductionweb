
import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { Project } from '@/services/dataService';

interface ProjectCardProps {
  project: Project;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  // Function to format dates
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Get the status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'planned':
        return 'bg-phase-planning text-white';
      case 'in_progress':
        return 'bg-phase-production text-white';
      case 'completed':
        return 'bg-phase-deployment text-white';
      case 'on_hold':
        return 'bg-gray-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow animate-fade-in">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{project.name}</CardTitle>
          <span className={`px-2 py-1 rounded text-xs ${getStatusColor(project.status)}`}>
            {project.status.toUpperCase()}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{project.client}</p>
      </CardHeader>
      <CardContent className="pb-2">
        <p className="text-sm mb-3 line-clamp-2">{project.description}</p>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs">
            <span>Progress</span>
            <span className="font-medium">{project.progress}%</span>
          </div>
          <Progress value={project.progress} className="h-2" />
        </div>
      </CardContent>
      <CardFooter className="pt-2 flex justify-between items-center text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>Start: {formatDate(project.start_date)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>Install: {formatDate(project.installation_date)}</span>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ProjectCard;
