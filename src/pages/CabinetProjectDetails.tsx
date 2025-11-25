import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, FileText, Package, DollarSign, History } from 'lucide-react';
import { cabinetService } from '@/services/cabinetService';
import { useLanguage } from '@/context/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';

const CabinetProjectDetails = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { createLocalizedPath } = useLanguage();
  const isMobile = useIsMobile();

  // Fetch project details
  const { data: project, isLoading } = useQuery({
    queryKey: ['cabinet-project', projectId],
    queryFn: () => cabinetService.getProject(projectId!),
    enabled: !!projectId,
  });

  // Fetch configurations
  const { data: configurations } = useQuery({
    queryKey: ['cabinet-configurations', projectId],
    queryFn: () => cabinetService.getConfigurationsByProject(projectId!),
    enabled: !!projectId,
  });

  // Fetch quotes
  const { data: quotes } = useQuery({
    queryKey: ['cabinet-quotes', projectId],
    queryFn: () => cabinetService.getQuotesByProject(projectId!),
    enabled: !!projectId,
  });

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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen">
        {!isMobile && (
          <div className="w-64 bg-sidebar fixed top-0 bottom-0">
            <Navbar />
          </div>
        )}
        {isMobile && <Navbar />}
        
        <div className={`w-full p-6 ${!isMobile ? 'ml-64' : ''}`}>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold mb-2">Project Not Found</h2>
            <p className="text-muted-foreground mb-4">The requested project could not be found</p>
            <Button onClick={() => navigate(createLocalizedPath('/calculation'))}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
          <Button 
            variant="outline" 
            onClick={() => navigate(createLocalizedPath('/calculation'))}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
          </Button>

          {/* Project Header */}
          <div className="mb-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-3xl font-bold">{project.name}</h1>
                  <Badge className={getStatusColor(project.status)}>
                    {getStatusLabel(project.status)}
                  </Badge>
                </div>
                {project.client_name && (
                  <p className="text-muted-foreground">Client: {project.client_name}</p>
                )}
                {project.project_number && (
                  <p className="text-sm text-muted-foreground">Project #: {project.project_number}</p>
                )}
              </div>
            </div>

            {/* Project Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Currency
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-semibold">{project.currency}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Units
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-semibold capitalize">{project.units}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Cabinets
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-semibold">{configurations?.length || 0}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Quotes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-semibold">{quotes?.length || 0}</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="configurator" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="configurator">
                <Package className="h-4 w-4 mr-2" />
                Configurator
              </TabsTrigger>
              <TabsTrigger value="parts">
                <FileText className="h-4 w-4 mr-2" />
                Parts List
              </TabsTrigger>
              <TabsTrigger value="quotes">
                <DollarSign className="h-4 w-4 mr-2" />
                Quotes
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="h-4 w-4 mr-2" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="configurator" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Cabinet Configurations</CardTitle>
                      <CardDescription>
                        Design and configure your cabinets
                      </CardDescription>
                    </div>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" /> Add Cabinet
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {configurations && configurations.length > 0 ? (
                    <div className="space-y-4">
                      {configurations.map((config) => (
                        <Card key={config.id} className="p-4">
                          <h3 className="font-semibold mb-2">{config.name}</h3>
                          <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                            <div>Width: {config.width}mm</div>
                            <div>Height: {config.height}mm</div>
                            <div>Depth: {config.depth}mm</div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No cabinets configured</h3>
                      <p className="text-muted-foreground mb-4">
                        Start by adding your first cabinet configuration
                      </p>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" /> Add First Cabinet
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="parts" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Parts & Materials</CardTitle>
                  <CardDescription>
                    Automatically generated cut lists and material quantities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Configure cabinets to generate parts list
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="quotes" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Quotes</CardTitle>
                      <CardDescription>
                        Cost breakdowns and pricing
                      </CardDescription>
                    </div>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" /> Generate Quote
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {quotes && quotes.length > 0 ? (
                    <div className="space-y-4">
                      {quotes.map((quote) => (
                        <Card key={quote.id} className="p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <h3 className="font-semibold">Version {quote.version}</h3>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(quote.created_at), 'MMM d, yyyy HH:mm')}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold">
                                {project.currency} {quote.total_cost.toFixed(2)}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Tax: {quote.tax_percentage}%
                              </p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No quotes generated</h3>
                      <p className="text-muted-foreground mb-4">
                        Create a quote to calculate costs and pricing
                      </p>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" /> Generate First Quote
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Project History</CardTitle>
                  <CardDescription>
                    Revisions and changes made to this project
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No history available yet
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default CabinetProjectDetails;