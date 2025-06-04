
import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import Navbar from '@/components/Navbar';
import WorkstationView from '@/components/WorkstationView';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { workstationService } from '@/services/workstationService';
import { 
  ArrowLeft, 
  Package, 
  FileText, 
  PackagePlus, 
  Edit, 
  ListCheck, 
  PackageX, 
  Calendar, 
  ListOrdered,
  CalendarArrowDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Define workstation with appropriate icon mapping
interface WorkstationWithIcon {
  id: string;
  name: string;
  description: string | null;
  icon: React.ReactNode;
}

const PersonalTasks: React.FC = () => {
  const [selectedWorkstation, setSelectedWorkstation] = useState<string | null>(null);
  const [workstations, setWorkstations] = useState<WorkstationWithIcon[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

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
          title: "Error",
          description: `Failed to load workstations: ${error.message}`,
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadWorkstations();
  }, [toast]);

  // Function to get icon based on workstation name
  const getWorkstationIcon = (name: string) => {
    const lowercaseName = name.toLowerCase();
    
    if (lowercaseName.includes('cnc')) return <FileText className="h-8 w-8" />;
    if (lowercaseName.includes('assembly')) return <Package className="h-8 w-8" />;
    if (lowercaseName.includes('warehouse')) return <PackagePlus className="h-8 w-8" />;
    if (lowercaseName.includes('cutting')) return <Edit className="h-8 w-8" />;
    if (lowercaseName.includes('quality')) return <ListCheck className="h-8 w-8" />;
    if (lowercaseName.includes('packaging')) return <PackageX className="h-8 w-8" />;
    if (lowercaseName.includes('planning')) return <Calendar className="h-8 w-8" />;
    if (lowercaseName.includes('production')) return <ListOrdered className="h-8 w-8" />;
    
    // Default icon
    return <CalendarArrowDown className="h-8 w-8" />;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
        <div className="ml-64 w-full p-6 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
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
        <div className="max-w-7xl mx-auto">
          {selectedWorkstation ? (
            <div>
              <Button 
                variant="outline" 
                className="mb-4"
                onClick={() => setSelectedWorkstation(null)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Workstations
              </Button>
              <WorkstationView 
                workstationId={selectedWorkstation} 
                onBack={() => setSelectedWorkstation(null)}
              />
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-bold mb-6">Workstations</h1>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {workstations.map((workstation) => (
                  <Card 
                    key={workstation.id} 
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setSelectedWorkstation(workstation.id)}
                  >
                    <CardContent className="p-6 flex flex-col items-center text-center">
                      <div className="bg-primary/10 p-4 rounded-full mb-4">
                        {workstation.icon}
                      </div>
                      <h3 className="text-lg font-medium mb-1">{workstation.name}</h3>
                      {workstation.description && (
                        <p className="text-sm text-muted-foreground">{workstation.description}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonalTasks;
