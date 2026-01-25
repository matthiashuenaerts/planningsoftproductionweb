import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';

interface CostingSummary {
  totalLaborMinutes: number;
  totalLaborCost: number;
  employeeCosts: Array<{
    employeeName: string;
    totalMinutes: number;
    totalCost: number;
    taskCount: number;
  }>;
  orderItems: Array<{
    supplier: string;
    description: string;
    quantity: number;
    totalPrice: number;
  }>;
  totalOrderCost: number;
  accessories: Array<{
    articleName: string;
    quantity: number;
    unitPrice: number;
    status: string;
  }>;
  totalAccessoryCost: number;
  totalProjectCost: number;
}

interface ProjectInfo {
  name: string;
  client: string;
  installationDate?: string;
}

interface AdditionalCosts {
  materialCost: number;
  officePreparationCost: number;
  transportInstallationCost: number;
  otherCost: number;
}

interface MarginPercentages {
  labor: number;
  orderMaterials: number;
  accessories: number;
}

const DEFAULT_HOURLY_RATE = 45;
const BRAND_COLOR = { r: 45, g: 115, b: 135 };
const ACCENT_COLOR = { r: 80, g: 180, b: 210 };

const drawBrandedHeader = async (pdf: jsPDF, pageWidth: number, margin: number): Promise<number> => {
  let yPos = margin;
  
  // Try to add logo
  try {
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    
    await new Promise<void>((resolve, reject) => {
      logoImg.onload = () => resolve();
      logoImg.onerror = () => reject(new Error('Failed to load logo'));
      logoImg.src = '/images/automattion-compass-logo.png';
    });
    
    const logoWidth = 30;
    const logoHeight = 30;
    const logoX = (pageWidth - logoWidth) / 2;
    pdf.addImage(logoImg, 'PNG', logoX, yPos, logoWidth, logoHeight);
    yPos += logoHeight + 5;
  } catch (error) {
    console.warn('Could not load logo, using placeholder');
    yPos += 35;
  }
  
  // Company name
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bolditalic');
  pdf.setTextColor(BRAND_COLOR.r, BRAND_COLOR.g, BRAND_COLOR.b);
  pdf.text('AutoMattiOn', pageWidth / 2 - 2, yPos, { align: 'right' });
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b);
  pdf.text(' Compass', pageWidth / 2 - 2, yPos, { align: 'left' });
  yPos += 6;
  
  // Slogan
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'italic');
  pdf.setTextColor(ACCENT_COLOR.r, ACCENT_COLOR.g, ACCENT_COLOR.b);
  pdf.text('Guiding your production to perfection!', pageWidth / 2, yPos, { align: 'center' });
  pdf.setTextColor(0, 0, 0);
  yPos += 10;
  
  // Divider line
  pdf.setDrawColor(BRAND_COLOR.r, BRAND_COLOR.g, BRAND_COLOR.b);
  pdf.setLineWidth(0.5);
  pdf.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;
  
  return yPos;
};

const formatCurrency = (value: number): string => {
  return `€${value.toFixed(2)}`;
};

const formatTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
};

