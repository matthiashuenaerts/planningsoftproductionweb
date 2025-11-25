import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { cabinetService } from '@/services/cabinetService';
import { useLanguage } from '@/context/LanguageContext';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

const NewCabinetProject = () => {
  const navigate = useNavigate();
  const { createLocalizedPath } = useLanguage();
  const isMobile = useIsMobile();
  
  const [formData, setFormData] = useState({
    name: '',
    client_name: '',
    client_address: '',
    project_number: '',
    currency: 'EUR',
    units: 'metric' as 'metric' | 'imperial',
    notes: '',
  });

  const createMutation = useMutation({
    mutationFn: () => cabinetService.createProject(formData),
    onSuccess: (data) => {
      toast.success('Project created successfully');
      navigate(createLocalizedPath(`/calculation/${data.id}`));
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create project');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Project name is required');
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="flex min-h-screen">
      {!isMobile && (
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
      )}
      {isMobile && <Navbar />}
      
      <div className={`w-full p-6 ${!isMobile ? 'ml-64' : ''}`}>
        <div className="max-w-3xl mx-auto">
          <Button 
            variant="outline" 
            onClick={() => navigate(createLocalizedPath('/calculation'))}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
          </Button>

          <Card>
            <CardHeader>
              <CardTitle>New Cabinet Project</CardTitle>
              <CardDescription>
                Create a new project to start configuring cabinets and calculating costs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Project Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Kitchen Renovation - Smith Residence"
                    required
                  />
                </div>

                {/* Client Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="client_name">Client Name</Label>
                    <Input
                      id="client_name"
                      value={formData.client_name}
                      onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                      placeholder="John Smith"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="project_number">Project Number</Label>
                    <Input
                      id="project_number"
                      value={formData.project_number}
                      onChange={(e) => setFormData({ ...formData, project_number: e.target.value })}
                      placeholder="2024-001"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client_address">Client Address</Label>
                  <Textarea
                    id="client_address"
                    value={formData.client_address}
                    onChange={(e) => setFormData({ ...formData, client_address: e.target.value })}
                    placeholder="123 Main Street, City, Country"
                    rows={2}
                  />
                </div>

                {/* Project Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(value) => setFormData({ ...formData, currency: value })}
                    >
                      <SelectTrigger id="currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="units">Units</Label>
                    <Select
                      value={formData.units}
                      onValueChange={(value: 'metric' | 'imperial') => setFormData({ ...formData, units: value })}
                    >
                      <SelectTrigger id="units">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="metric">Metric (mm)</SelectItem>
                        <SelectItem value="imperial">Imperial (inches)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Add any additional notes or requirements..."
                    rows={4}
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(createLocalizedPath('/calculation'))}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating...' : 'Create Project'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default NewCabinetProject;