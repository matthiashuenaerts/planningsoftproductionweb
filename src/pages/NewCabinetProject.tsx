import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cabinetService } from '@/services/cabinetService';
import { useToast } from '@/hooks/use-toast';

export default function NewCabinetProject() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, createLocalizedPath } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    client_name: '',
    client_address: '',
    project_number: '',
    currency: 'EUR',
    units: 'metric',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: t('calc_error'),
        description: t('calc_project_name_required'),
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const project = await cabinetService.createProject({
        name: formData.name,
        client_name: formData.client_name || null,
        client_address: formData.client_address || null,
        project_number: formData.project_number || null,
        currency: formData.currency,
        units: formData.units,
        notes: formData.notes || null,
        status: 'draft',
      });

      toast({
        title: t('calc_success'),
        description: t('calc_project_created'),
      });

      navigate(createLocalizedPath(`/calculation/project/${project.id}`));
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: t('calc_error'),
        description: t('calc_failed_create_project'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Button
        variant="ghost"
        onClick={() => navigate(createLocalizedPath('/calculation'))}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t('calc_back_to_projects')}
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{t('calc_new_cabinet_project')}</CardTitle>
          <CardDescription>
            {t('calc_create_new_project_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">{t('calc_project_name')} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Kitchen Remodel"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client_name">{t('calc_client_name')}</Label>
              <Input
                id="client_name"
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client_address">{t('calc_client_address')}</Label>
              <Input
                id="client_address"
                value={formData.client_address}
                onChange={(e) => setFormData({ ...formData, client_address: e.target.value })}
                placeholder="123 Main St, City, Country"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project_number">{t('calc_project_number_field')}</Label>
              <Input
                id="project_number"
                value={formData.project_number}
                onChange={(e) => setFormData({ ...formData, project_number: e.target.value })}
                placeholder="PRJ-2025-001"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency">{t('calc_currency')}</Label>
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
                <Label htmlFor="units">{t('calc_units')}</Label>
                <Select
                  value={formData.units}
                  onValueChange={(value) => setFormData({ ...formData, units: value })}
                >
                  <SelectTrigger id="units">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="metric">{t('calc_metric')}</SelectItem>
                    <SelectItem value="imperial">{t('calc_imperial')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">{t('calc_notes')}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('calc_additional_notes')}
                rows={4}
              />
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? t('calc_creating') : t('calc_create_project')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(createLocalizedPath('/calculation'))}
              >
                {t('calc_cancel')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