export const generateCostingPDFBlob = async (projectId: string): Promise<Blob> => {
  // Fetch all necessary data
  const { data: project } = await supabase
    .from('projects')
    .select('name, client, installation_date')
    .eq('id', projectId)
    .single();

  if (!project) {
    throw new Error('Project not found');
  }

  const projectInfo: ProjectInfo = {
    name: project.name,
    client: project.client,
    installationDate: project.installation_date
  };

  // Fetch saved costing data
  const { data: savedCosting } = await supabase
    .from('project_costing')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  const additionalCosts: AdditionalCosts = {
    materialCost: Number(savedCosting?.material_cost) || 0,
    officePreparationCost: Number(savedCosting?.office_preparation_cost) || 0,
    transportInstallationCost: Number(savedCosting?.transport_installation_cost) || 0,
    otherCost: Number(savedCosting?.other_cost) || 0
  };

  const margins: MarginPercentages = {
    labor: Number(savedCosting?.labor_margin_percentage) || 35,
    orderMaterials: Number(savedCosting?.order_materials_margin_percentage) || 35,
    accessories: Number(savedCosting?.accessories_margin_percentage) || 35
  };

  const salesPrice = Number(savedCosting?.sales_price) || 0;

  // Fetch phases and tasks
  const { data: phases } = await supabase
    .from('phases')
    .select('id, name')
    .eq('project_id', projectId);

  const phaseIds = phases?.map(p => p.id) || [];

  // Fetch tasks
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, phase_id, standard_task_id')
    .in('phase_id', phaseIds.length > 0 ? phaseIds : ['none']);

  const taskMap = new Map(tasks?.map(t => [t.id, { standardTaskId: t.standard_task_id }]) || []);
  const taskIds = tasks?.map(t => t.id) || [];

  // Fetch standard tasks for hourly rates
  const { data: standardTasks } = await supabase
    .from('standard_tasks')
    .select('id, hourly_cost');

  const standardTaskCostMap = new Map(
    standardTasks?.map(st => [st.id, st.hourly_cost || DEFAULT_HOURLY_RATE]) || []
  );

  // Fetch time registrations
  const employeeCosts: CostingSummary['employeeCosts'] = [];
  let totalLaborMinutes = 0;
  let totalLaborCost = 0;

  if (taskIds.length > 0) {
    const { data: timeRegs } = await supabase
      .from('time_registrations')
      .select(`
        id, employee_id, task_id, duration_minutes,
        employees(name)
      `)
      .in('task_id', taskIds)
      .not('duration_minutes', 'is', null);

    const employeeMap = new Map<string, typeof employeeCosts[0]>();

    timeRegs?.forEach(reg => {
      const employeeId = reg.employee_id;
      const employeeName = (reg.employees as any)?.name || 'Unknown';
      const minutes = reg.duration_minutes || 0;
      const taskId = reg.task_id;
      const taskInfo = taskMap.get(taskId);
      const standardTaskId = taskInfo?.standardTaskId;
      const hourlyRate = standardTaskId
        ? (standardTaskCostMap.get(standardTaskId) || DEFAULT_HOURLY_RATE)
        : DEFAULT_HOURLY_RATE;
      const cost = (minutes / 60) * hourlyRate;

      if (employeeMap.has(employeeId)) {
        const existing = employeeMap.get(employeeId)!;
        existing.totalMinutes += minutes;
        existing.totalCost += cost;
        existing.taskCount += 1;
      } else {
        employeeMap.set(employeeId, {
          employeeName,
          totalMinutes: minutes,
          totalCost: cost,
          taskCount: 1
        });
      }

      totalLaborMinutes += minutes;
      totalLaborCost += cost;
    });

    employeeCosts.push(...Array.from(employeeMap.values()));
  }

  // Fetch orders
  const { data: orders } = await supabase
    .from('orders')
    .select('id, supplier')
    .eq('project_id', projectId);

  const orderIds = orders?.map(o => o.id) || [];
  const orderMap = new Map(orders?.map(o => [o.id, o.supplier]) || []);

  // Fetch order items
  const orderItems: CostingSummary['orderItems'] = [];
  let totalOrderCost = 0;

  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds);

    items?.forEach(item => {
      const totalPrice = item.total_price || (item.unit_price || 0) * item.quantity;
      orderItems.push({
        supplier: orderMap.get(item.order_id) || 'Unknown',
        description: item.description,
        quantity: item.quantity,
        totalPrice
      });
      totalOrderCost += totalPrice;
    });
  }

  // Fetch accessories
  const { data: accessoriesData } = await supabase
    .from('accessories')
    .select('*')
    .eq('project_id', projectId);

  const accessories: CostingSummary['accessories'] = [];
  let totalAccessoryCost = 0;

  accessoriesData?.forEach(acc => {
    const unitPrice = acc.unit_price || 0;
    accessories.push({
      articleName: acc.article_name,
      quantity: acc.quantity,
      unitPrice,
      status: acc.status
    });
    totalAccessoryCost += unitPrice * acc.quantity;
  });

  // Calculate totals with margins
  const laborWithMargin = totalLaborCost * (1 + margins.labor / 100);
  const orderWithMargin = totalOrderCost * (1 + margins.orderMaterials / 100);
  const accessoriesWithMargin = totalAccessoryCost * (1 + margins.accessories / 100);
  const additionalTotal = additionalCosts.materialCost + additionalCosts.officePreparationCost +
    additionalCosts.transportInstallationCost + additionalCosts.otherCost;
  const totalProjectCost = laborWithMargin + orderWithMargin + accessoriesWithMargin + additionalTotal;

  // Generate PDF
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;

  let yPos = await drawBrandedHeader(pdf, pageWidth, margin);

  // Title
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0, 0, 0);
  pdf.text('Project Costing Report', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // Project Info Box
  pdf.setFillColor(245, 245, 245);
  pdf.roundedRect(margin, yPos, contentWidth, 28, 3, 3, 'F');
  yPos += 8;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(BRAND_COLOR.r, BRAND_COLOR.g, BRAND_COLOR.b);
  pdf.text('Project:', margin + 5, yPos);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'normal');
  pdf.text(projectInfo.name, margin + 30, yPos);
  yPos += 6;

  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(BRAND_COLOR.r, BRAND_COLOR.g, BRAND_COLOR.b);
  pdf.text('Client:', margin + 5, yPos);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'normal');
  pdf.text(projectInfo.client || '-', margin + 30, yPos);

  if (projectInfo.installationDate) {
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(BRAND_COLOR.r, BRAND_COLOR.g, BRAND_COLOR.b);
    pdf.text('Installation:', margin + contentWidth / 2, yPos);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'normal');
    pdf.text(new Date(projectInfo.installationDate).toLocaleDateString(), margin + contentWidth / 2 + 30, yPos);
  }
  yPos += 6;

  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  pdf.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, margin + 5, yPos);
  pdf.setTextColor(0, 0, 0);
  yPos += 12;

  // Cost Summary Section
  pdf.setFillColor(BRAND_COLOR.r, BRAND_COLOR.g, BRAND_COLOR.b);
  pdf.rect(margin, yPos, contentWidth, 8, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Cost Summary', margin + 5, yPos + 5.5);
  pdf.setTextColor(0, 0, 0);
  yPos += 14;

  // Cost rows
  pdf.setFontSize(10);
  const costs = [
    [`Labor Cost (+${margins.labor}%)`, formatCurrency(laborWithMargin)],
    [`Order Materials (+${margins.orderMaterials}%)`, formatCurrency(orderWithMargin)],
    [`Accessories (+${margins.accessories}%)`, formatCurrency(accessoriesWithMargin)],
    ['Material Cost', formatCurrency(additionalCosts.materialCost)],
    ['Office Preparation', formatCurrency(additionalCosts.officePreparationCost)],
    ['Transport & Installation', formatCurrency(additionalCosts.transportInstallationCost)],
    ['Other Costs', formatCurrency(additionalCosts.otherCost)]
  ];

  costs.forEach(([label, value], index) => {
    pdf.setFont('helvetica', index < 3 ? 'bold' : 'normal');
    pdf.text(label, margin, yPos);
    pdf.text(value, pageWidth - margin, yPos, { align: 'right' });
    yPos += 6;
  });

  // Total
  yPos += 2;
  pdf.setDrawColor(BRAND_COLOR.r, BRAND_COLOR.g, BRAND_COLOR.b);
  pdf.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 6;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('Total Project Cost', margin, yPos);
  pdf.text(formatCurrency(totalProjectCost), pageWidth - margin, yPos, { align: 'right' });
  yPos += 8;

  // Sales Price and Profit
  if (salesPrice > 0) {
    pdf.text('Sales Price', margin, yPos);
    pdf.text(formatCurrency(salesPrice), pageWidth - margin, yPos, { align: 'right' });
    yPos += 7;

    const profit = salesPrice - totalProjectCost;
    const profitMargin = salesPrice > 0 ? (profit / salesPrice) * 100 : 0;
    pdf.setTextColor(profit >= 0 ? 0 : 200, profit >= 0 ? 128 : 0, 0);
    pdf.text('Profit', margin, yPos);
    pdf.text(`${formatCurrency(profit)} (${profitMargin.toFixed(1)}%)`, pageWidth - margin, yPos, { align: 'right' });
    pdf.setTextColor(0, 0, 0);
    yPos += 10;
  }

  // Labor Breakdown
  if (employeeCosts.length > 0) {
    if (yPos > 240) {
      pdf.addPage();
      yPos = 20;
    }

    pdf.setFillColor(BRAND_COLOR.r, BRAND_COLOR.g, BRAND_COLOR.b);
    pdf.rect(margin, yPos, contentWidth, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Labor Breakdown', margin + 5, yPos + 5.5);
    pdf.setTextColor(0, 0, 0);
    yPos += 12;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Employee', margin, yPos);
    pdf.text('Tasks', margin + 70, yPos);
    pdf.text('Duration', margin + 90, yPos);
    pdf.text('Cost', pageWidth - margin, yPos, { align: 'right' });
    yPos += 6;

    pdf.setFont('helvetica', 'normal');
    employeeCosts.forEach((emp, index) => {
      if (yPos > 270) {
        pdf.addPage();
        yPos = 20;
      }
      if (index % 2 === 0) {
        pdf.setFillColor(250, 250, 250);
        pdf.rect(margin, yPos - 3.5, contentWidth, 5, 'F');
      }
      pdf.text(emp.employeeName.substring(0, 30), margin, yPos);
      pdf.text(emp.taskCount.toString(), margin + 70, yPos);
      pdf.text(formatTime(emp.totalMinutes), margin + 90, yPos);
      pdf.text(formatCurrency(emp.totalCost), pageWidth - margin, yPos, { align: 'right' });
      yPos += 5;
    });
  }

  // Order Materials
  if (orderItems.length > 0) {
    yPos += 5;
    if (yPos > 250) {
      pdf.addPage();
      yPos = 20;
    }

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Order Materials', margin, yPos);
    yPos += 8;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Supplier', margin, yPos);
    pdf.text('Description', margin + 40, yPos);
    pdf.text('Qty', margin + 120, yPos);
    pdf.text('Total', pageWidth - margin, yPos, { align: 'right' });
    yPos += 6;

    pdf.setFont('helvetica', 'normal');
    orderItems.slice(0, 20).forEach(item => {
      if (yPos > 270) {
        pdf.addPage();
        yPos = 20;
      }
      pdf.text(item.supplier.substring(0, 20), margin, yPos);
      pdf.text(item.description.substring(0, 40), margin + 40, yPos);
      pdf.text(item.quantity.toString(), margin + 120, yPos);
      pdf.text(formatCurrency(item.totalPrice), pageWidth - margin, yPos, { align: 'right' });
      yPos += 5;
    });

    if (orderItems.length > 20) {
      pdf.text(`... and ${orderItems.length - 20} more items`, margin, yPos);
      yPos += 5;
    }
  }

  return new Blob([pdf.output('blob')], { type: 'application/pdf' });
};
