import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { KeyboardScannerListener } from '@/components/KeyboardScannerListener';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const ScannerPage: React.FC = () => {
  const { workstationId } = useParams<{ workstationId: string }>();
  const { toast } = useToast();
  const [workstationName, setWorkstationName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workstationId) return;
    const load = async () => {
      const { data, error } = await supabase
        .from('workstations')
        .select('name')
        .eq('id', workstationId)
        .single();
      if (error || !data) {
        toast({ title: 'Werkstation niet gevonden', variant: 'destructive' });
      } else {
        setWorkstationName(data.name);
        document.title = `Scanner - ${data.name}`;
      }
      setLoading(false);
    };
    load();
  }, [workstationId, toast]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workstationName) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Werkstation niet gevonden.</p>
      </div>
    );
  }

  return (
    <KeyboardScannerListener
      isOpen={true}
      onClose={() => window.close()}
      onCodeDetected={() => {}}
      workstationName={workstationName}
      workstationId={workstationId}
      standalone={true}
    />
  );
};

export default ScannerPage;
