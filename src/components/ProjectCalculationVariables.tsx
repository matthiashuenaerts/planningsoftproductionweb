import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { projectCalculationService, ProjectCalculationVariables } from '@/services/projectCalculationService';

interface ProjectCalculationVariablesProps {
  projectId: string;
}

const ProjectCalculationVariablesComponent: React.FC<ProjectCalculationVariablesProps> = ({ projectId }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [variables, setVariables] = useState<Partial<ProjectCalculationVariables>>({
    aantal_objecten: 0,
    aantal_kasten: 0,
    aantal_stuks: 0,
    aantal_platen: 0,
    aantal_zaagsnedes: 0,
    aantal_lopende_meters_zaagsnede: 0,
    aantal_verschillende_kantenbanden: 0,
    aantal_lopende_meter_kantenbanden: 0,
    aantal_drevel_programmas: 0,
    aantal_cnc_programmas: 0,
    aantal_boringen: 0,
    aantal_kasten_te_monteren: 0,
    aantal_manueel_te_monteren_kasten: 0,
    aantal_manueel_te_monteren_objecten: 0,
  });

  useEffect(() => {
    loadVariables();
  }, [projectId]);

  const loadVariables = async () => {
    try {
      setLoading(true);
      const data = await projectCalculationService.getVariablesByProject(projectId);
      if (data) {
        setVariables(data);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to load calculation variables: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await projectCalculationService.createOrUpdateVariables(projectId, variables);
      toast({
        title: 'Success',
        description: 'Calculation variables saved successfully'
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: `Failed to save calculation variables: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof ProjectCalculationVariables, value: string) => {
    const numValue = parseInt(value) || 0;
    setVariables(prev => ({ ...prev, [field]: numValue }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Berekening Variabelen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="aantal_objecten">Aantal Objecten</Label>
            <Input
              id="aantal_objecten"
              type="number"
              min="0"
              value={variables.aantal_objecten || 0}
              onChange={(e) => handleInputChange('aantal_objecten', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_kasten">Aantal Kasten</Label>
            <Input
              id="aantal_kasten"
              type="number"
              min="0"
              value={variables.aantal_kasten || 0}
              onChange={(e) => handleInputChange('aantal_kasten', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_stuks">Aantal Stuks</Label>
            <Input
              id="aantal_stuks"
              type="number"
              min="0"
              value={variables.aantal_stuks || 0}
              onChange={(e) => handleInputChange('aantal_stuks', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_platen">Aantal Platen</Label>
            <Input
              id="aantal_platen"
              type="number"
              min="0"
              value={variables.aantal_platen || 0}
              onChange={(e) => handleInputChange('aantal_platen', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_zaagsnedes">Aantal Zaagsnedes</Label>
            <Input
              id="aantal_zaagsnedes"
              type="number"
              min="0"
              value={variables.aantal_zaagsnedes || 0}
              onChange={(e) => handleInputChange('aantal_zaagsnedes', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_lopende_meters_zaagsnede">Aantal Lopende Meters Zaagsnede</Label>
            <Input
              id="aantal_lopende_meters_zaagsnede"
              type="number"
              min="0"
              value={variables.aantal_lopende_meters_zaagsnede || 0}
              onChange={(e) => handleInputChange('aantal_lopende_meters_zaagsnede', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_verschillende_kantenbanden">Aantal Verschillende Kantenbanden</Label>
            <Input
              id="aantal_verschillende_kantenbanden"
              type="number"
              min="0"
              value={variables.aantal_verschillende_kantenbanden || 0}
              onChange={(e) => handleInputChange('aantal_verschillende_kantenbanden', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_lopende_meter_kantenbanden">Aantal Lopende Meter Kantenbanden</Label>
            <Input
              id="aantal_lopende_meter_kantenbanden"
              type="number"
              min="0"
              value={variables.aantal_lopende_meter_kantenbanden || 0}
              onChange={(e) => handleInputChange('aantal_lopende_meter_kantenbanden', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_drevel_programmas">Aantal Drevel Programma's</Label>
            <Input
              id="aantal_drevel_programmas"
              type="number"
              min="0"
              value={variables.aantal_drevel_programmas || 0}
              onChange={(e) => handleInputChange('aantal_drevel_programmas', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_cnc_programmas">Aantal CNC Programma's</Label>
            <Input
              id="aantal_cnc_programmas"
              type="number"
              min="0"
              value={variables.aantal_cnc_programmas || 0}
              onChange={(e) => handleInputChange('aantal_cnc_programmas', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_boringen">Aantal Boringen</Label>
            <Input
              id="aantal_boringen"
              type="number"
              min="0"
              value={variables.aantal_boringen || 0}
              onChange={(e) => handleInputChange('aantal_boringen', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_kasten_te_monteren">Aantal Kasten te Monteren</Label>
            <Input
              id="aantal_kasten_te_monteren"
              type="number"
              min="0"
              value={variables.aantal_kasten_te_monteren || 0}
              onChange={(e) => handleInputChange('aantal_kasten_te_monteren', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_manueel_te_monteren_kasten">Aantal Manueel te Monteren Kasten</Label>
            <Input
              id="aantal_manueel_te_monteren_kasten"
              type="number"
              min="0"
              value={variables.aantal_manueel_te_monteren_kasten || 0}
              onChange={(e) => handleInputChange('aantal_manueel_te_monteren_kasten', e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="aantal_manueel_te_monteren_objecten">Aantal Manueel te Monteren Objecten</Label>
            <Input
              id="aantal_manueel_te_monteren_objecten"
              type="number"
              min="0"
              value={variables.aantal_manueel_te_monteren_objecten || 0}
              onChange={(e) => handleInputChange('aantal_manueel_te_monteren_objecten', e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Variables'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectCalculationVariablesComponent;