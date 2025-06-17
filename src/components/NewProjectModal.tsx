
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { projectService, phaseService } from '@/services/dataService';
import { useLanguage } from '@/context/LanguageContext';
import { Phase } from '@/services/dataService';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Plus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface NewProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface PhaseInput {
  id: string;
  name: string;
}

export const NewProjectModal = ({ open, onOpenChange, onSuccess }: NewProjectModalProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    client: '',
    description: '',
    start_date: '',
    installation_date: ''
  });
  const [isCreating, setIsCreating] = useState(false);
  const [phases, setPhases] = useState<PhaseInput[]>([]);

  useEffect(() => {
    if (open) {
      setPhases([{ id: uuidv4(), name: t('phase') + ' 1' }]);
    }
  }, [open, t]);

  const handlePhaseNameChange = (id: string, name: string) => {
    setPhases(phases.map(phase => phase.id === id ? { ...phase, name } : phase));
  };

  const addPhase = () => {
    setPhases([...phases, { id: uuidv4(), name: t('phase') + ' ' + (phases.length + 1) }]);
  };

  const removePhase = (id: string) => {
    setPhases(phases.filter(phase => phase.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isCreating) return; // Prevent multiple submissions
    
    try {
      setIsCreating(true);
      
      // Create project
      const projectData = {
        name: formData.name,
        client: formData.client,
        description: formData.description,
        start_date: formData.start_date,
        installation_date: formData.installation_date,
        status: 'planned' as const,
        progress: 0
      };
      
      const newProject = await projectService.create(projectData);
      
      // Create phases for the project
      await Promise.all(
        phases.map(phase => 
          phaseService.create({
            id: phase.id,
            name: phase.name,
            project_id: newProject.id,
            start_date: formData.start_date,
            end_date: formData.installation_date,
            progress: 0
          })
        )
      );

      toast({
        title: t('success'),
        description: t('project_created_successfully')
      });
      
      // Reset form
      setFormData({
        name: '',
        client: '',
        description: '',
        start_date: '',
        installation_date: ''
      });
      setPhases([]);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: t('error'),
        description: t('failed_to_create_project', { message: error.message }),
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('create_new_project')}</DialogTitle>
          <DialogDescription>
            {t('create_new_project_description')}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">{t('project_name')}</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="client">{t('client')}</Label>
            <Input
              id="client"
              value={formData.client}
              onChange={(e) => setFormData({ ...formData, client: e.target.value })}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="description">{t('description')}</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_date">{t('start_date')}</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="installation_date">{t('installation_date')}</Label>
              <Input
                id="installation_date"
                type="date"
                value={formData.installation_date}
                onChange={(e) => setFormData({ ...formData, installation_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <Label>{t('phases')}</Label>
            <Accordion type="multiple">
              {phases.map((phase, index) => (
                <AccordionItem key={phase.id} value={phase.id} className="border-b">
                  <AccordionTrigger>
                    {phase.name || `${t('phase')} ${index + 1}`}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <Label htmlFor={`phase-name-${phase.id}`}>{t('phase_name')}</Label>
                        <Input
                          type="text"
                          id={`phase-name-${phase.id}`}
                          value={phase.name}
                          onChange={(e) => handlePhaseNameChange(phase.id, e.target.value)}
                        />
                      </div>
                    </div>
                    <Button variant="destructive" size="sm" className="mt-2" onClick={() => removePhase(phase.id)}>
                      {t('remove_phase')}
                    </Button>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <Button variant="outline" size="sm" className="mt-2" onClick={addPhase}>
              <Plus className="mr-2 h-4 w-4" />
              {t('add_phase')}
            </Button>
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              {t('cancel')}
            </Button>
            <Button 
              type="submit" 
              disabled={isCreating || !formData.name || !formData.client || !formData.start_date || !formData.installation_date}
            >
              {isCreating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {t('creating_project')}
                </>
              ) : (
                t('create_project')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
