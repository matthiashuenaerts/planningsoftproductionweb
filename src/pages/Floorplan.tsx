import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { useQuery } from '@tanstack/react-query';
import { workstationService } from '@/services/workstationService';
import { floorplanService, WorkstationPosition, ProductionFlowLine, WorkstationStatus } from '@/services/floorplanService';
import { ImageAwareWorkstationDot } from '@/components/floorplan/ImageAwareWorkstationDot';
import { ProductionFlowLine as ProductionFlowLineComponent } from '@/components/floorplan/ProductionFlowLine';
import { FloorplanToolbar } from '@/components/floorplan/FloorplanToolbar';
import { AnimatedWorkstationDetailsDialog } from '@/components/floorplan/AnimatedWorkstationDetailsDialog';
import { toast } from 'sonner';
import Navbar from '@/components/Navbar';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Upload, ImageIcon, Maximize2, Minimize2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';

interface FloorplanProject {
  project_id: string;
  project_name: string;
  workstation_id: string;
  is_active: boolean; // has active time registration at this workstation
}


// Default floorplan image
const DEFAULT_FLOORPLAN_IMAGE = "/lovable-uploads/grondplan_page-0002.jpg";

const Floorplan: React.FC = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [workstationPositions, setWorkstationPositions] = useState<WorkstationPosition[]>([]);
  const [productionFlowLines, setProductionFlowLines] = useState<ProductionFlowLine[]>([]);
  const [workstationStatuses, setWorkstationStatuses] = useState<WorkstationStatus[]>([]);
  const [selectedWorkstation, setSelectedWorkstation] = useState<any>(null);
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);
  const [imageRect, setImageRect] = useState<DOMRect | null>(null);
  const [isAddingFlowLine, setIsAddingFlowLine] = useState(false);
  const [newFlowLine, setNewFlowLine] = useState<any>(null);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [floorplanImagePath, setFloorplanImagePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [floorplanProjects, setFloorplanProjects] = useState<FloorplanProject[]>([]);
  const [hoveredBufferWorkstation, setHoveredBufferWorkstation] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentEmployee } = useAuth();
  const isAdmin = currentEmployee?.role === 'admin';
  const { tenant } = useTenant();
  const isMobile = useIsMobile();

  // Resolve signed URL for the private attachments bucket
  const signedFloorplanUrl = useSignedUrl('attachments', floorplanImagePath);
  const floorplanImage = signedFloorplanUrl || DEFAULT_FLOORPLAN_IMAGE;

  // Fetch tenant floorplan image path from DB
  useEffect(() => {
    const loadFloorplanImage = async () => {
      try {
        const { data, error } = await supabase
          .from('floorplan_settings')
          .select('image_url')
          .maybeSingle();
        
        if (!error && data?.image_url) {
          setFloorplanImagePath(data.image_url);
        }
      } catch (error) {
        console.error('Error loading floorplan image:', error);
      }
    };
    loadFloorplanImage();
  }, [tenant?.id]);

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `floorplan-${tenant?.id || 'default'}-${Date.now()}.${fileExt}`;
      const filePath = `floorplan/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      // Upsert floorplan settings
      const { data: existing } = await supabase
        .from('floorplan_settings')
        .select('id')
        .maybeSingle();

      if (existing) {
        await supabase
          .from('floorplan_settings')
          .update({ image_url: publicUrl })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('floorplan_settings')
          .insert({ image_url: publicUrl } as any);
      }

      setFloorplanImagePath(publicUrl);
      setUploadDialogOpen(false);
      toast.success('Floorplan image updated successfully');
    } catch (error) {
      console.error('Error uploading floorplan image:', error);
      toast.error('Failed to upload floorplan image');
    } finally {
      setUploading(false);
    }
  };

  // Fetch workstations
  const { data: workstations = [] } = useQuery({
    queryKey: ['workstations', tenant?.id],
    queryFn: () => workstationService.getAll(tenant?.id)
  });

  // Load initial data
  useEffect(() => {
    loadFloorplanData();
    
    // Set up real-time subscriptions
    const positionsChannel = floorplanService.subscribeToWorkstationPositions(setWorkstationPositions);
    const statusesChannel = floorplanService.subscribeToTimeRegistrations(setWorkstationStatuses);
    const flowLinesChannel = floorplanService.subscribeToProductionFlowLines(setProductionFlowLines);

    // Set up automatic status refresh every minute
    const statusInterval = setInterval(async () => {
      try {
        const statuses = await floorplanService.getWorkstationStatuses();
        setWorkstationStatuses(statuses);
      } catch (error) {
        console.error('Error refreshing workstation statuses:', error);
      }
    }, 60000); // 60 seconds

    return () => {
      positionsChannel.unsubscribe();
      statusesChannel.unsubscribe();
      flowLinesChannel.unsubscribe();
      clearInterval(statusInterval);
    };
  }, []);

  // Update container and image rects on resize and image load
  useEffect(() => {
    const updateRects = () => {
      if (containerRef.current) {
        setContainerRect(containerRef.current.getBoundingClientRect());
      }
      if (imageRef.current) {
        setImageRect(imageRef.current.getBoundingClientRect());
      }
    };

    updateRects();
    window.addEventListener('resize', updateRects);
    
    // Also update when image loads
    const imageElement = imageRef.current;
    if (imageElement) {
      imageElement.addEventListener('load', updateRects);
      return () => {
        window.removeEventListener('resize', updateRects);
        imageElement.removeEventListener('load', updateRects);
      };
    }
    
    return () => window.removeEventListener('resize', updateRects);
  }, []);

  const loadFloorplanData = async () => {
    try {
      const [positions, flowLines, statuses] = await Promise.all([
        floorplanService.getWorkstationPositions(),
        floorplanService.getProductionFlowLines(),
        floorplanService.getWorkstationStatuses()
      ]);
      
      setWorkstationPositions(positions);
      setProductionFlowLines(flowLines);
      setWorkstationStatuses(statuses);
    } catch (error) {
      console.error('Error loading floorplan data:', error);
      toast.error('Failed to load floorplan data');
    }
  };

  // Fetch projects and determine their locations on the floorplan
  const loadFloorplanProjects = async () => {
    try {
      // Get all tasks that are TODO or IN_PROGRESS with their workstation links
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select(`
          id, status,
          task_workstation_links(workstation_id),
          phases!inner(project_id, projects!inner(id, name))
        `)
        .in('status', ['TODO', 'IN_PROGRESS']);
      
      if (error) throw error;

      // Get active time registrations to know which projects are actively being worked on at which workstation
      const { data: activeRegs } = await supabase
        .from('time_registrations')
        .select(`
          task_id,
          tasks!inner(
            task_workstation_links(workstation_id),
            phases!inner(project_id)
          )
        `)
        .eq('is_active', true);

      // Build a set of "projectId::workstationId" that are actively being worked on
      const activeProjectWorkstations = new Set<string>();
      activeRegs?.forEach((reg: any) => {
        const projectId = reg.tasks?.phases?.project_id;
        reg.tasks?.task_workstation_links?.forEach((link: any) => {
          if (projectId && link.workstation_id) {
            activeProjectWorkstations.add(`${projectId}::${link.workstation_id}`);
          }
        });
      });

      // Group by project+workstation, deduplicate
      const projectMap = new Map<string, FloorplanProject>();
      tasks?.forEach((task: any) => {
        const projectId = task.phases?.projects?.id;
        const projectName = task.phases?.projects?.name;
        task.task_workstation_links?.forEach((link: any) => {
          if (projectId && link.workstation_id) {
            const key = `${projectId}::${link.workstation_id}`;
            if (!projectMap.has(key)) {
              projectMap.set(key, {
                project_id: projectId,
                project_name: projectName,
                workstation_id: link.workstation_id,
                is_active: activeProjectWorkstations.has(key)
              });
            }
          }
        });
      });

      setFloorplanProjects(Array.from(projectMap.values()));
    } catch (error) {
      console.error('Error loading floorplan projects:', error);
    }
  };

  useEffect(() => {
    loadFloorplanProjects();
    const interval = setInterval(loadFloorplanProjects, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleWorkstationPositionChange = async (workstationId: string, x: number, y: number) => {
    // Optimistically update local state so the dot moves visually
    setWorkstationPositions(prev => {
      const existing = prev.find(p => p.workstation_id === workstationId);
      if (existing) {
        return prev.map(p => p.workstation_id === workstationId ? { ...p, x_position: x, y_position: y } : p);
      }
      return [...prev, { id: workstationId, workstation_id: workstationId, x_position: x, y_position: y, buffer_x_position: x + 3, buffer_y_position: y + 5, created_at: '', updated_at: '' }];
    });
  };

  // Save to DB only on mouse up (debounced)
  const saveWorkstationPosition = async (workstationId: string, x: number, y: number) => {
    try {
      await floorplanService.updateWorkstationPosition(workstationId, x, y);
    } catch (error) {
      console.error('Error updating workstation position:', error);
      toast.error('Failed to update workstation position');
    }
  };

  const handleBufferPositionChange = async (workstationId: string, x: number, y: number) => {
    // Optimistically update local state
    setWorkstationPositions(prev => {
      const existing = prev.find(p => p.workstation_id === workstationId);
      if (existing) {
        return prev.map(p => p.workstation_id === workstationId ? { ...p, buffer_x_position: x, buffer_y_position: y } : p);
      }
      return prev;
    });
  };

  const saveBufferPosition = async (workstationId: string, x: number, y: number) => {
    try {
      await floorplanService.updateBufferPosition(workstationId, x, y);
    } catch (error) {
      console.error('Error updating buffer position:', error);
      toast.error('Failed to update buffer position');
    }
  };

  const handleAddProductionFlowLine = async (line: Omit<ProductionFlowLine, 'id' | 'created_at' | 'updated_at' | 'is_active'>) => {
    try {
      await floorplanService.createProductionFlowLine({ ...line, is_active: true });
      toast.success('Production flow line added');
    } catch (error) {
      console.error('Error adding production flow line:', error);
      toast.error('Failed to add production flow line');
    }
  };

  const handleDeleteProductionFlowLine = async (id: string) => {
    try {
      await floorplanService.deleteProductionFlowLine(id);
      toast.success('Production flow line deleted');
    } catch (error) {
      console.error('Error deleting production flow line:', error);
      toast.error('Failed to delete production flow line');
    }
  };

  const handleFloorplanClick = (e: React.MouseEvent) => {
    if (!isAddingFlowLine || !newFlowLine || !imageRect) return;

    const x = ((e.clientX - imageRect.left) / imageRect.width) * 100;
    const y = ((e.clientY - imageRect.top) / imageRect.height) * 100;

    if (!startPoint) {
      setStartPoint({ x, y });
      toast.info('Click to set the end point of the flow line');
    } else {
      // Create the flow line
      handleAddProductionFlowLine({
        ...newFlowLine,
        start_x: startPoint.x,
        start_y: startPoint.y,
        end_x: x,
        end_y: y
      });
      
      setIsAddingFlowLine(false);
      setNewFlowLine(null);
      setStartPoint(null);
    }
  };

  const getWorkstationPosition = (workstationId: string) => {
    const position = workstationPositions.find(p => p.workstation_id === workstationId);
    return position ? { x: position.x_position, y: position.y_position } : getDefaultPosition(workstationId);
  };

  const getBufferPosition = (workstationId: string) => {
    const position = workstationPositions.find(p => p.workstation_id === workstationId);
    if (position && (position.buffer_x_position || position.buffer_y_position)) {
      return { x: position.buffer_x_position, y: position.buffer_y_position };
    }
    // Fallback: offset from workstation position
    const wsPos = getWorkstationPosition(workstationId);
    return { x: wsPos.x + 3, y: wsPos.y + 5 };
  };

  const getDefaultPosition = (workstationId: string) => {
    const index = workstations.findIndex(w => w.id === workstationId);
    const cols = Math.ceil(Math.sqrt(workstations.length));
    const row = Math.floor(index / cols);
    const col = index % cols;
    
    return {
      x: 10 + (col * 15),
      y: 10 + (row * 15)
    };
  };

  // Group projects by position for stacking
  const projectNametags = useMemo(() => {
    return floorplanProjects.map((fp, idx) => {
      const pos = fp.is_active 
        ? getWorkstationPosition(fp.workstation_id) 
        : getBufferPosition(fp.workstation_id);
      
      // Find how many other projects share the same workstation+active status for offset
      const siblings = floorplanProjects.filter(
        p => p.workstation_id === fp.workstation_id && p.is_active === fp.is_active
      );
      const siblingIndex = siblings.findIndex(p => p.project_id === fp.project_id);
      
      return {
        ...fp,
        x: pos.x,
        y: pos.y + (siblingIndex * 2.5), // stack vertically
      };
    });
  }, [floorplanProjects, workstationPositions, workstations]);

  const getWorkstationStatus = (workstationId: string) => {
    return workstationStatuses.find(s => s.workstation_id === workstationId);
  };

  const totalActiveWorkstations = workstationStatuses.filter(s => s.is_active).length;
  const totalActiveUsers = workstationStatuses.reduce((sum, s) => sum + s.active_users_count, 0);

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'min-h-screen'} bg-background`}>
      {!isFullscreen && <Navbar />}
      <div className={`${isFullscreen ? 'w-screen h-screen' : 'ml-64 relative w-[calc(100vw-16rem)] h-screen'} flex items-center justify-center overflow-hidden relative`}>
        {/* Fullscreen toggle button */}
        <Button
          variant="outline"
          size="icon"
          className="absolute top-3 right-3 z-20 bg-background/80 backdrop-blur-sm"
          onClick={() => setIsFullscreen(!isFullscreen)}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>

        {/* Image Container */}
        <div className="relative w-full h-full flex items-center justify-center">
          <div className="relative inline-block">
            {/* Background Image */}
            <img
              ref={imageRef}
              src={floorplanImage}
              alt="Production Hall Floorplan"
              className="block max-w-full max-h-full object-contain"
              onLoad={() => {
                // Update container rect when image loads
                if (containerRef.current && imageRef.current) {
                  const imageRect = imageRef.current.getBoundingClientRect();
                  setImageRect(imageRect);
                  setContainerRect(imageRef.current.getBoundingClientRect());
                }
              }}
            />

            {/* Interactive Container - EXACTLY matches the image size and position */}
            <div
              ref={containerRef}
              className="absolute inset-0 cursor-pointer"
              onClick={handleFloorplanClick}
              style={{ userSelect: 'none' }}
            >
              {/* Workstation Dots */}
              {workstations.map((workstation) => {
                const position = getWorkstationPosition(workstation.id);
                return (
                  <div
                    key={workstation.id}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
                      isEditing ? 'cursor-move' : 'cursor-pointer'
                    }`}
                    style={{
                      left: `${position.x}%`,
                      top: `${position.y}%`,
                      zIndex: 10,
                    }}
                    onMouseDown={(e) => {
                      if (!isEditing) return;
                      e.preventDefault();
                      e.stopPropagation();
                      
                      let lastX = 0, lastY = 0;
                      const handleMouseMove = (moveE: MouseEvent) => {
                        if (!imageRef.current) return;
                        
                        const imageRect = imageRef.current.getBoundingClientRect();
                        const x = ((moveE.clientX - imageRect.left) / imageRect.width) * 100;
                        const y = ((moveE.clientY - imageRect.top) / imageRect.height) * 100;
                        
                        lastX = Math.max(0, Math.min(100, x));
                        lastY = Math.max(0, Math.min(100, y));
                        
                        handleWorkstationPositionChange(workstation.id, lastX, lastY);
                      };
                      
                      const handleMouseUp = () => {
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                        if (lastX && lastY) {
                          saveWorkstationPosition(workstation.id, lastX, lastY);
                        }
                      };
                      
                      document.addEventListener('mousemove', handleMouseMove);
                      document.addEventListener('mouseup', handleMouseUp);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isEditing) setSelectedWorkstation(workstation);
                    }}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 border-white shadow-lg ${
                      !getWorkstationStatus(workstation.id) ? 'bg-orange-500' :
                      getWorkstationStatus(workstation.id)?.has_error ? 'bg-red-500' :
                      getWorkstationStatus(workstation.id)?.is_active ? 'bg-green-500' : 'bg-orange-500'
                    }`}>
                      {getWorkstationStatus(workstation.id)?.is_active && getWorkstationStatus(workstation.id)?.active_users_count > 0 && (
                        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-background border flex items-center justify-center text-xs">
                          {getWorkstationStatus(workstation.id)?.active_users_count}
                        </div>
                      )}
                    </div>
                    {isEditing && (
                      <div className="absolute top-5 left-1/2 transform -translate-x-1/2 bg-background border rounded px-2 py-1 text-xs whitespace-nowrap shadow-lg">
                        {workstation.name}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Buffer hover zones - draggable in edit mode */}
              {workstations.map((ws) => {
                const bufferPos = getBufferPosition(ws.id);
                const hasBufferedProjects = floorplanProjects.some(p => p.workstation_id === ws.id && !p.is_active);
                // Show in edit mode always, otherwise only when there are buffered projects
                if (!isEditing && !hasBufferedProjects) return null;
                return (
                  <div
                    key={`buffer-zone-${ws.id}`}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
                      isEditing ? 'cursor-move' : ''
                    }`}
                    style={{
                      left: `${bufferPos.x}%`,
                      top: `${bufferPos.y}%`,
                      width: isEditing ? '24px' : '40px',
                      height: isEditing ? '24px' : '40px',
                      zIndex: isEditing ? 12 : 4,
                    }}
                    onMouseEnter={() => !isEditing && setHoveredBufferWorkstation(ws.id)}
                    onMouseLeave={() => !isEditing && setHoveredBufferWorkstation(null)}
                    onMouseDown={(e) => {
                      if (!isEditing) return;
                      e.preventDefault();
                      e.stopPropagation();
                      
                      let lastBufX = 0, lastBufY = 0;
                      const handleMouseMove = (moveE: MouseEvent) => {
                        if (!imageRef.current) return;
                        const rect = imageRef.current.getBoundingClientRect();
                        lastBufX = Math.max(0, Math.min(100, ((moveE.clientX - rect.left) / rect.width) * 100));
                        lastBufY = Math.max(0, Math.min(100, ((moveE.clientY - rect.top) / rect.height) * 100));
                        handleBufferPositionChange(ws.id, lastBufX, lastBufY);
                      };
                      
                      const handleMouseUp = () => {
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                        if (lastBufX && lastBufY) {
                          saveBufferPosition(ws.id, lastBufX, lastBufY);
                        }
                      };
                      
                      document.addEventListener('mousemove', handleMouseMove);
                      document.addEventListener('mouseup', handleMouseUp);
                    }}
                  >
                    {isEditing ? (
                      <div className="w-3 h-3 rounded-sm bg-amber-500/70 border border-amber-400 mx-auto mt-[6px]" />
                    ) : (
                      <div className="w-2 h-2 rounded-sm bg-muted-foreground/30 mx-auto mt-[16px]" />
                    )}
                    {isEditing && (
                      <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-amber-500/90 text-white rounded px-1.5 py-0.5 text-[9px] whitespace-nowrap shadow">
                        Buffer: {ws.name}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Project Nametags */}
              {projectNametags.map((tag) => {
                // Hide buffer tags unless hovered
                if (!tag.is_active && hoveredBufferWorkstation !== tag.workstation_id) return null;
                return (
                  <div
                    key={`${tag.project_id}-${tag.workstation_id}`}
                    className="absolute transform -translate-x-1/2 pointer-events-none"
                    style={{
                      left: `${tag.x}%`,
                      top: `${tag.y + 2.5}%`,
                      zIndex: tag.is_active ? 5 : 15,
                    }}
                  >
                    <div className={`px-1.5 py-0.5 rounded text-[9px] font-medium whitespace-nowrap shadow border ${
                      tag.is_active 
                        ? 'bg-primary text-primary-foreground border-primary' 
                        : 'bg-muted text-muted-foreground border-border'
                    }`}>
                      {tag.project_name}
                    </div>
                  </div>
                );
              })}

              {imageRef.current && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {productionFlowLines.map((line) => (
                    <ProductionFlowLineComponent
                      key={line.id}
                      line={line}
                      containerRect={imageRef.current?.getBoundingClientRect() || null}
                      isEditing={isEditing}
                      onDelete={handleDeleteProductionFlowLine}
                    />
                  ))}
                </svg>
              )}

              {/* Start Point Indicator for Flow Line */}
              {startPoint && isAddingFlowLine && (
                <div
                  className="absolute w-3 h-3 bg-blue-500 rounded-full border-2 border-white transform -translate-x-1/2 -translate-y-1/2 animate-pulse"
                  style={{
                    left: `${startPoint.x}%`,
                    top: `${startPoint.y}%`,
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <FloorplanToolbar
          isEditing={isEditing}
          onToggleEditing={() => setIsEditing(!isEditing)}
          onAddFlowLine={(line) => {
            setNewFlowLine(line);
            setIsAddingFlowLine(true);
            toast.info('Click on the floorplan to set the start point');
          }}
          totalWorkstations={workstations.length}
          activeWorkstations={totalActiveWorkstations}
          totalActiveUsers={totalActiveUsers}
          isAdmin={isAdmin}
        />

        {/* Admin: Upload Floorplan Image */}
        {isAdmin && (
          <div className="absolute top-4 right-4 z-10">
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="bg-background/95 backdrop-blur shadow-lg">
                  <Upload className="h-4 w-4 mr-2" />
                  Change Floorplan Image
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Floorplan Image</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Upload a new floorplan image (JPG, PNG). This will replace the current image for your organization.
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="floorplan-upload">Select Image</Label>
                    <Input
                      id="floorplan-upload"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploading}
                      className="mt-1"
                    />
                  </div>
                  {uploading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      Uploading...
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 right-4 bg-background/95 backdrop-blur rounded-lg shadow-lg p-4">
          <h3 className="text-sm font-semibold mb-3">Legend</h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>In Use (Active)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              <span>Not in Use</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>Error Status</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-1 bg-blue-500"></div>
              <span>Production Flow</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="px-1 py-0.5 rounded text-[8px] bg-primary text-primary-foreground">AB</div>
              <span>Active Project</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="px-1 py-0.5 rounded text-[8px] bg-muted text-muted-foreground border">AB</div>
              <span>Buffered Project</span>
            </div>
          </div>
        </div>
      </div>

      {/* Animated Workstation Details Dialog */}
      <AnimatedWorkstationDetailsDialog
        workstation={selectedWorkstation}
        status={selectedWorkstation ? getWorkstationStatus(selectedWorkstation.id) : undefined}
        isOpen={!!selectedWorkstation}
        onClose={() => setSelectedWorkstation(null)}
      />
    </div>
  );
};

export default Floorplan;
