import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, Package, DollarSign, TrendingUp, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/context/LanguageContext';

interface ProjectCostingTabProps {
  projectId: string;
}

interface TimeRegistrationCost {
  employeeName: string;
  totalMinutes: number;
  taskCount: number;
}

interface OrderItemCost {
  orderId: string;
  supplier: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface CostingSummary {
  totalLaborMinutes: number;
  totalLaborCost: number;
  totalMaterialCost: number;
  totalProjectCost: number;
  employeeCosts: TimeRegistrationCost[];
  orderItems: OrderItemCost[];
}

const HOURLY_RATE = 45; // Default hourly rate in EUR - could be made configurable

export const ProjectCostingTab: React.FC<ProjectCostingTabProps> = ({ projectId }) => {
  const [loading, setLoading] = useState(true);
  const [costingSummary, setCostingSummary] = useState<CostingSummary | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    const fetchCostingData = async () => {
      setLoading(true);
      try {
        // Fetch time registrations for all tasks in this project
        const { data: tasks, error: tasksError } = await supabase
          .from('tasks')
          .select(`
            id,
            title,
            phases!inner(project_id)
          `)
          .eq('phases.project_id', projectId);

        if (tasksError) throw tasksError;

        const taskIds = tasks?.map(t => t.id) || [];

        // Fetch time registrations for these tasks
        let employeeCosts: TimeRegistrationCost[] = [];
        let totalLaborMinutes = 0;

        if (taskIds.length > 0) {
          const { data: timeRegs, error: timeRegsError } = await supabase
            .from('time_registrations')
            .select(`
              id,
              employee_id,
              duration_minutes,
              employees(name)
            `)
            .in('task_id', taskIds)
            .not('duration_minutes', 'is', null);

          if (timeRegsError) throw timeRegsError;

          // Group by employee
          const employeeMap = new Map<string, { name: string; totalMinutes: number; taskCount: number }>();
          
          timeRegs?.forEach(reg => {
            const employeeId = reg.employee_id;
            const employeeName = (reg.employees as any)?.name || 'Unknown';
            const minutes = reg.duration_minutes || 0;
            
            if (employeeMap.has(employeeId)) {
              const existing = employeeMap.get(employeeId)!;
              existing.totalMinutes += minutes;
              existing.taskCount += 1;
            } else {
              employeeMap.set(employeeId, {
                name: employeeName,
                totalMinutes: minutes,
                taskCount: 1
              });
            }
            
            totalLaborMinutes += minutes;
          });

          employeeCosts = Array.from(employeeMap.values()).map(e => ({
            employeeName: e.name,
            totalMinutes: e.totalMinutes,
            taskCount: e.taskCount
          }));
        }

        // Fetch orders and order items for this project
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select(`
            id,
            supplier,
            order_items(
              id,
              description,
              quantity,
              unit_price,
              total_price
            )
          `)
          .eq('project_id', projectId);

        if (ordersError) throw ordersError;

        // Flatten order items
        const orderItems: OrderItemCost[] = [];
        let totalMaterialCost = 0;

        orders?.forEach(order => {
          const items = (order.order_items as any[]) || [];
          items.forEach(item => {
            const totalPrice = item.total_price || (item.quantity * (item.unit_price || 0));
            orderItems.push({
              orderId: order.id,
              supplier: order.supplier,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unit_price || 0,
              totalPrice: totalPrice
            });
            totalMaterialCost += totalPrice;
          });
        });

        // Calculate total costs
        const totalLaborCost = (totalLaborMinutes / 60) * HOURLY_RATE;
        const totalProjectCost = totalLaborCost + totalMaterialCost;

        setCostingSummary({
          totalLaborMinutes,
          totalLaborCost,
          totalMaterialCost,
          totalProjectCost,
          employeeCosts,
          orderItems
        });
      } catch (error) {
        console.error('Error fetching costing data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCostingData();
  }, [projectId]);

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(amount);
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
          No costing data available
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Labor Time</p>
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
                <p className="text-sm text-muted-foreground">Labor Cost</p>
                <p className="text-2xl font-bold">{formatCurrency(costingSummary.totalLaborCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Material Cost</p>
                <p className="text-2xl font-bold">{formatCurrency(costingSummary.totalMaterialCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Project Cost</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(costingSummary.totalProjectCost)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Labor Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Labor Breakdown by Employee
          </CardTitle>
        </CardHeader>
        <CardContent>
          {costingSummary.employeeCosts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Tasks</TableHead>
                  <TableHead className="text-right">Time Spent</TableHead>
                  <TableHead className="text-right">Cost (@ €{HOURLY_RATE}/hr)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costingSummary.employeeCosts.map((emp, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{emp.employeeName}</TableCell>
                    <TableCell className="text-right">{emp.taskCount}</TableCell>
                    <TableCell className="text-right">{formatTime(emp.totalMinutes)}</TableCell>
                    <TableCell className="text-right">{formatCurrency((emp.totalMinutes / 60) * HOURLY_RATE)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{costingSummary.employeeCosts.reduce((sum, e) => sum + e.taskCount, 0)}</TableCell>
                  <TableCell className="text-right">{formatTime(costingSummary.totalLaborMinutes)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(costingSummary.totalLaborCost)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-4">No time registrations found</p>
          )}
        </CardContent>
      </Card>

      {/* Material Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Material & Hardware Costs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {costingSummary.orderItems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costingSummary.orderItems.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Badge variant="outline">{item.supplier}</Badge>
                    </TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.totalPrice)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={4}>Total Material Cost</TableCell>
                  <TableCell className="text-right">{formatCurrency(costingSummary.totalMaterialCost)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-4">No order items with pricing found</p>
          )}
        </CardContent>
      </Card>

      {/* Cost Summary */}
      <Card className="border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Cost Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Labor Cost</TableCell>
                <TableCell className="text-right">{formatCurrency(costingSummary.totalLaborCost)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Material & Hardware Cost</TableCell>
                <TableCell className="text-right">{formatCurrency(costingSummary.totalMaterialCost)}</TableCell>
              </TableRow>
              <TableRow className="bg-primary/10 font-bold text-lg">
                <TableCell>Total Project Cost</TableCell>
                <TableCell className="text-right text-primary">{formatCurrency(costingSummary.totalProjectCost)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
