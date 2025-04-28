
import React from 'react';
import { Project, formatDate, PhaseType } from '@/lib/mockData';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Calendar } from 'lucide-react';

interface ProjectCardProps {
  project: Project;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  // Get the phase color based on the current phase
  const getPhaseColor = (phase: PhaseType) => {
    switch (phase) {
      case PhaseType.PLANNING:
        return 'bg-phase-planning text-white';
      case PhaseType.DESIGN:
        return 'bg-phase-design text-white';
      case PhaseType.PRODUCTION:
        return 'bg-phase-production text-white';
      case PhaseType.ASSEMBLY:
        return 'bg-phase-assembly text-white';
      case PhaseType.TESTING:
        return 'bg-phase-testing text-white';
      case PhaseType.DEPLOYMENT:
        return 'bg-phase-deployment text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow animate-fade-in">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{project.name}</CardTitle>
          <span className={`phase-badge ${getPhaseColor(project.currentPhase)}`}>
            {project.currentPhase}
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
          <span>Start: {formatDate(project.startDate)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>Install: {formatDate(project.installationDate)}</span>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ProjectCard;
