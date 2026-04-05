import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Plus, Trash2, Mail, Upload, FileText, Download } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { measurementService, ProjectMeasurement } from '@/services/measurementService';
import { supabase } from '@/integrations/supabase/client';
import { createSignedUrl } from '@/lib/storageUtils';

interface Props {
  projectId: string;
  projectName: string;
  clientName: string;
  clientEmail?: string;
  projectAddress?: string;
}

const ProjectMeasurementTab: React.FC<Props> = ({ projectId, projectName, clientName, clientEmail, projectAddress }) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { tenant } = useTenant();
  const { currentEmployee } = useAuth();

  const [measurements, setMeasurements] = useState<ProjectMeasurement[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [newDate, setNewDate] = useState('');
  const [newMeasurer, setNewMeasurer] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newEmail, setNewEmail] = useState(clientEmail || '');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [measurementsData, filesData] = await Promise.all([
        measurementService.getByProject(projectId),
        measurementService.getFiles(projectId),
      ]);
      setMeasurements(measurementsData);
      setFiles(filesData);

      // Load employees with measurer role or admin/manager
      const { data: emps } = await supabase.from('employees').select('id, name, role');
      setEmployees((emps ?? []).filter((e: any) => ['admin', 'manager', 'measurer'].includes(e.role)));
    } catch (err: any) {
      console.error('Error loading measurements:', err);
    } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateMeasurement = async () => {
    if (!newDate) {
      toast({ title: t('error'), description: 'Please select a date', variant: 'destructive' });
      return;
    }
    try {
      await measurementService.create({
        project_id: projectId,
        measurement_date: newDate,
        measurer_id: newMeasurer || null,
        notes: newNotes || null,
        customer_email: newEmail || null,
        status: 'scheduled',
      });
      toast({ title: t('success'), description: 'Measurement scheduled' });
      setNewDate(''); setNewMeasurer(''); setNewNotes(''); setNewEmail(clientEmail || '');
      loadData();
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleOpenOutlook = (measurement: ProjectMeasurement) => {
    const measurer = employees.find(e => e.id === measurement.measurer_id);
    const dateStr = measurement.measurement_date ? format(new Date(measurement.measurement_date), 'dd/MM/yyyy') : 'TBD';
    const subject = encodeURIComponent(`Measurement appointment - ${projectName} - ${dateStr}`);
    const body = encodeURIComponent(
      `Dear ${clientName},\n\n` +
      `We would like to confirm your measurement appointment:\n\n` +
      `Project: ${projectName}\n` +
      `Date: ${dateStr}\n` +
      (measurer ? `Measurer: ${measurer.name}\n` : '') +
      (projectAddress ? `Address: ${projectAddress}\n` : '') +
      (measurement.notes ? `\nNotes: ${measurement.notes}\n` : '') +
      `\nPlease let us know if this time works for you.\n\n` +
      `Kind regards,\n${currentEmployee?.name || tenant?.name || ''}`
    );
    const to = measurement.customer_email || clientEmail || '';
    window.open(`mailto:${to}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadFiles = e.target.files;
    if (!uploadFiles) return;
    for (const file of Array.from(uploadFiles)) {
      try {
        await measurementService.uploadFile(projectId, file);
        toast({ title: t('success'), description: `${file.name} uploaded` });
      } catch (err: any) {
        toast({ title: t('error'), description: err.message, variant: 'destructive' });
      }
    }
    loadData();
  };

  const handleDeleteFile = async (fileName: string) => {
    try {
      await measurementService.deleteFile(`measurements/${projectId}/${fileName}`);
      toast({ title: t('success'), description: 'File deleted' });
      loadData();
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleDownloadFile = async (fileName: string) => {
    const url = await createSignedUrl('measurement-files', `measurements/${projectId}/${fileName}`);
    if (url) window.open(url, '_blank');
  };

  const handleDeleteMeasurement = async (id: string) => {
    try {
      await measurementService.delete(id);
      toast({ title: t('success'), description: 'Measurement deleted' });
      loadData();
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await measurementService.update(id, { status });
      loadData();
    } catch (err: any) {
      toast({ title: t('error'), description: err.message, variant: 'destructive' });
    }
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      {/* Schedule new measurement */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Plus className="h-4 w-4" /> Schedule Measurement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Measurer</Label>
              <Select value={newMeasurer} onValueChange={setNewMeasurer}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select measurer" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Customer Email</Label>
            <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="customer@email.com" className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} className="resize-none text-sm min-h-[60px]" />
          </div>
          <Button onClick={handleCreateMeasurement} disabled={!newDate} size="sm">
            <Calendar className="h-4 w-4 mr-1" /> Schedule
          </Button>
        </CardContent>
      </Card>

      {/* Existing measurements */}
      {measurements.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Scheduled Measurements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {measurements.map(m => {
              const measurer = employees.find(e => e.id === m.measurer_id);
              return (
                <div key={m.id} className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-sm font-medium">{m.measurement_date ? format(new Date(m.measurement_date), 'dd/MM/yyyy') : 'TBD'}</span>
                      <Select value={m.status} onValueChange={v => handleStatusChange(m.id, v)}>
                        <SelectTrigger className="h-6 text-[10px] w-auto border-0 bg-transparent p-0 px-1">
                          <Badge variant={m.status === 'completed' ? 'default' : 'secondary'} className="text-[10px]">{m.status}</Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {measurer && <p className="text-xs text-muted-foreground ml-6">{measurer.name}</p>}
                    {m.notes && <p className="text-xs text-muted-foreground ml-6 truncate">{m.notes}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleOpenOutlook(m)} title="Send email">
                      <Mail className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDeleteMeasurement(m.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Files */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Measurement Files</CardTitle>
            <label className="cursor-pointer">
              <input type="file" multiple className="hidden" onChange={handleFileUpload} />
              <Button variant="outline" size="sm" asChild><span><Upload className="h-3.5 w-3.5 mr-1" /> Upload</span></Button>
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? <p className="text-sm text-muted-foreground">No files uploaded</p> : (
            <div className="space-y-1.5">
              {files.map(f => (
                <div key={f.name} className="flex items-center justify-between bg-muted/30 rounded px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm truncate">{f.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDownloadFile(f.name)}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDeleteFile(f.name)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectMeasurementTab;
