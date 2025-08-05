import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import ProjectCalculationVariables from '@/components/ProjectCalculationVariables';

const ProjectCalculation = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { createLocalizedPath } = useLanguage();

  if (!projectId) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
        <div className="ml-64 w-full p-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Project Not Found</h2>
              <p className="text-muted-foreground mb-4">No project ID provided</p>
              <Button onClick={() => navigate(createLocalizedPath('/projects'))}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="w-64 bg-sidebar fixed top-0 bottom-0">
        <Navbar />
      </div>
      <div className="ml-64 w-full p-6">
        <div className="max-w-4xl mx-auto">
          <Button 
            variant="outline" 
            onClick={() => navigate(createLocalizedPath(`/projects/${projectId}/edit`))}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Edit Project
          </Button>
          
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Project Calculation</h1>
            <p className="text-muted-foreground">
              Configure calculation variables for this project. The calculations will be implemented later.
            </p>
          </div>
          
          <ProjectCalculationVariables projectId={projectId} />
        </div>
      </div>
    </div>
  );
};

export default ProjectCalculation;