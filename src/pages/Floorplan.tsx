import React, { useState, useEffect, useRef } from 'react';
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
import { Upload, ImageIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';


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
  const [floorplanImage, setFloorplanImage] = useState<string>(DEFAULT_FLOORPLAN_IMAGE);
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentEmployee } = useAuth();
  const isAdmin = currentEmployee?.role === 'admin';
  const { tenant } = useTenant();

  // Fetch tenant floorplan image
  useEffect(() => {
    const loadFloorplanImage = async () => {
      try {
        const { data, error } = await supabase
          .from('floorplan_settings')
          .select('image_url')
          .maybeSingle();
        
        if (!error && data?.image_url) {
          setFloorplanImage(data.image_url);
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

      setFloorplanImage(publicUrl);
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

  const handleWorkstationPositionChange = async (workstationId: string, x: number, y: number) => {
    try {
      await floorplanService.updateWorkstationPosition(workstationId, x, y);
      toast.success('Workstation position updated');
    } catch (error) {
      console.error('Error updating workstation position:', error);
      toast.error('Failed to update workstation position');
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

  const getDefaultPosition = (workstationId: string) => {
    // Generate default positions in a grid pattern
    const index = workstations.findIndex(w => w.id === workstationId);
    const cols = Math.ceil(Math.sqrt(workstations.length));
    const row = Math.floor(index / cols);
    const col = index % cols;
    
    return {
      x: 10 + (col * 15), // Spread across width
      y: 10 + (row * 15)  // Spread across height
    };
  };

  const getWorkstationStatus = (workstationId: string) => {
    return workstationStatuses.find(s => s.workstation_id === workstationId);
  };

  const totalActiveWorkstations = workstationStatuses.filter(s => s.is_active).length;
  const totalActiveUsers = workstationStatuses.reduce((sum, s) => sum + s.active_users_count, 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="ml-64 relative w-[calc(100vw-16rem)] h-screen flex items-center justify-center overflow-hidden">
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
                      
                      const handleMouseMove = (moveE: MouseEvent) => {
                        if (!imageRef.current) return;
                        
                        const imageRect = imageRef.current.getBoundingClientRect();
                        const x = ((moveE.clientX - imageRect.left) / imageRect.width) * 100;
                        const y = ((moveE.clientY - imageRect.top) / imageRect.height) * 100;
                        
                        const clampedX = Math.max(0, Math.min(100, x));
                        const clampedY = Math.max(0, Math.min(100, y));
                        
                        handleWorkstationPositionChange(workstation.id, clampedX, clampedY);
                      };
                      
                      const handleMouseUp = () => {
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
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

              {/* Production Flow Lines */}
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
