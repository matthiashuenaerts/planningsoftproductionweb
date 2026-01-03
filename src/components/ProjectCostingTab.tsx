import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Loader2, Clock, Package, DollarSign, TrendingUp, Users, FileText, 
  ChevronDown, ChevronRight, Download, Printer, ShoppingCart, Wrench,
  Building, Truck, Calculator, Plus, Euro
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';
import jsPDF from 'jspdf';

interface ProjectCostingTabProps {
  projectId: string;
}

interface TimeRegistrationDetail {
  id: string;
  taskId: string;
  taskTitle: string;
  employeeName: string;
  durationMinutes: number;
  cost: number;
  hourlyRate: number;
  date: string;
}

interface EmployeeCostSummary {
  employeeId: string;
  employeeName: string;
  totalMinutes: number;
  totalCost: number;
  taskCount: number;
  details: TimeRegistrationDetail[];
}

interface TaskCostSummary {
  taskId: string;
  taskTitle: string;
  phaseName: string;
  estimatedMinutes: number;
  actualMinutes: number;
  hourlyRate: number;
  totalCost: number;
  registrations: TimeRegistrationDetail[];
}

interface OrderItemCost {
  orderId: string;
  orderNumber?: string;
  supplier: string;
  description: string;
  articleCode?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface AccessoryCost {
  id: string;
  articleName: string;
  articleCode?: string;
  supplier?: string;
  quantity: number;
  unitPrice: number;
  hasDbPrice: boolean; // true if price came from database
  status: string;
}

interface AdditionalCosts {
  materialCost: number;
  officePreparationCost: number;
  transportInstallationCost: number;
  otherCost: number;
}

interface CostingSummary {
  // Labor
  totalLaborMinutes: number;
  totalLaborCost: number;
  employeeCosts: EmployeeCostSummary[];
  taskCosts: TaskCostSummary[];
  
  // Materials from orders
  orderItems: OrderItemCost[];
  totalOrderCost: number;
  
  // Accessories
  accessories: AccessoryCost[];
  totalAccessoryCost: number;
  
  // Calculated totals
  totalProjectCost: number;
}

interface ProjectInfo {
  name: string;
  client: string;
  startDate?: string;
  installationDate?: string;
}

const DEFAULT_HOURLY_RATE = 45;

export const ProjectCostingTab: React.FC<ProjectCostingTabProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(true);
  const [costingSummary, setCostingSummary] = useState<CostingSummary | null>(null);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'employee' | 'task'>('employee');
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCosts>({
    materialCost: 0,
    officePreparationCost: 0,
    transportInstallationCost: 0,
    otherCost: 0
  });
  const [salesPrice, setSalesPrice] = useState<number>(0);
  const { t } = useLanguage();

