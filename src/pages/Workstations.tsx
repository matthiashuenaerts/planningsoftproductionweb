import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import Navbar from '@/components/Navbar';
import WorkstationView from '@/components/WorkstationView';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { workstationService } from '@/services/workstationService';
import { workstationTasksService, WorkstationTask } from '@/services/workstationTasksService';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { workstationErrorService } from '@/services/workstationErrorService';
import { ArrowLeft, Package, Wrench, Warehouse, Scissors, CheckCircle, PackageCheck, Calendar, Cog, Settings, MoreVertical, Play, Hammer, Drill, Zap, Truck, Factory, Map, QrCode, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { QRCodeScanner } from '@/components/QRCodeScanner';
import { qrCodeService } from '@/services/qrCodeService';
import { useIsMobile } from '@/hooks/use-mobile';

// Define workstation with appropriate icon mapping
interface WorkstationWithIcon {
  id: string;
  name: string;
  description: string | null;
  icon: React.ReactNode;
  icon_path: string | null;
  sort_order: number;
  production_line: number;
}
const Workstations: React.FC = () => {
  const [selectedWorkstation, setSelectedWorkstation] = useState<string | null>(null);
  const [workstations, setWorkstations] = useState<WorkstationWithIcon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWorkstationTasks, setShowWorkstationTasks] = useState<string | null>(null);
  const [workstationTasks, setWorkstationTasks] = useState<WorkstationTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState<string | null>(null);
  const [showErrorDialog, setShowErrorDialog] = useState<string | null>(null);
  const [newErrorMessage, setNewErrorMessage] = useState('');
  const [newErrorType, setNewErrorType] = useState('general');
  const [newErrorNotes, setNewErrorNotes] = useState('');
  const [selectedProductionLine, setSelectedProductionLine] = useState<number | null>(null);
  const {
    toast
  } = useToast();
  const {
    currentEmployee
  } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const navigate = useNavigate();
  useEffect(() => {
    const loadWorkstations = async () => {
      try {
        const data = await workstationService.getAll();

        // Map workstations to include icons
        const workstationsWithIcons = data.map(ws => {
          return {
            ...ws,
            icon: getWorkstationIcon(ws.name)
          };
        });
        setWorkstations(workstationsWithIcons);
      } catch (error: any) {
        toast({
          title: t('error'),
          description: t('failed_to_load_workstations', { message: error.message }),
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    loadWorkstations();
  }, [toast, t]);

  // Function to get icon based on workstation name (Dutch names)
  const getWorkstationIcon = (name: string) => {
    const lowercaseName = name.toLowerCase();
    
    // CNC related workstations
    if (lowercaseName.includes('cnc') || lowercaseName.includes('draaibank') || lowercaseName.includes('freesmachine')) {
      return <Cog className="h-8 w-8" />;
    }
    
    // Assembly/Montage workstations
    if (lowercaseName.includes('montage') || lowercaseName.includes('assemblage') || lowercaseName.includes('assembly')) {
      return <Wrench className="h-8 w-8" />;
    }
    
    // Warehouse/Magazijn workstations
    if (lowercaseName.includes('magazijn') || lowercaseName.includes('warehouse') || lowercaseName.includes('opslag')) {
      return <Warehouse className="h-8 w-8" />;
    }
    
    // Cutting/Snijden workstations
    if (lowercaseName.includes('snijden') || lowercaseName.includes('cutting') || lowercaseName.includes('zaag')) {
      return <Scissors className="h-8 w-8" />;
    }
    
    // Quality/Kwaliteit workstations
    if (lowercaseName.includes('kwaliteit') || lowercaseName.includes('quality') || lowercaseName.includes('controle')) {
      return <CheckCircle className="h-8 w-8" />;
    }
    
    // Packaging/Verpakking workstations
    if (lowercaseName.includes('verpakking') || lowercaseName.includes('packaging') || lowercaseName.includes('inpakken')) {
      return <PackageCheck className="h-8 w-8" />;
    }
    
    // Planning workstations
    if (lowercaseName.includes('planning') || lowercaseName.includes('plan')) {
      return <Calendar className="h-8 w-8" />;
    }
    
    // Production/Productie workstations
    if (lowercaseName.includes('productie') || lowercaseName.includes('production') || lowercaseName.includes('fabricage')) {
      return <Factory className="h-8 w-8" />;
    }
    
    // Welding/Lassen workstations
    if (lowercaseName.includes('lassen') || lowercaseName.includes('welding') || lowercaseName.includes('weld')) {
      return <Zap className="h-8 w-8" />;
    }
    
    // Drilling/Boren workstations
    if (lowercaseName.includes('boren') || lowercaseName.includes('drilling') || lowercaseName.includes('drill')) {
      return <Drill className="h-8 w-8" />;
    }
    
    // Hammering/Hameren workstations
    if (lowercaseName.includes('hameren') || lowercaseName.includes('hammer') || lowercaseName.includes('smeden')) {
      return <Hammer className="h-8 w-8" />;
    }
    
    // Transport/Verzending workstations
    if (lowercaseName.includes('transport') || lowercaseName.includes('verzending') || lowercaseName.includes('levering')) {
      return <Truck className="h-8 w-8" />;
    }
    
    // Settings/Instellingen workstations
    if (lowercaseName.includes('instellingen') || lowercaseName.includes('settings') || lowercaseName.includes('configuratie')) {
      return <Settings className="h-8 w-8" />;
    }

    // Default icon for unmatched workstations
    return <Package className="h-8 w-8" />;
  };
  const loadWorkstationTasks = async (workstationId: string) => {
    try {
      setLoadingTasks(true);
      const tasks = await workstationTasksService.getByWorkstation(workstationId);
      setWorkstationTasks(tasks);
    } catch (error: any) {
      toast({
        title: t('error'),
        description: t('failed_to_load_workstation_tasks', { message: error.message }),
        variant: "destructive"
      });
    } finally {
      setLoadingTasks(false);
    }
  };
  const handleShowWorkstationTasks = (workstationId: string) => {
    setShowWorkstationTasks(workstationId);
    loadWorkstationTasks(workstationId);
  };
  const handleStartWorkstationTask = async (task: WorkstationTask) => {
    if (!currentEmployee) return;
    try {
      // Start time registration for workstation task using the new method
      await timeRegistrationService.startWorkstationTask(currentEmployee.id, task.id);

      // Invalidate queries to refresh the TaskTimer
      queryClient.invalidateQueries({
        queryKey: ['activeTimeRegistration']
      });
      toast({
        title: t('workstation_task_started'),
        description: t('workstation_task_started_desc', { taskName: task.task_name })
      });

      // Close the dialog after starting the task
      setShowWorkstationTasks(null);
    } catch (error: any) {
      toast({
        title: t('error'),
        description: t('failed_to_start_task', { message: error.message }),
        variant: "destructive"
      });
    }
  };
  const handleQRCodeDetected = async (qrCode: string) => {
    if (!showQRScanner) return;

    try {
      const selectedWorkstation = workstations.find(ws => ws.id === showQRScanner);
      if (!selectedWorkstation) return;

      // Search for the QR code in all parts
      const matchingParts = await qrCodeService.findAllPartsByQRCode(qrCode);
      
      if (matchingParts.length === 0) {
        toast({
          title: 'Geen onderdeel gevonden',
          description: `Geen onderdeel gevonden voor QR code: "${qrCode}"`,
          variant: 'destructive'
        });
        return;
      }

      // Update all matching parts with the workstation name
      for (const part of matchingParts) {
        await qrCodeService.updatePartWorkstationStatus(part.id, selectedWorkstation.name);
      }

      toast({
        title: 'QR Code succesvol verwerkt!',
        description: `${matchingParts.length} onderdeel(en) bijgewerkt met werkstation "${selectedWorkstation.name}"`
      });

      setShowQRScanner(null);
    } catch (error: any) {
      console.error('Error processing QR code:', error);
      toast({
        title: 'Fout bij verwerken QR code',
        description: error.message || 'Er is een fout opgetreden',
        variant: 'destructive'
      });
    }
  };

  const handleCreateError = async () => {
    if (!showErrorDialog || !currentEmployee || !newErrorMessage.trim()) {
      return;
    }
    
    await workstationErrorService.createError(
      showErrorDialog,
      newErrorMessage,
      newErrorType,
      currentEmployee.id,
      newErrorNotes || undefined
    );
    
    setNewErrorMessage('');
    setNewErrorType('general');
    setNewErrorNotes('');
    setShowErrorDialog(null);
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return <Badge className="bg-red-100 text-red-800 border-red-300">{t('priority_high_label')}</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">{t('priority_medium_label')}</Badge>;
      case 'low':
        return <Badge className="bg-green-100 text-green-800 border-green-300">{t('priority_low_label')}</Badge>;
      default:
        return <Badge>{priority}</Badge>;
    }
  };
  const isMobile = useIsMobile();

  if (loading) {
    return <div className="flex min-h-screen">
        {!isMobile && (
          <div className="w-64 bg-sidebar fixed top-0 bottom-0">
            <Navbar />
          </div>
        )}
        {isMobile && <Navbar />}
        <div className={`w-full p-6 flex justify-center items-center ${!isMobile ? 'ml-64' : 'pt-16'}`}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </div>;
  }
  const selectedWorkstationForTasks = workstations.find(ws => ws.id === showWorkstationTasks);
  return <div className="flex min-h-screen">
      {!isMobile && (
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
      )}
      {isMobile && <Navbar />}
      <div className={`w-full ${!isMobile ? 'ml-64' : 'pt-16'}`}>
        <ScrollArea className="h-screen">
          <div className="p-6">
            <div className="max-w-7xl mx-auto">
              {selectedWorkstation ? <div>
                  <Button variant="outline" className="mb-4" onClick={() => setSelectedWorkstation(null)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> {t('back_to_workstations')}
                  </Button>
                  <WorkstationView workstationId={selectedWorkstation} onBack={() => setSelectedWorkstation(null)} />
                </div> : (() => {
                  // Get unique production lines and check if we need tabs
                  const productionLines = [...new Set(workstations.map(ws => ws.production_line))].sort((a, b) => a - b);
                  const hasMultipleLines = productionLines.length > 1;
                  
                  // Set default selected line if not set
                  const activeProductionLine = selectedProductionLine ?? productionLines[0] ?? 1;
                  
                  // Filter workstations by production line if multiple lines exist
                  const filteredWorkstations = hasMultipleLines 
                    ? workstations.filter(ws => ws.production_line === activeProductionLine)
                    : workstations;
                  
                  return (
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h1 className="text-2xl font-bold">{t('workstations_title')}</h1>
                      <Button 
                        variant="outline" 
                        onClick={() => navigate('/nl/floorplan')}
                        className="flex items-center gap-2"
                      >
                        <Map className="h-4 w-4" />
                        Floorplan
                      </Button>
                    </div>
                    
                    {/* Production Line Tabs - only show if more than 1 production line */}
                    {hasMultipleLines && (
                      <div className="flex gap-2 mb-6 border-b">
                        {productionLines.map(line => (
                          <Button
                            key={line}
                            variant={activeProductionLine === line ? "default" : "ghost"}
                            className="rounded-b-none"
                            onClick={() => setSelectedProductionLine(line)}
                          >
                            Productielijn {line}
                          </Button>
                        ))}
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                      {filteredWorkstations.map((workstation, index) => <Card key={workstation.id} className="hover:shadow-md transition-shadow cursor-pointer relative">
                          <div className="absolute top-2 left-2 z-10">
                            <Badge variant="secondary" className="text-xs font-mono">
                              {String(workstation.sort_order).padStart(2, '0')}
                            </Badge>
                          </div>
                          <div className="absolute top-2 right-2 z-10">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={e => e.stopPropagation()}>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                               <DropdownMenuContent align="end">
                                 <DropdownMenuItem onClick={e => {
                          e.stopPropagation();
                          handleShowWorkstationTasks(workstation.id);
                        }}>
                                   <CheckCircle className="mr-2 h-4 w-4" />
                                   {t('workstation_tasks')}
                                 </DropdownMenuItem>
                                 <DropdownMenuItem onClick={e => {
                          e.stopPropagation();
                          setShowQRScanner(workstation.id);
                        }}>
                                   <QrCode className="mr-2 h-4 w-4" />
                                   Scan QR-code
                                 </DropdownMenuItem>
                                 <DropdownMenuItem onClick={e => {
                          e.stopPropagation();
                          setShowErrorDialog(workstation.id);
                        }}>
                                   <AlertTriangle className="mr-2 h-4 w-4" />
                                   Foutmelding Toevoegen
                                 </DropdownMenuItem>
                               </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <CardContent className="p-6 flex flex-col items-center text-center" onClick={() => setSelectedWorkstation(workstation.id)}>
                            <div className="bg-primary/10 p-4 rounded-full mb-4">
                              {workstation.icon_path ? (
                                <img 
                                  src={workstation.icon_path} 
                                  alt={workstation.name} 
                                  className="h-8 w-8 object-contain"
                                />
                              ) : (
                                workstation.icon
                              )}
                            </div>
                            <h3 className="text-lg font-medium mb-1">{workstation.name}</h3>
                            {workstation.description && <p className="text-sm text-muted-foreground">{workstation.description}</p>}
                          </CardContent>
                        </Card>)}
                    </div>
                  </div>
                  );
                })()}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Workstation Tasks Dialog */}
      <Dialog open={!!showWorkstationTasks} onOpenChange={() => setShowWorkstationTasks(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {t('workstation_tasks_for', { name: selectedWorkstationForTasks?.name })}
            </DialogTitle>
            <DialogDescription>
              {t('workstation_tasks_desc')}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              {loadingTasks ? <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div> : workstationTasks.length === 0 ? <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">{t('no_workstation_tasks')}</p>
                  <p className="text-sm text-gray-400">{t('add_tasks_in_settings')}</p>
                </div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {workstationTasks.map(task => <Card key={task.id} className="h-fit">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div>
                            <h3 className="font-medium text-lg">{selectedWorkstationForTasks?.name}</h3>
                            <p className="text-slate-950 text-xl font-bold">{task.task_name}</p>
                          </div>
                          
                          <div className="flex flex-wrap gap-2">
                            {getPriorityBadge(task.priority)}
                            {task.duration && <Badge variant="outline">{task.duration}h</Badge>}
                          </div>

                          {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}

                          <div className="flex gap-2 pt-2 border-t">
                            <Button size="sm" onClick={() => handleStartWorkstationTask(task)} className="flex-1">
                              <Play className="h-4 w-4 mr-1" />
                              {t('start_task')}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>)}
                </div>}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* QR Code Scanner Dialog */}
      <QRCodeScanner
        isOpen={!!showQRScanner}
        onClose={() => setShowQRScanner(null)}
        onQRCodeDetected={handleQRCodeDetected}
        workstationName={workstations.find(ws => ws.id === showQRScanner)?.name || ''}
      />

      {/* Create Error Dialog */}
      <Dialog open={!!showErrorDialog} onOpenChange={() => setShowErrorDialog(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Foutmelding Toevoegen</DialogTitle>
            <DialogDescription>
              Maak een nieuwe foutmelding aan voor {workstations.find(ws => ws.id === showErrorDialog)?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="errorMessage">Foutmelding *</Label>
              <Input
                id="errorMessage"
                value={newErrorMessage}
                onChange={(e) => setNewErrorMessage(e.target.value)}
                placeholder="Beschrijf de fout..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="errorType">Type</Label>
              <select
                id="errorType"
                value={newErrorType}
                onChange={(e) => setNewErrorType(e.target.value)}
                className="w-full p-2 rounded-md border border-input bg-background"
              >
                <option value="general">Algemeen</option>
                <option value="mechanical">Mechanisch</option>
                <option value="electrical">Elektrisch</option>
                <option value="software">Software</option>
                <option value="material">Materiaal</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="errorNotes">Notities (optioneel)</Label>
              <Textarea
                id="errorNotes"
                value={newErrorNotes}
                onChange={(e) => setNewErrorNotes(e.target.value)}
                placeholder="Extra informatie..."
                rows={3}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleCreateError} 
              className="flex-1"
              disabled={!newErrorMessage.trim()}
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Foutmelding Aanmaken
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowErrorDialog(null);
                setNewErrorMessage('');
                setNewErrorType('general');
                setNewErrorNotes('');
              }} 
              className="flex-1"
            >
              Annuleren
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>;
};
export default Workstations;
