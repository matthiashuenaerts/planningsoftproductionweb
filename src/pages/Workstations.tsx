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
import { ArrowLeft, Package, Wrench, Warehouse, Scissors, CheckCircle, PackageCheck, Calendar, Cog, Settings, MoreVertical, Play, Hammer, Drill, Zap, Truck, Factory, Map, QrCode, AlertTriangle, Radio } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { QRCodeScanner } from '@/components/QRCodeScanner';
import { KeyboardScannerListener } from '@/components/KeyboardScannerListener';
import { qrCodeService } from '@/services/qrCodeService';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTenant } from '@/context/TenantContext';

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
  const [showKeyboardScanner, setShowKeyboardScanner] = useState<string | null>(null);
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
  const { t, createLocalizedPath } = useLanguage();
  const navigate = useNavigate();
  const { tenant } = useTenant();
  useEffect(() => {
    const loadWorkstations = async () => {
      try {
        const data = await workstationService.getAll(tenant?.id);

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

      // The scanner already handles part lookup, status update, and tracking completion.
      // Just show a toast confirmation here — do NOT close the scanner so it keeps scanning.
      toast({
        title: 'QR Code verwerkt',
        description: `"${qrCode}" geregistreerd op "${selectedWorkstation.name}"`,
      });
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
    return <div className="flex min-h-screen bg-background">
        {!isMobile && (
          <div className="w-64 bg-sidebar fixed top-0 bottom-0">
            <Navbar />
          </div>
        )}
        {isMobile && <Navbar />}
        <div className={`w-full flex justify-center items-center ${!isMobile ? 'ml-64' : 'pt-16'}`}>
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
            <p className="text-sm text-muted-foreground">{t('workstations_title')}...</p>
          </div>
        </div>
      </div>;
  }
  const selectedWorkstationForTasks = workstations.find(ws => ws.id === showWorkstationTasks);
  return <div className="flex min-h-screen bg-background">
      {!isMobile && (
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
      )}
      {isMobile && <Navbar />}
      <div className={`w-full ${!isMobile ? 'ml-64' : 'pt-16'}`}>
        <ScrollArea className="h-screen">
          <div className={isMobile ? 'p-4' : 'p-8'}>
            <div className="max-w-7xl mx-auto">
              {selectedWorkstation ? <div>
                  <Button variant="outline" className="mb-4 rounded-xl" size={isMobile ? 'sm' : 'default'} onClick={() => setSelectedWorkstation(null)}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> {t('back_to_workstations')}
                  </Button>
                  <WorkstationView workstationId={selectedWorkstation} onBack={() => setSelectedWorkstation(null)} />
                </div> : (() => {
                  const productionLines = [...new Set(workstations.map(ws => ws.production_line))].sort((a, b) => a - b);
                  const hasMultipleLines = productionLines.length > 1;
                  const activeProductionLine = selectedProductionLine ?? productionLines[0] ?? 1;
                  const filteredWorkstations = hasMultipleLines 
                    ? workstations.filter(ws => ws.production_line === activeProductionLine)
                    : workstations;
                  
                  return (
                  <div className="space-y-5">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h1 className={`font-bold tracking-tight ${isMobile ? 'text-xl' : 'text-3xl'}`}>{t('workstations_title')}</h1>
                        <p className="text-muted-foreground text-sm mt-0.5">
                          {filteredWorkstations.length} {isMobile ? 'stations' : 'werkstations beschikbaar'}
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size={isMobile ? 'icon' : 'default'}
                        onClick={() => navigate(createLocalizedPath('/floorplan'))}
                        className="rounded-xl gap-2"
                      >
                        <Map className="h-4 w-4" />
                        {!isMobile && 'Floorplan'}
                      </Button>
                    </div>
                    
                    {/* Production Line Tabs */}
                    {hasMultipleLines && (
                      <div className={`flex gap-2 ${isMobile ? 'overflow-x-auto pb-1 -mx-1 px-1' : ''}`}>
                        {productionLines.map(line => (
                          <Button
                            key={line}
                            variant={activeProductionLine === line ? "default" : "secondary"}
                            size="sm"
                            className="rounded-full whitespace-nowrap px-4"
                            onClick={() => setSelectedProductionLine(line)}
                          >
                            {isMobile ? `Lijn ${line}` : `Productielijn ${line}`}
                          </Button>
                        ))}
                      </div>
                    )}
                    
                    {/* Workstation Grid */}
                    <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'}`}>
                      {filteredWorkstations.map((workstation) => (
                        <Card 
                          key={workstation.id} 
                          className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card hover:shadow-lg hover:border-primary/20 transition-all duration-300 cursor-pointer active:scale-[0.97]"
                        >
                          {/* Sort order badge */}
                          <div className="absolute top-2.5 left-2.5 z-10">
                            <span className={`inline-flex items-center justify-center rounded-lg bg-foreground/5 backdrop-blur-sm font-mono font-semibold text-muted-foreground ${isMobile ? 'text-[10px] h-5 w-7' : 'text-xs h-6 w-8'}`}>
                              {String(workstation.sort_order).padStart(2, '0')}
                            </span>
                          </div>

                          {/* Menu */}
                          <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="secondary" size="icon" className={`rounded-xl shadow-sm ${isMobile ? 'h-7 w-7 opacity-100' : 'h-8 w-8'}`} onClick={e => e.stopPropagation()}>
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-xl">
                                <DropdownMenuItem onClick={e => { e.stopPropagation(); handleShowWorkstationTasks(workstation.id); }}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  {t('workstation_tasks')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={e => { e.stopPropagation(); setShowQRScanner(workstation.id); }}>
                                  <QrCode className="mr-2 h-4 w-4" />
                                  Scan QR-code
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={e => { e.stopPropagation(); setShowKeyboardScanner(workstation.id); }}>
                                  <Radio className="mr-2 h-4 w-4" />
                                  Listen for Scan
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={e => { e.stopPropagation(); setShowErrorDialog(workstation.id); }}>
                                  <AlertTriangle className="mr-2 h-4 w-4" />
                                  Foutmelding Toevoegen
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {/* Card body */}
                          <CardContent 
                            className={`flex flex-col items-center text-center ${isMobile ? 'px-3 pt-10 pb-4' : 'px-4 pt-12 pb-5'}`} 
                            onClick={() => setSelectedWorkstation(workstation.id)}
                          >
                            <div className={`rounded-2xl bg-primary/8 group-hover:bg-primary/15 transition-colors ${isMobile ? 'p-3 mb-2.5' : 'p-4 mb-3'}`}>
                              {workstation.icon_path ? (
                                <SignedStorageImage 
                                  bucket="product-images"
                                  path={workstation.icon_path} 
                                  alt={workstation.name} 
                                  className={`object-contain text-primary ${isMobile ? 'h-6 w-6' : 'h-7 w-7'}`}
                                />
                              ) : (
                                <div className={`text-primary ${isMobile ? '[&>svg]:h-5 [&>svg]:w-5' : '[&>svg]:h-7 [&>svg]:w-7'}`}>
                                  {workstation.icon}
                                </div>
                              )}
                            </div>
                            <h3 className={`font-semibold leading-tight ${isMobile ? 'text-xs' : 'text-sm'}`}>
                              {workstation.name}
                            </h3>
                            {workstation.description && !isMobile && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{workstation.description}</p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
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
        <DialogContent className="max-w-4xl w-[95vw] max-h-[80vh] p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-lg leading-tight">
              {t('workstation_tasks_for', { name: selectedWorkstationForTasks?.name })}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {t('workstation_tasks_desc')}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3 sm:space-y-4 pr-2 sm:pr-4">
              {loadingTasks ? <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div> : workstationTasks.length === 0 ? <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">{t('no_workstation_tasks')}</p>
                  <p className="text-sm text-gray-400">{t('add_tasks_in_settings')}</p>
                </div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {workstationTasks.map(task => <Card key={task.id} className="h-fit">
                      <CardContent className="p-3 sm:p-4">
                        <div className="space-y-2 sm:space-y-3">
                          <div>
                            <h3 className="font-medium text-sm sm:text-lg">{selectedWorkstationForTasks?.name}</h3>
                            <p className="text-foreground text-base sm:text-xl font-bold">{task.task_name}</p>
                          </div>
                          
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {getPriorityBadge(task.priority)}
                            {task.duration && <Badge variant="outline">{task.duration}h</Badge>}
                          </div>

                          {task.description && <p className="text-xs sm:text-sm text-muted-foreground">{task.description}</p>}

                          <div className="flex gap-2 pt-2 border-t">
                            <Button size="sm" onClick={() => handleStartWorkstationTask(task)} className="flex-1 text-xs sm:text-sm">
                              <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
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
        workstationId={showQRScanner || undefined}
      />

      {/* Keyboard/COM Scanner Listener */}
      <KeyboardScannerListener
        isOpen={!!showKeyboardScanner}
        onClose={() => setShowKeyboardScanner(null)}
        onCodeDetected={handleQRCodeDetected}
        workstationName={workstations.find(ws => ws.id === showKeyboardScanner)?.name || ''}
        workstationId={showKeyboardScanner || undefined}
      />

      <Dialog open={!!showErrorDialog} onOpenChange={() => setShowErrorDialog(null)}>
        <DialogContent className="sm:max-w-[500px] w-[95vw] p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm sm:text-lg leading-tight">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-destructive" />
              Foutmelding Toevoegen
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Maak een nieuwe foutmelding aan voor {workstations.find(ws => ws.id === showErrorDialog)?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4 py-2 sm:py-4">
            <div className="space-y-1.5">
              <Label htmlFor="errorMessage" className="text-xs sm:text-sm">Foutmelding *</Label>
              <Input
                id="errorMessage"
                value={newErrorMessage}
                onChange={(e) => setNewErrorMessage(e.target.value)}
                placeholder="Beschrijf de fout..."
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="errorType" className="text-xs sm:text-sm">Type</Label>
              <select
                id="errorType"
                value={newErrorType}
                onChange={(e) => setNewErrorType(e.target.value)}
                className="w-full p-2 text-sm rounded-md border border-input bg-background"
              >
                <option value="general">Algemeen</option>
                <option value="mechanical">Mechanisch</option>
                <option value="electrical">Elektrisch</option>
                <option value="software">Software</option>
                <option value="material">Materiaal</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="errorNotes" className="text-xs sm:text-sm">Notities (optioneel)</Label>
              <Textarea
                id="errorNotes"
                value={newErrorNotes}
                onChange={(e) => setNewErrorNotes(e.target.value)}
                placeholder="Extra informatie..."
                rows={3}
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              onClick={handleCreateError} 
              className="flex-1 text-xs sm:text-sm"
              size="sm"
              disabled={!newErrorMessage.trim()}
            >
              <AlertTriangle className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Foutmelding Aanmaken
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setShowErrorDialog(null);
                setNewErrorMessage('');
                setNewErrorType('general');
                setNewErrorNotes('');
              }} 
              className="flex-1 text-xs sm:text-sm"
            >
              Annuleren
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>;
};
export default Workstations;
