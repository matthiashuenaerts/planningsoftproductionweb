import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Download, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type CabinetConfiguration = Database['public']['Tables']['cabinet_configurations']['Row'];
type CabinetQuote = Database['public']['Tables']['cabinet_quotes']['Row'];

interface CabinetQuotePanelProps {
  projectId: string;
  configurations: CabinetConfiguration[];
}

export function CabinetQuotePanel({ projectId, configurations }: CabinetQuotePanelProps) {
  const { toast } = useToast();
  const [quote, setQuote] = useState<CabinetQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadQuote();
  }, [projectId]);

  const loadQuote = async () => {
    try {
      const { data, error } = await supabase
        .from('cabinet_quotes')
        .select('*')
        .eq('project_id', projectId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setQuote(data);
    } catch (error) {
      console.error('Error loading quote:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateQuote = async () => {
    setGenerating(true);
    try {
      // Simple calculation based on configurations
      const materialsEstimate = configurations.reduce((sum, config) => {
        const area = Number(config.width) * Number(config.height) * Number(config.depth) / 1000000;
        return sum + area * 50; // €50 per square meter estimate
      }, 0);

      const laborMinutes = configurations.reduce((sum, config) => {
        return sum + 120 + (config.horizontal_divisions || 0) * 30 + (config.vertical_divisions || 0) * 20;
      }, 0);

      const laborCost = (laborMinutes / 60) * 45; // €45 per hour
      const hardwareCost = configurations.length * 25; // €25 per cabinet estimate
      const subtotal = materialsEstimate + laborCost + hardwareCost;
      const overheadCost = subtotal * 0.15;
      const marginAmount = (subtotal + overheadCost) * 0.20;
      const taxAmount = (subtotal + overheadCost + marginAmount) * 0.21;
      const totalCost = subtotal + overheadCost + marginAmount + taxAmount;

      const { data, error } = await supabase
        .from('cabinet_quotes')
        .insert({
          project_id: projectId,
          materials_cost: materialsEstimate,
          hardware_cost: hardwareCost,
          labor_minutes: laborMinutes,
          labor_cost: laborCost,
          overhead_cost: overheadCost,
          margin_amount: marginAmount,
          tax_amount: taxAmount,
          subtotal,
          total_cost: totalCost,
        })
        .select()
        .single();

      if (error) throw error;
      setQuote(data);

      toast({
        title: 'Success',
        description: 'Quote generated successfully',
      });
    } catch (error) {
      console.error('Error generating quote:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate quote',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading quote...</div>;
  }

  if (!quote) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-muted-foreground">No quote generated yet</p>
          <Button onClick={generateQuote} disabled={generating || configurations.length === 0}>
            <FileText className="mr-2 h-4 w-4" />
            {generating ? 'Generating...' : 'Generate Quote'}
          </Button>
          {configurations.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Add cabinet configurations first
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quote Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Materials:</span>
              <span className="font-medium">€{Number(quote.materials_cost).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Hardware:</span>
              <span className="font-medium">€{Number(quote.hardware_cost).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Labor ({quote.labor_minutes} min):
              </span>
              <span className="font-medium">€{Number(quote.labor_cost).toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium">€{Number(quote.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Overhead ({Number(quote.overhead_percentage)}%):
              </span>
              <span className="font-medium">€{Number(quote.overhead_cost).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Margin ({Number(quote.margin_percentage)}%):
              </span>
              <span className="font-medium">€{Number(quote.margin_amount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Tax ({Number(quote.tax_percentage)}%):
              </span>
              <span className="font-medium">€{Number(quote.tax_amount).toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span>€{Number(quote.total_cost).toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
            <Button variant="outline" className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>

          <Button onClick={generateQuote} disabled={generating} className="w-full">
            {generating ? 'Regenerating...' : 'Regenerate Quote'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