  useEffect(() => {
    const fetchCostingData = async () => {
      setLoading(true);
      try {
        // Fetch project info
        const { data: project } = await supabase
          .from('projects')
          .select('name, client, start_date, installation_date')
          .eq('id', projectId)
          .single();
        
        if (project) {
          setProjectInfo({
            name: project.name,
            client: project.client,
            startDate: project.start_date,
            installationDate: project.installation_date
          });
        }

        // Fetch phases and tasks
        const { data: phases } = await supabase
          .from('phases')
          .select('id, name')
          .eq('project_id', projectId);

        const phaseMap = new Map(phases?.map(p => [p.id, p.name]) || []);
        const phaseIds = phases?.map(p => p.id) || [];

        // Fetch tasks with their standard_task info
        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, title, phase_id, standard_task_id, estimated_duration')
          .in('phase_id', phaseIds.length > 0 ? phaseIds : ['none']);

        const taskMap = new Map(tasks?.map(t => [t.id, { 
          title: t.title, 
          phaseId: t.phase_id,
          phaseName: phaseMap.get(t.phase_id) || 'Unknown',
          standardTaskId: t.standard_task_id,
          estimatedMinutes: t.estimated_duration || 0
        }]) || []);
        const taskIds = tasks?.map(t => t.id) || [];

        // Fetch standard tasks for hourly rates
        const { data: standardTasks } = await supabase
          .from('standard_tasks')
          .select('id, hourly_cost');
        
        const standardTaskCostMap = new Map(
          standardTasks?.map(st => [st.id, st.hourly_cost || DEFAULT_HOURLY_RATE]) || []
        );

        // Fetch time registrations
        let employeeCosts: EmployeeCostSummary[] = [];
        let taskCosts: TaskCostSummary[] = [];
        let totalLaborMinutes = 0;
        let totalLaborCost = 0;

        if (taskIds.length > 0) {
          const { data: timeRegs } = await supabase
            .from('time_registrations')
            .select(`
              id,
              employee_id,
              task_id,
              duration_minutes,
              start_time,
              employees(name)
            `)
            .in('task_id', taskIds)
            .not('duration_minutes', 'is', null);

          // Process by employee
          const employeeMap = new Map<string, EmployeeCostSummary>();
          const taskCostMap = new Map<string, TaskCostSummary>();

          timeRegs?.forEach(reg => {
            const employeeId = reg.employee_id;
            const employeeName = (reg.employees as any)?.name || t('unknown_employee');
            const minutes = reg.duration_minutes || 0;
            const taskId = reg.task_id;
            const taskInfo = taskMap.get(taskId);
            const standardTaskId = taskInfo?.standardTaskId;
            const hourlyRate = standardTaskId 
              ? (standardTaskCostMap.get(standardTaskId) || DEFAULT_HOURLY_RATE) 
              : DEFAULT_HOURLY_RATE;
            const cost = (minutes / 60) * hourlyRate;

            const detail: TimeRegistrationDetail = {
              id: reg.id,
              taskId,
              taskTitle: taskInfo?.title || t('unknown_task'),
              employeeName,
              durationMinutes: minutes,
              cost,
              hourlyRate,
              date: reg.start_time ? new Date(reg.start_time).toLocaleDateString() : ''
            };

            // Employee grouping
            if (employeeMap.has(employeeId)) {
              const existing = employeeMap.get(employeeId)!;
              existing.totalMinutes += minutes;
              existing.totalCost += cost;
              existing.taskCount += 1;
              existing.details.push(detail);
            } else {
              employeeMap.set(employeeId, {
                employeeId,
                employeeName,
                totalMinutes: minutes,
                totalCost: cost,
                taskCount: 1,
                details: [detail]
              });
            }

            // Task grouping
            if (taskCostMap.has(taskId)) {
              const existing = taskCostMap.get(taskId)!;
              existing.actualMinutes += minutes;
              existing.totalCost += cost;
              existing.registrations.push(detail);
            } else {
              taskCostMap.set(taskId, {
                taskId,
                taskTitle: taskInfo?.title || t('unknown_task'),
                phaseName: taskInfo?.phaseName || '',
                estimatedMinutes: taskInfo?.estimatedMinutes || 0,
                actualMinutes: minutes,
                hourlyRate,
                totalCost: cost,
                registrations: [detail]
              });
            }

            totalLaborMinutes += minutes;
            totalLaborCost += cost;
          });

          employeeCosts = Array.from(employeeMap.values());
          taskCosts = Array.from(taskCostMap.values());
        }

        // Fetch orders and items
        const { data: orders } = await supabase
          .from('orders')
          .select(`
            id,
            supplier,
            external_order_number,
            order_items(
              id,
              description,
              article_code,
              quantity,
              unit_price,
              total_price
            )
          `)
          .eq('project_id', projectId);

        const orderItems: OrderItemCost[] = [];
        let totalOrderCost = 0;

        orders?.forEach(order => {
          const items = (order.order_items as any[]) || [];
          items.forEach(item => {
            const totalPrice = item.total_price || (item.quantity * (item.unit_price || 0));
            orderItems.push({
              orderId: order.id,
              orderNumber: order.external_order_number || undefined,
              supplier: order.supplier,
              description: item.description,
              articleCode: item.article_code,
              quantity: item.quantity,
              unitPrice: item.unit_price || 0,
              totalPrice
            });
            totalOrderCost += totalPrice;
          });
        });

        // Fetch accessories with unit_price
        const { data: accessoriesData } = await supabase
          .from('accessories')
          .select('id, article_name, article_code, supplier, quantity, status, unit_price')
          .eq('project_id', projectId);

        const accessories: AccessoryCost[] = (accessoriesData || []).map(acc => {
          const dbPrice = (acc as any).unit_price || 0;
          return {
            id: acc.id,
            articleName: acc.article_name,
            articleCode: acc.article_code || undefined,
            supplier: acc.supplier || undefined,
            quantity: acc.quantity,
            unitPrice: dbPrice,
            hasDbPrice: dbPrice > 0,
            status: acc.status
          };
        });

        const totalAccessoryCost = accessories.reduce((sum, acc) => sum + (acc.unitPrice * acc.quantity), 0);

        setCostingSummary({
          totalLaborMinutes,
          totalLaborCost,
          employeeCosts,
          taskCosts,
          orderItems,
          totalOrderCost,
          accessories,
          totalAccessoryCost,
          totalProjectCost: totalLaborCost + totalOrderCost + totalAccessoryCost
        });
      } catch (error) {
        console.error('Error fetching costing data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCostingData();
  }, [projectId, t]);

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const toggleEmployee = (id: string) => {
    const newSet = new Set(expandedEmployees);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedEmployees(newSet);
  };

  const toggleTask = (id: string) => {
    const newSet = new Set(expandedTasks);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedTasks(newSet);
  };

  const calculateTotalCost = () => {
    if (!costingSummary) return 0;
    return (
      costingSummary.totalLaborCost +
      costingSummary.totalOrderCost +
      costingSummary.totalAccessoryCost +
      additionalCosts.materialCost +
      additionalCosts.officePreparationCost +
      additionalCosts.transportInstallationCost +
      additionalCosts.otherCost
    );
  };

  const updateAccessoryPrice = async (accessoryId: string, unitPrice: number) => {
    try {
      const { error } = await supabase
        .from('accessories')
        .update({ unit_price: unitPrice })
        .eq('id', accessoryId);

      if (error) throw error;

      // Update local state
      if (costingSummary) {
        const updatedAccessories = costingSummary.accessories.map(acc =>
          acc.id === accessoryId ? { ...acc, unitPrice, hasDbPrice: unitPrice > 0 } : acc
        );
        const totalAccessoryCost = updatedAccessories.reduce(
          (sum, acc) => sum + (acc.unitPrice * acc.quantity), 0
        );
        setCostingSummary({
          ...costingSummary,
          accessories: updatedAccessories,
          totalAccessoryCost,
          totalProjectCost: costingSummary.totalLaborCost + costingSummary.totalOrderCost + totalAccessoryCost
        });
      }
    } catch (error) {
      console.error('Error updating accessory price:', error);
    }
  };

  const calculateProfit = () => {
    return salesPrice - calculateTotalCost();
  };

  const calculateProfitMargin = () => {
    if (salesPrice <= 0) return 0;
    return ((salesPrice - calculateTotalCost()) / salesPrice) * 100;
  };

  const exportToPdf = () => {
    if (!costingSummary || !projectInfo) return;

    const doc = new jsPDF();
    let yPos = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(t('costing_project_report'), pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Project Info
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(t('project'), margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(projectInfo.name, margin + 30, yPos);
    yPos += 7;
    
    doc.setFont('helvetica', 'bold');
    doc.text(t('client_label'), margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(projectInfo.client || '-', margin + 30, yPos);
    yPos += 7;

    if (projectInfo.startDate) {
      doc.setFont('helvetica', 'bold');
      doc.text(t('start_date'), margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date(projectInfo.startDate).toLocaleDateString(), margin + 30, yPos);
      yPos += 7;
    }

    if (projectInfo.installationDate) {
      doc.setFont('helvetica', 'bold');
      doc.text(t('installation_date'), margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date(projectInfo.installationDate).toLocaleDateString(), margin + 30, yPos);
      yPos += 7;
    }

    yPos += 10;

    // Cost Summary Section
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(t('costing_cost_summary'), margin, yPos);
    yPos += 10;

    doc.setFontSize(10);
    const costs = [
      [t('costing_labor_cost'), formatCurrency(costingSummary.totalLaborCost)],
      [t('costing_order_materials'), formatCurrency(costingSummary.totalOrderCost)],
      [t('accessories'), formatCurrency(costingSummary.totalAccessoryCost)],
      [t('costing_additional_materials'), formatCurrency(additionalCosts.materialCost)],
      [t('costing_office_preparation'), formatCurrency(additionalCosts.officePreparationCost)],
      [t('costing_transport_installation'), formatCurrency(additionalCosts.transportInstallationCost)],
      [t('costing_other_costs'), formatCurrency(additionalCosts.otherCost)],
    ];

    doc.setFont('helvetica', 'normal');
    costs.forEach(([label, value]) => {
      doc.text(label, margin, yPos);
      doc.text(value, pageWidth - margin, yPos, { align: 'right' });
      yPos += 6;
    });

    yPos += 3;
    doc.setDrawColor(0);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 7;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(t('costing_total_cost'), margin, yPos);
    doc.text(formatCurrency(calculateTotalCost()), pageWidth - margin, yPos, { align: 'right' });
    yPos += 10;

    if (salesPrice > 0) {
      doc.text(t('costing_sales_price'), margin, yPos);
      doc.text(formatCurrency(salesPrice), pageWidth - margin, yPos, { align: 'right' });
      yPos += 7;

      const profit = calculateProfit();
      const profitMargin = calculateProfitMargin();
      doc.setTextColor(profit >= 0 ? 0 : 255, profit >= 0 ? 128 : 0, 0);
      doc.text(t('costing_profit'), margin, yPos);
      doc.text(`${formatCurrency(profit)} (${profitMargin.toFixed(1)}%)`, pageWidth - margin, yPos, { align: 'right' });
      doc.setTextColor(0);
    }

    yPos += 15;

    // Labor Details
    if (costingSummary.employeeCosts.length > 0) {
      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(t('costing_labor_breakdown'), margin, yPos);
      yPos += 8;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(t('employee'), margin, yPos);
      doc.text(t('tasks'), margin + 70, yPos);
      doc.text(t('duration'), margin + 90, yPos);
      doc.text(t('cost'), pageWidth - margin, yPos, { align: 'right' });
      yPos += 6;

      doc.setFont('helvetica', 'normal');
      costingSummary.employeeCosts.forEach(emp => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(emp.employeeName.substring(0, 30), margin, yPos);
        doc.text(emp.taskCount.toString(), margin + 70, yPos);
        doc.text(formatTime(emp.totalMinutes), margin + 90, yPos);
        doc.text(formatCurrency(emp.totalCost), pageWidth - margin, yPos, { align: 'right' });
        yPos += 5;
      });
    }

    yPos += 10;

    // Order Items
    if (costingSummary.orderItems.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(t('costing_order_materials'), margin, yPos);
      yPos += 8;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(t('supplier'), margin, yPos);
      doc.text(t('description'), margin + 40, yPos);
      doc.text(t('quantity'), margin + 120, yPos);
      doc.text(t('total'), pageWidth - margin, yPos, { align: 'right' });
      yPos += 6;

      doc.setFont('helvetica', 'normal');
      costingSummary.orderItems.forEach(item => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(item.supplier.substring(0, 20), margin, yPos);
        doc.text(item.description.substring(0, 40), margin + 40, yPos);
        doc.text(item.quantity.toString(), margin + 120, yPos);
        doc.text(formatCurrency(item.totalPrice), pageWidth - margin, yPos, { align: 'right' });
        yPos += 5;
      });
    }

    // Accessories Section
    if (costingSummary.accessories.length > 0) {
      yPos += 10;
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(t('accessories'), margin, yPos);
      yPos += 8;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(t('article_code'), margin, yPos);
      doc.text(t('description'), margin + 35, yPos);
      doc.text(t('quantity'), margin + 110, yPos);
      doc.text(t('costing_unit_price'), margin + 130, yPos);
      doc.text(t('total'), pageWidth - margin, yPos, { align: 'right' });
      yPos += 6;

      doc.setFont('helvetica', 'normal');
      costingSummary.accessories.forEach(acc => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text((acc.articleCode || '-').substring(0, 15), margin, yPos);
        doc.text(acc.articleName.substring(0, 35), margin + 35, yPos);
        doc.text(acc.quantity.toString(), margin + 110, yPos);
        doc.text(formatCurrency(acc.unitPrice), margin + 130, yPos);
        doc.text(formatCurrency(acc.unitPrice * acc.quantity), pageWidth - margin, yPos, { align: 'right' });
        yPos += 5;
      });

      // Total row
      yPos += 3;
      doc.setFont('helvetica', 'bold');
      doc.text(t('costing_total_accessories'), margin, yPos);
      doc.text(formatCurrency(costingSummary.totalAccessoryCost), pageWidth - margin, yPos, { align: 'right' });
    }
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `${t('page')} ${i} ${t('of')} ${pageCount} - ${new Date().toLocaleDateString()}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    doc.save(`${projectInfo.name.replace(/[^a-z0-9]/gi, '_')}_costing_report.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!costingSummary) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          {t('costing_no_data')}
        </CardContent>
      </Card>
    );
  }

  const totalCost = calculateTotalCost();
  const profit = calculateProfit();
  const profitMargin = calculateProfitMargin();

  return (
    <div className="space-y-6">
      {/* Header with Export Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          {t('costing_title')}
        </h2>
        <Button onClick={exportToPdf} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          {t('costing_export_pdf')}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">{t('costing_total_labor_time')}</p>
                <p className="text-2xl font-bold">{formatTime(costingSummary.totalLaborMinutes)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">{t('costing_labor_cost')}</p>
                <p className="text-xl font-bold">{formatCurrency(costingSummary.totalLaborCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">{t('costing_order_materials')}</p>
                <p className="text-xl font-bold">{formatCurrency(costingSummary.totalOrderCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">{t('accessories')}</p>
                <p className="text-xl font-bold">{formatCurrency(costingSummary.totalAccessoryCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">{t('costing_total_cost')}</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(totalCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Labor Breakdown */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t('costing_labor_breakdown')}
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                variant={viewMode === 'employee' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setViewMode('employee')}
              >
                <Users className="h-4 w-4 mr-1" />
                {t('costing_by_employee')}
              </Button>
              <Button 
                variant={viewMode === 'task' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setViewMode('task')}
              >
                <FileText className="h-4 w-4 mr-1" />
                {t('costing_by_task')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'employee' ? (
            costingSummary.employeeCosts.length > 0 ? (
              <div className="space-y-2">
                {costingSummary.employeeCosts.map((emp) => (
                  <Collapsible key={emp.employeeId} open={expandedEmployees.has(emp.employeeId)}>
                    <CollapsibleTrigger 
                      onClick={() => toggleEmployee(emp.employeeId)}
                      className="w-full"
                    >
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                        <div className="flex items-center gap-3">
                          {expandedEmployees.has(emp.employeeId) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="font-medium">{emp.employeeName}</span>
                          <Badge variant="secondary">{emp.taskCount} {t('tasks')}</Badge>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <span className="text-muted-foreground">{formatTime(emp.totalMinutes)}</span>
                          <span className="font-medium">{formatCurrency(emp.totalCost)}</span>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('task')}</TableHead>
                            <TableHead>{t('date')}</TableHead>
                            <TableHead className="text-right">{t('duration')}</TableHead>
                            <TableHead className="text-right">{t('hourly_rate')}</TableHead>
                            <TableHead className="text-right">{t('cost')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {emp.details.map((detail) => (
                            <TableRow key={detail.id}>
                              <TableCell>{detail.taskTitle}</TableCell>
                              <TableCell>{detail.date}</TableCell>
                              <TableCell className="text-right">{formatTime(detail.durationMinutes)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(detail.hourlyRate)}/h</TableCell>
                              <TableCell className="text-right">{formatCurrency(detail.cost)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
                <div className="flex justify-between p-3 bg-primary/10 rounded-lg font-bold">
                  <span>{t('total')}</span>
                  <div className="flex items-center gap-6">
                    <span>{formatTime(costingSummary.totalLaborMinutes)}</span>
                    <span className="text-primary">{formatCurrency(costingSummary.totalLaborCost)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">{t('costing_no_time_registrations')}</p>
            )
          ) : (
            costingSummary.taskCosts.length > 0 ? (
              <div className="space-y-2">
                {costingSummary.taskCosts.map((task) => (
                  <Collapsible key={task.taskId} open={expandedTasks.has(task.taskId)}>
                    <CollapsibleTrigger 
                      onClick={() => toggleTask(task.taskId)}
                      className="w-full"
                    >
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                        <div className="flex items-center gap-3">
                          {expandedTasks.has(task.taskId) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <div>
                            <span className="font-medium">{task.taskTitle}</span>
                            <Badge variant="outline" className="ml-2">{task.phaseName}</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <span className="text-muted-foreground">
                            {formatTime(task.actualMinutes)}
                            {task.estimatedMinutes > 0 && (
                              <span className="text-xs ml-1">
                                / {formatTime(task.estimatedMinutes)}
                              </span>
                            )}
                          </span>
                          <span className="font-medium">{formatCurrency(task.totalCost)}</span>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('employee')}</TableHead>
                            <TableHead>{t('date')}</TableHead>
                            <TableHead className="text-right">{t('duration')}</TableHead>
                            <TableHead className="text-right">{t('cost')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {task.registrations.map((reg) => (
                            <TableRow key={reg.id}>
                              <TableCell>{reg.employeeName}</TableCell>
                              <TableCell>{reg.date}</TableCell>
                              <TableCell className="text-right">{formatTime(reg.durationMinutes)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(reg.cost)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
                <div className="flex justify-between p-3 bg-primary/10 rounded-lg font-bold">
                  <span>{t('total')}</span>
                  <div className="flex items-center gap-6">
                    <span>{formatTime(costingSummary.totalLaborMinutes)}</span>
                    <span className="text-primary">{formatCurrency(costingSummary.totalLaborCost)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">{t('costing_no_time_registrations')}</p>
            )
          )}
        </CardContent>
      </Card>

      {/* Order Materials */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            {t('costing_order_materials')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {costingSummary.orderItems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('supplier')}</TableHead>
                  <TableHead>{t('article_code')}</TableHead>
                  <TableHead>{t('description')}</TableHead>
                  <TableHead className="text-right">{t('quantity')}</TableHead>
                  <TableHead className="text-right">{t('costing_unit_price')}</TableHead>
                  <TableHead className="text-right">{t('total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costingSummary.orderItems.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Badge variant="outline">{item.supplier}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.articleCode || '-'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{item.description}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.totalPrice)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={5}>{t('costing_total_materials')}</TableCell>
                  <TableCell className="text-right">{formatCurrency(costingSummary.totalOrderCost)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-4">{t('costing_no_orders')}</p>
          )}
        </CardContent>
      </Card>

      {/* Accessories */}
      {costingSummary.accessories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              {t('accessories')}
              <Badge variant="secondary" className="ml-2">
                {formatCurrency(costingSummary.totalAccessoryCost)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('article_code')}</TableHead>
                  <TableHead>{t('description')}</TableHead>
                  <TableHead>{t('supplier')}</TableHead>
                  <TableHead className="text-right">{t('quantity')}</TableHead>
                  <TableHead className="text-right">{t('costing_unit_price')}</TableHead>
                  <TableHead className="text-right">{t('total')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costingSummary.accessories.map((acc) => (
                  <TableRow key={acc.id}>
                    <TableCell className="text-muted-foreground">{acc.articleCode || '-'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{acc.articleName}</TableCell>
                    <TableCell>
                      {acc.supplier && <Badge variant="outline">{acc.supplier}</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{acc.quantity}</TableCell>
                    <TableCell className="text-right">
                      {acc.hasDbPrice ? (
                        <span className="font-medium text-green-600">
                          {formatCurrency(acc.unitPrice)}
                        </span>
                      ) : (
                        <div className="relative w-24 ml-auto">
                          <Euro className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={acc.unitPrice || ''}
                            onChange={(e) => updateAccessoryPrice(acc.id, parseFloat(e.target.value) || 0)}
                            className="h-8 pl-6 text-right text-sm"
                            placeholder="0.00"
                          />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(acc.unitPrice * acc.quantity)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={
                        acc.status === 'delivered' ? 'default' :
                        acc.status === 'in_stock' ? 'secondary' :
                        acc.status === 'ordered' ? 'outline' :
                        'destructive'
                      }>
                        {t(acc.status) || acc.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={5}>{t('costing_total_accessories')}</TableCell>
                  <TableCell className="text-right">{formatCurrency(costingSummary.totalAccessoryCost)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Additional Costs Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {t('costing_additional_costs')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                {t('costing_additional_materials')}
              </label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={additionalCosts.materialCost || ''}
                  onChange={(e) => setAdditionalCosts(prev => ({
                    ...prev,
                    materialCost: parseFloat(e.target.value) || 0
                  }))}
                  className="pl-9"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                {t('costing_office_preparation')}
              </label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={additionalCosts.officePreparationCost || ''}
                  onChange={(e) => setAdditionalCosts(prev => ({
                    ...prev,
                    officePreparationCost: parseFloat(e.target.value) || 0
                  }))}
                  className="pl-9"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                {t('costing_transport_installation')}
              </label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={additionalCosts.transportInstallationCost || ''}
                  onChange={(e) => setAdditionalCosts(prev => ({
                    ...prev,
                    transportInstallationCost: parseFloat(e.target.value) || 0
                  }))}
                  className="pl-9"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                {t('costing_other_costs')}
              </label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={additionalCosts.otherCost || ''}
                  onChange={(e) => setAdditionalCosts(prev => ({
                    ...prev,
                    otherCost: parseFloat(e.target.value) || 0
                  }))}
                  className="pl-9"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Final Cost Summary */}
      <Card className="border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            {t('costing_final_summary')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">{t('costing_labor_cost')}</TableCell>
                <TableCell className="text-right">{formatCurrency(costingSummary.totalLaborCost)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">{t('costing_order_materials')}</TableCell>
                <TableCell className="text-right">{formatCurrency(costingSummary.totalOrderCost)}</TableCell>
              </TableRow>
              {costingSummary.totalAccessoryCost > 0 && (
                <TableRow>
                  <TableCell className="font-medium">{t('accessories')}</TableCell>
                  <TableCell className="text-right">{formatCurrency(costingSummary.totalAccessoryCost)}</TableCell>
                </TableRow>
              )}
              {additionalCosts.materialCost > 0 && (
                <TableRow>
                  <TableCell className="font-medium">{t('costing_additional_materials')}</TableCell>
                  <TableCell className="text-right">{formatCurrency(additionalCosts.materialCost)}</TableCell>
                </TableRow>
              )}
              {additionalCosts.officePreparationCost > 0 && (
                <TableRow>
                  <TableCell className="font-medium">{t('costing_office_preparation')}</TableCell>
                  <TableCell className="text-right">{formatCurrency(additionalCosts.officePreparationCost)}</TableCell>
                </TableRow>
              )}
              {additionalCosts.transportInstallationCost > 0 && (
                <TableRow>
                  <TableCell className="font-medium">{t('costing_transport_installation')}</TableCell>
                  <TableCell className="text-right">{formatCurrency(additionalCosts.transportInstallationCost)}</TableCell>
                </TableRow>
              )}
              {additionalCosts.otherCost > 0 && (
                <TableRow>
                  <TableCell className="font-medium">{t('costing_other_costs')}</TableCell>
                  <TableCell className="text-right">{formatCurrency(additionalCosts.otherCost)}</TableCell>
                </TableRow>
              )}
              <TableRow className="bg-primary/10 font-bold text-lg">
                <TableCell>{t('costing_total_cost')}</TableCell>
                <TableCell className="text-right text-primary">{formatCurrency(totalCost)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <Separator className="my-6" />

          {/* Sales Price and Profit */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium w-48">{t('costing_sales_price')}</label>
              <div className="relative flex-1 max-w-xs">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={salesPrice || ''}
                  onChange={(e) => setSalesPrice(parseFloat(e.target.value) || 0)}
                  className="pl-9 text-lg font-bold"
                  placeholder="0.00"
                />
              </div>
            </div>

            {salesPrice > 0 && (
              <div className={`p-4 rounded-lg ${profit >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">{t('costing_profit')}</p>
                    <p className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(profit)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{t('costing_profit_margin')}</p>
                    <p className={`text-2xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {profitMargin.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
