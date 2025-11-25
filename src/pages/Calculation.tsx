import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Search, FolderOpen, Calendar, FileText } from 'lucide-react';
import { cabinetService } from '@/services/cabinetService';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';

const Calculation = () => {
  const navigate = useNavigate();
  const { createLocalizedPath } = useLanguage();
  const { currentEmployee } = useAuth();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all cabinet projects
  const { data: projects, isLoading } = useQuery({
    queryKey: ['cabinet-projects'],
    queryFn: () => cabinetService.getAllProjects(),
  });

  // Filter projects based on search
  const filteredProjects = projects?.filter(project => 
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.project_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-500';
      case 'quoted': return 'bg-blue-500';
      case 'approved': return 'bg-green-500';
      case 'archived': return 'bg-gray-400';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Draft';
      case 'quoted': return 'Quoted';
      case 'approved': return 'Approved';
      case 'archived': return 'Archived';
      default: return status;
    }
  };

  return (
    <div className="flex min-h-screen">
      {!isMobile && (
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
      )}
      {isMobile && <Navbar />}
      
      <div className={`w-full p-6 ${!isMobile ? 'ml-64' : ''}`}>
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold">Cabinet Calculator</h1>
              <p className="text-muted-foreground mt-1">
                Configure cabinets, calculate materials, and generate quotes
              </p>
            </div>
            
            <Button 
              onClick={() => navigate(createLocalizedPath('/calculation/new'))}
              size="lg"
            >
              <Plus className="mr-2 h-4 w-4" /> New Project
            </Button>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Search projects, clients, or project numbers..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Projects
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{projects?.length || 0}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Draft
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {projects?.filter(p => p.status === 'draft').length || 0}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Quoted
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {projects?.filter(p => p.status === 'quoted').length || 0}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Approved
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {projects?.filter(p => p.status === 'approved').length || 0}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Projects List */}
          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
              <CardDescription>
                Manage your cabinet calculation projects
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading projects...
                </div>
              ) : filteredProjects && filteredProjects.length > 0 ? (
                <div className="space-y-4">
                  {filteredProjects.map((project) => (
                    <Card 
                      key={project.id}
                      className="cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => navigate(createLocalizedPath(`/calculation/${project.id}`))}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <FolderOpen className="h-4 w-4 text-muted-foreground" />
                              <h3 className="font-semibold">{project.name}</h3>
                              <Badge className={getStatusColor(project.status)}>
                                {getStatusLabel(project.status)}
                              </Badge>
                            </div>
                            
                            {project.client_name && (
                              <p className="text-sm text-muted-foreground mb-1">
                                Client: {project.client_name}
                              </p>
                            )}
                            
                            {project.project_number && (
                              <p className="text-sm text-muted-foreground mb-1">
                                Project #: {project.project_number}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(project.created_at), 'MMM d, yyyy')}
                              </div>
                              <div className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {project.currency} • {project.units}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No projects found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm 
                      ? 'Try adjusting your search terms' 
                      : 'Get started by creating your first cabinet project'}
                  </p>
                  {!searchTerm && (
                    <Button onClick={() => navigate(createLocalizedPath('/calculation/new'))}>
                      <Plus className="mr-2 h-4 w-4" /> Create First Project
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Calculation;