import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  User, Mail, Phone, MapPin, Building2, FileText, Calendar, ExternalLink,
  Euro, Clock, Package, ShoppingCart, TrendingUp, Wallet, Wrench, Loader2,
  CheckCircle2, AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { Customer } from '@/services/customerService';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface CustomerDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
}

interface ProjectRow {
  id: string;
  name: string;
  client: string | null;
  status: string;
  progress: number | null;
  start_date: string | null;
  installation_date: string | null;
  installation_status: string | null;
  created_at: string;
  description?: string | null;
}

interface ProjectCosting {
  projectId: string;
  projectName: string;
  laborMinutes: number;
  laborCost: number;
  orderCost: number;
  accessoryCost: number;
  materialCost: number;
  officePreparationCost: number;
  transportInstallationCost: number;
  otherCost: number;
  salesPrice: number;
  totalCost: number;
  profit: number;
  marginPct: number;
}

const DEFAULT_HOURLY_RATE = 45;

const formatCurrency = (amt: number) =>
  new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(amt || 0);

const formatHours = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
};

const statusVariant = (status: string): { label: string; className: string } => {
  const map: Record<string, { label: string; className: string }> = {
    planned: { label: 'Planned', className: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
    in_progress: { label: 'In Progress', className: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
    completed: { label: 'Completed', className: 'bg-green-500/10 text-green-600 border-green-500/30' },
    on_hold: { label: 'On Hold', className: 'bg-muted text-muted-foreground border-border' },
  };
  return map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
};

export const CustomerDetailDialog: React.FC<CustomerDetailDialogProps> = ({ open, onOpenChange, customer }) => {
  const navigate = useNavigate();
  const { t, createLocalizedPath } = useLanguage();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [costings, setCostings] = useState<ProjectCosting[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCosting, setLoadingCosting] = useState(false);

  useEffect(() => {
    if (!open || !customer) return;
    loadProjects();
  }, [open, customer?.id]);

  const loadProjects = async () => {
    if (!customer) return;
    setLoading(true);
    try {
      const { data: byId } = await supabase
        .from('projects')
        .select('id, name, client, status, progress, start_date, installation_date, installation_status, created_at, description')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });

      const { data: byName } = await supabase
        .from('projects')
        .select('id, name, client, status, progress, start_date, installation_date, installation_status, created_at, description')
        .ilike('client', customer.name)
        .is('customer_id', null);

      const merged = [...(byId ?? []), ...(byName ?? [])];
      const unique = merged.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
      setProjects(unique as ProjectRow[]);
      // Fire costing fetch in background
      void loadCostings(unique as ProjectRow[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadCostings = async (projectList: ProjectRow[]) => {
    setLoadingCosting(true);
    try {
      const results: ProjectCosting[] = [];
      for (const p of projectList) {
        results.push(await computeProjectCosting(p));
      }
      setCostings(results);
    } catch (e) {
      console.error('costing error', e);
    } finally {
      setLoadingCosting(false);
    }
  };

  const computeProjectCosting = async (p: ProjectRow): Promise<ProjectCosting> => {
    // Phases
    const { data: phases } = await supabase.from('phases').select('id').eq('project_id', p.id);
    const phaseIds = (phases || []).map(x => x.id);

    let laborMinutes = 0;
    let laborCost = 0;
    if (phaseIds.length) {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, standard_task_id')
        .in('phase_id', phaseIds);
      const taskIds = (tasks || []).map(t => t.id);
      const stIds = Array.from(new Set((tasks || []).map(t => t.standard_task_id).filter(Boolean) as string[]));
      const stRateMap = new Map<string, number>();
      if (stIds.length) {
        const { data: sts } = await supabase.from('standard_tasks').select('id, hourly_cost').in('id', stIds);
        (sts || []).forEach(s => stRateMap.set(s.id, s.hourly_cost || DEFAULT_HOURLY_RATE));
      }
      const taskRate = new Map<string, number>();
      (tasks || []).forEach(t => {
        taskRate.set(t.id, t.standard_task_id ? (stRateMap.get(t.standard_task_id) || DEFAULT_HOURLY_RATE) : DEFAULT_HOURLY_RATE);
      });
      if (taskIds.length) {
        const { data: regs } = await supabase
          .from('time_registrations')
          .select('task_id, duration_minutes')
          .in('task_id', taskIds)
          .not('duration_minutes', 'is', null);
        (regs || []).forEach(r => {
          const m = r.duration_minutes || 0;
          laborMinutes += m;
          laborCost += (m / 60) * (taskRate.get(r.task_id) || DEFAULT_HOURLY_RATE);
        });
      }
    }

    // Orders
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_items(quantity, unit_price, total_price)')
      .eq('project_id', p.id);
    let orderCost = 0;
    (orders || []).forEach(o => {
      ((o.order_items as any[]) || []).forEach(it => {
        orderCost += it.total_price || (it.quantity * (it.unit_price || 0));
      });
    });

    // Accessories
    const { data: acc } = await supabase
      .from('accessories')
      .select('quantity, unit_price, article_code')
      .eq('project_id', p.id);
    let accessoryCost = 0;
    const codes = Array.from(new Set((acc || []).map(a => a.article_code).filter(Boolean) as string[]));
    let priceMap = new Map<string, number>();
    if (codes.length) {
      const { data: prods } = await supabase.from('products').select('article_code, price_per_unit').in('article_code', codes);
      (prods || []).forEach(pr => {
        if (pr.article_code && pr.price_per_unit != null) priceMap.set(pr.article_code.toLowerCase().trim(), pr.price_per_unit);
      });
    }
    (acc || []).forEach(a => {
      let unit = a.unit_price || 0;
      if (!unit && a.article_code) unit = priceMap.get(a.article_code.toLowerCase().trim()) || 0;
      accessoryCost += unit * (a.quantity || 0);
    });

    // Project costing extras
    const { data: pc } = await supabase
      .from('project_costing')
      .select('material_cost, office_preparation_cost, transport_installation_cost, other_cost, sales_price')
      .eq('project_id', p.id)
      .maybeSingle();

    const materialCost = Number(pc?.material_cost || 0);
    const officePreparationCost = Number(pc?.office_preparation_cost || 0);
    const transportInstallationCost = Number(pc?.transport_installation_cost || 0);
    const otherCost = Number(pc?.other_cost || 0);
    const salesPrice = Number(pc?.sales_price || 0);

    const totalCost = laborCost + orderCost + accessoryCost + materialCost + officePreparationCost + transportInstallationCost + otherCost;
    const profit = salesPrice - totalCost;
    const marginPct = salesPrice > 0 ? (profit / salesPrice) * 100 : 0;

    return {
      projectId: p.id,
      projectName: p.name,
      laborMinutes,
      laborCost,
      orderCost,
      accessoryCost,
      materialCost,
      officePreparationCost,
      transportInstallationCost,
      otherCost,
      salesPrice,
      totalCost,
      profit,
      marginPct,
    };
  };

  const summary = useMemo(() => {
    const totals = costings.reduce(
      (acc, c) => ({
        laborMinutes: acc.laborMinutes + c.laborMinutes,
        laborCost: acc.laborCost + c.laborCost,
        orderCost: acc.orderCost + c.orderCost,
        accessoryCost: acc.accessoryCost + c.accessoryCost,
        materialCost: acc.materialCost + c.materialCost,
        officePreparationCost: acc.officePreparationCost + c.officePreparationCost,
        transportInstallationCost: acc.transportInstallationCost + c.transportInstallationCost,
        otherCost: acc.otherCost + c.otherCost,
        salesPrice: acc.salesPrice + c.salesPrice,
        totalCost: acc.totalCost + c.totalCost,
      }),
      { laborMinutes: 0, laborCost: 0, orderCost: 0, accessoryCost: 0, materialCost: 0, officePreparationCost: 0, transportInstallationCost: 0, otherCost: 0, salesPrice: 0, totalCost: 0 }
    );
    const profit = totals.salesPrice - totals.totalCost;
    const margin = totals.salesPrice > 0 ? (profit / totals.salesPrice) * 100 : 0;
    return { ...totals, profit, margin };
  }, [costings]);

  const projectStats = useMemo(() => {
    const total = projects.length;
    const completed = projects.filter(p => p.status === 'completed').length;
    const active = projects.filter(p => p.status === 'in_progress').length;
    const planned = projects.filter(p => p.status === 'planned').length;
    const installed = projects.filter(p => p.installation_status === 'completed').length;
    const avgProgress = total ? Math.round(projects.reduce((a, p) => a + (p.progress || 0), 0) / total) : 0;
    return { total, completed, active, planned, installed, avgProgress };
  }, [projects]);

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[96vw] h-[92vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div>{customer.name}</div>
              {customer.company_name && <div className="text-sm font-normal text-muted-foreground">{customer.company_name}</div>}
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-3 shrink-0 border-b">
            <TabsList>
              <TabsTrigger value="overview"><User className="h-3.5 w-3.5 mr-1.5" /> Overview</TabsTrigger>
              <TabsTrigger value="projects"><Package className="h-3.5 w-3.5 mr-1.5" /> Projects ({projects.length})</TabsTrigger>
              <TabsTrigger value="costing"><Euro className="h-3.5 w-3.5 mr-1.5" /> Costing</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6">
              {/* OVERVIEW TAB */}
              <TabsContent value="overview" className="mt-0 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Contact Information</CardTitle></CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {customer.company_name && <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />{customer.company_name}</div>}
                      {customer.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><a href={`mailto:${customer.email}`} className="hover:underline">{customer.email}</a></div>}
                      {customer.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><a href={`tel:${customer.phone}`} className="hover:underline">{customer.phone}</a></div>}
                      {(customer.address_street || customer.address_city) && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            {customer.address_street && <div>{customer.address_street} {customer.address_number}</div>}
                            <div>{[customer.address_postal_code, customer.address_city, customer.address_country].filter(Boolean).join(' ')}</div>
                          </div>
                        </div>
                      )}
                      {customer.vat_number && <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />VAT: {customer.vat_number}</div>}
                      {customer.notes && (<><Separator className="my-2" /><p className="text-muted-foreground text-xs">{customer.notes}</p></>)}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Project Statistics</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-3">
                        <StatBox label="Total" value={projectStats.total} icon={Package} />
                        <StatBox label="Active" value={projectStats.active} icon={Wrench} className="text-amber-600" />
                        <StatBox label="Completed" value={projectStats.completed} icon={CheckCircle2} className="text-green-600" />
                        <StatBox label="Planned" value={projectStats.planned} icon={Calendar} className="text-blue-600" />
                        <StatBox label="Installed" value={projectStats.installed} icon={CheckCircle2} className="text-emerald-600" />
                        <StatBox label="Avg Progress" value={`${projectStats.avgProgress}%`} icon={TrendingUp} />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wallet className="h-4 w-4" /> Financial Summary (All Projects)</CardTitle></CardHeader>
                  <CardContent>
                    {loadingCosting ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4"><Loader2 className="h-4 w-4 animate-spin" /> Loading costing data...</div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <FinancialBox label="Total Revenue" value={formatCurrency(summary.salesPrice)} icon={Euro} className="text-green-600" />
                        <FinancialBox label="Total Cost" value={formatCurrency(summary.totalCost)} icon={ShoppingCart} className="text-red-600" />
                        <FinancialBox label="Total Profit" value={formatCurrency(summary.profit)} icon={TrendingUp} className={summary.profit >= 0 ? 'text-green-600' : 'text-red-600'} />
                        <FinancialBox label="Avg Margin" value={`${summary.margin.toFixed(1)}%`} icon={TrendingUp} className={summary.margin >= 0 ? 'text-green-600' : 'text-red-600'} />
                        <FinancialBox label="Total Hours" value={formatHours(summary.laborMinutes)} icon={Clock} />
                        <FinancialBox label="Labor Cost" value={formatCurrency(summary.laborCost)} icon={Clock} />
                        <FinancialBox label="Orders Cost" value={formatCurrency(summary.orderCost)} icon={ShoppingCart} />
                        <FinancialBox label="Accessories" value={formatCurrency(summary.accessoryCost)} icon={Package} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* PROJECTS TAB */}
              <TabsContent value="projects" className="mt-0 space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : projects.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No projects linked to this customer</p>
                ) : projects.map(p => {
                  const sv = statusVariant(p.status);
                  return (
                    <Card key={p.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(createLocalizedPath(`/projects/${p.id}`))}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold truncate">{p.name}</h3>
                            {p.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.description}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge variant="outline" className={cn("text-[10px]", sv.className)}>{sv.label}</Badge>
                            {p.installation_status === 'completed' && <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">✓ Installed</Badge>}
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </div>
                        </div>

                        <div className="space-y-1.5 mb-3">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{p.progress || 0}%</span>
                          </div>
                          <Progress value={p.progress || 0} className="h-1.5" />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <InfoChip icon={Calendar} label="Start" value={p.start_date ? new Date(p.start_date).toLocaleDateString() : '—'} />
                          <InfoChip icon={Calendar} label="Installation" value={p.installation_date ? new Date(p.installation_date).toLocaleDateString() : '—'} />
                          <InfoChip icon={Calendar} label="Created" value={new Date(p.created_at).toLocaleDateString()} />
                          {(() => {
                            const c = costings.find(x => x.projectId === p.id);
                            return <InfoChip icon={Euro} label="Cost" value={c ? formatCurrency(c.totalCost) : '...'} />;
                          })()}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </TabsContent>

              {/* COSTING TAB */}
              <TabsContent value="costing" className="mt-0 space-y-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wallet className="h-4 w-4" /> Customer-Wide Summary</CardTitle></CardHeader>
                  <CardContent>
                    {loadingCosting ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4"><Loader2 className="h-4 w-4 animate-spin" /> Calculating...</div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <SumRow label="Labor" value={formatCurrency(summary.laborCost)} sub={formatHours(summary.laborMinutes)} />
                        <SumRow label="Orders / Materials" value={formatCurrency(summary.orderCost)} />
                        <SumRow label="Accessories" value={formatCurrency(summary.accessoryCost)} />
                        <SumRow label="Material extra" value={formatCurrency(summary.materialCost)} />
                        <SumRow label="Office prep" value={formatCurrency(summary.officePreparationCost)} />
                        <SumRow label="Transport / Install" value={formatCurrency(summary.transportInstallationCost)} />
                        <SumRow label="Other" value={formatCurrency(summary.otherCost)} />
                        <SumRow label="Total Cost" value={formatCurrency(summary.totalCost)} highlight />
                        <SumRow label="Total Revenue" value={formatCurrency(summary.salesPrice)} highlight className="text-green-600" />
                        <SumRow label="Profit" value={formatCurrency(summary.profit)} highlight className={summary.profit >= 0 ? 'text-green-600' : 'text-red-600'} />
                        <SumRow label="Avg Margin" value={`${summary.margin.toFixed(1)}%`} highlight className={summary.margin >= 0 ? 'text-green-600' : 'text-red-600'} />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div>
                  <h3 className="text-sm font-semibold mb-2 px-1">Per Project Breakdown</h3>
                  {loadingCosting ? (
                    <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : costings.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6 text-sm">No projects to calculate</p>
                  ) : (
                    <div className="space-y-2">
                      {costings.map(c => (
                        <Card key={c.projectId} className="hover:bg-muted/30 cursor-pointer" onClick={() => navigate(createLocalizedPath(`/projects/${c.projectId}`))}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-sm truncate">{c.projectName}</h4>
                              <Badge variant="outline" className={cn("text-[10px]", c.profit >= 0 ? 'border-green-500/30 text-green-600 bg-green-500/10' : 'border-red-500/30 text-red-600 bg-red-500/10')}>
                                {c.marginPct.toFixed(1)}% margin
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
                              <CostMini label="Labor" value={formatCurrency(c.laborCost)} sub={formatHours(c.laborMinutes)} />
                              <CostMini label="Orders" value={formatCurrency(c.orderCost)} />
                              <CostMini label="Access." value={formatCurrency(c.accessoryCost)} />
                              <CostMini label="Extras" value={formatCurrency(c.materialCost + c.officePreparationCost + c.transportInstallationCost + c.otherCost)} />
                              <CostMini label="Cost" value={formatCurrency(c.totalCost)} className="font-semibold" />
                              <CostMini label="Revenue" value={formatCurrency(c.salesPrice)} className={cn("font-semibold", c.salesPrice > 0 ? 'text-green-600' : 'text-muted-foreground')} />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

const StatBox: React.FC<{ label: string; value: number | string; icon: any; className?: string }> = ({ label, value, icon: Icon, className }) => (
  <div className="bg-muted/40 rounded-md p-2 text-center">
    <Icon className={cn("h-4 w-4 mx-auto mb-1", className || 'text-muted-foreground')} />
    <div className={cn("text-lg font-bold leading-tight", className)}>{value}</div>
    <div className="text-[10px] text-muted-foreground">{label}</div>
  </div>
);

const FinancialBox: React.FC<{ label: string; value: string; icon: any; className?: string }> = ({ label, value, icon: Icon, className }) => (
  <div className="bg-muted/40 rounded-md p-3">
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
      <Icon className="h-3 w-3" />{label}
    </div>
    <div className={cn("text-base font-bold", className)}>{value}</div>
  </div>
);

const InfoChip: React.FC<{ icon: any; label: string; value: string }> = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-1.5 text-muted-foreground">
    <Icon className="h-3 w-3 shrink-0" />
    <span className="text-[10px]">{label}:</span>
    <span className="text-foreground font-medium truncate">{value}</span>
  </div>
);

const SumRow: React.FC<{ label: string; value: string; sub?: string; highlight?: boolean; className?: string }> = ({ label, value, sub, highlight, className }) => (
  <div className={cn("flex justify-between items-center px-3 py-2 rounded-md", highlight ? 'bg-muted/60' : 'bg-muted/30')}>
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
    <div className={cn(highlight ? 'text-base font-bold' : 'text-sm font-medium', className)}>{value}</div>
  </div>
);

const CostMini: React.FC<{ label: string; value: string; sub?: string; className?: string }> = ({ label, value, sub, className }) => (
  <div className="bg-muted/30 rounded px-2 py-1.5">
    <div className="text-[10px] text-muted-foreground">{label}</div>
    <div className={cn("text-xs", className)}>{value}</div>
    {sub && <div className="text-[9px] text-muted-foreground">{sub}</div>}
  </div>
);

export default CustomerDetailDialog;
