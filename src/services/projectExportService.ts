
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { supabase } from '@/integrations/supabase/client';
import { Project } from '@/services/dataService';
import { orderService } from '@/services/orderService';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { brokenPartsService } from '@/services/brokenPartsService';

interface ExportData {
  project: Project;
  phases: any[];
  tasks: any[];
  orders: any[];
  orderItems: any[];
  timeRegistrations: any[];
  brokenParts: any[];
  employees: any[];
  workstations: any[];
}

export const exportProjectData = async (project: Project): Promise<void> => {
  try {
    // Collect all project data
    const exportData = await collectProjectData(project.id);
    
    // Generate ZIP file
    const zip = new JSZip();
    
    // Add main project documentation
    const projectDoc = generateProjectDocumentation(exportData);
    zip.file('Project_Overview.md', projectDoc);
    
    // Add detailed reports
    const tasksReport = generateTasksReport(exportData);
    zip.file('Tasks_Report.md', tasksReport);
    
    const ordersReport = generateOrdersReport(exportData);
    zip.file('Orders_Report.md', ordersReport);
    
    const timeReport = generateTimeRegistrationReport(exportData);
    zip.file('Time_Registration_Report.md', timeReport);
    
    const brokenPartsReport = generateBrokenPartsReport(exportData);
    zip.file('Broken_Parts_Report.md', brokenPartsReport);
    
    // Add raw data as JSON
    const dataFolder = zip.folder('raw_data');
    dataFolder?.file('project.json', JSON.stringify(exportData.project, null, 2));
    dataFolder?.file('phases.json', JSON.stringify(exportData.phases, null, 2));
    dataFolder?.file('tasks.json', JSON.stringify(exportData.tasks, null, 2));
    dataFolder?.file('orders.json', JSON.stringify(exportData.orders, null, 2));
    dataFolder?.file('order_items.json', JSON.stringify(exportData.orderItems, null, 2));
    dataFolder?.file('time_registrations.json', JSON.stringify(exportData.timeRegistrations, null, 2));
    dataFolder?.file('broken_parts.json', JSON.stringify(exportData.brokenParts, null, 2));
    
    // Generate and download ZIP
    const blob = await zip.generateAsync({ type: 'blob' });
    const fileName = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_Export_${new Date().toISOString().split('T')[0]}.zip`;
    saveAs(blob, fileName);
    
  } catch (error) {
    console.error('Error exporting project data:', error);
    throw error;
  }
};

const collectProjectData = async (projectId: string): Promise<ExportData> => {
  // Get project details
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();
  
  if (projectError) throw projectError;
  
  // Get phases
  const { data: phases, error: phasesError } = await supabase
    .from('phases')
    .select('*')
    .eq('project_id', projectId)
    .order('start_date');
  
  if (phasesError) throw phasesError;
  
  // Get tasks with detailed information
  const phaseIds = phases?.map(p => p.id) || [];
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select(`
      *,
      assignee:assignee_id(name),
      completed_by_employee:completed_by(name),
      phases!inner(name, project_id)
    `)
    .in('phase_id', phaseIds)
    .order('due_date');
  
  if (tasksError) throw tasksError;
  
  // Get orders
  const orders = await orderService.getByProject(projectId);
  
  // Get order items for all orders
  let orderItems: any[] = [];
  for (const order of orders) {
    const items = await orderService.getOrderItems(order.id);
    orderItems = [...orderItems, ...items];
  }
  
  // Get time registrations for project tasks
  const taskIds = tasks?.map(t => t.id) || [];
  const { data: timeRegistrations, error: timeError } = await supabase
    .from('time_registrations')
    .select(`
      *,
      employees(name),
      tasks(title, phases(name))
    `)
    .in('task_id', taskIds)
    .order('start_time', { ascending: false });
  
  if (timeError) throw timeError;
  
  // Get broken parts for the project
  const { data: brokenParts, error: brokenPartsError } = await supabase
    .from('broken_parts')
    .select(`
      *,
      employees:reported_by(name),
      workstations:workstation_id(name)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  
  if (brokenPartsError) throw brokenPartsError;
  
  // Get employees and workstations for reference
  const { data: employees } = await supabase
    .from('employees')
    .select('*')
    .order('name');
  
  const { data: workstations } = await supabase
    .from('workstations')
    .select('*')
    .order('name');
  
  return {
    project: project || {},
    phases: phases || [],
    tasks: tasks || [],
    orders: orders || [],
    orderItems: orderItems || [],
    timeRegistrations: timeRegistrations || [],
    brokenParts: brokenParts || [],
    employees: employees || [],
    workstations: workstations || []
  };
};

const generateProjectDocumentation = (data: ExportData): string => {
  const project = data.project;
  const totalTasks = data.tasks.length;
  const completedTasks = data.tasks.filter(t => t.status === 'COMPLETED').length;
  const totalOrders = data.orders.length;
  const totalTimeSpent = data.timeRegistrations.reduce((sum, reg) => sum + (reg.duration_minutes || 0), 0);
  
  return `# Project Export: ${project.name}

## Project Overview
- **Client:** ${project.client}
- **Description:** ${project.description || 'No description provided'}
- **Start Date:** ${new Date(project.start_date).toLocaleDateString()}
- **Installation Date:** ${new Date(project.installation_date).toLocaleDateString()}
- **Status:** ${project.status}
- **Progress:** ${project.progress}%

## Project Statistics
- **Total Phases:** ${data.phases.length}
- **Total Tasks:** ${totalTasks}
- **Completed Tasks:** ${completedTasks} (${Math.round((completedTasks/totalTasks) * 100)}%)
- **Total Orders:** ${totalOrders}
- **Total Time Spent:** ${Math.round(totalTimeSpent / 60)} hours
- **Broken Parts Reported:** ${data.brokenParts.length}

## Phases
${data.phases.map(phase => `
### ${phase.name}
- **Start Date:** ${new Date(phase.start_date).toLocaleDateString()}
- **End Date:** ${new Date(phase.end_date).toLocaleDateString()}
- **Progress:** ${phase.progress}%
`).join('')}

## Export Information
- **Exported on:** ${new Date().toLocaleString()}
- **Export includes:** Tasks, Orders, Time Registrations, Broken Parts, and detailed reports
`;
};

const generateTasksReport = (data: ExportData): string => {
  return `# Tasks Report - ${data.project.name}

## Task Summary
Total Tasks: ${data.tasks.length}
- Completed: ${data.tasks.filter(t => t.status === 'COMPLETED').length}
- In Progress: ${data.tasks.filter(t => t.status === 'IN_PROGRESS').length}
- Todo: ${data.tasks.filter(t => t.status === 'TODO').length}
- On Hold: ${data.tasks.filter(t => t.status === 'HOLD').length}

## Detailed Task List
${data.tasks.map(task => `
### ${task.title}
- **Phase:** ${task.phases?.name || 'N/A'}
- **Status:** ${task.status}
- **Priority:** ${task.priority}
- **Due Date:** ${new Date(task.due_date).toLocaleDateString()}
- **Assignee:** ${task.assignee?.name || 'Unassigned'}
- **Workstation:** ${task.workstation}
- **Description:** ${task.description || 'No description'}
${task.completed_at ? `- **Completed:** ${new Date(task.completed_at).toLocaleString()} by ${task.completed_by_employee?.name || 'Unknown'}` : ''}
${task.duration ? `- **Estimated Duration:** ${task.duration} minutes` : ''}
`).join('')}
`;
};

const generateOrdersReport = (data: ExportData): string => {
  return `# Orders Report - ${data.project.name}

## Order Summary
Total Orders: ${data.orders.length}
Total Items: ${data.orderItems.length}

## Detailed Orders
${data.orders.map(order => {
  const items = data.orderItems.filter(item => item.order_id === order.id);
  return `
### Order ${order.id}
- **Supplier:** ${order.supplier}
- **Order Date:** ${new Date(order.order_date).toLocaleDateString()}
- **Expected Delivery:** ${new Date(order.expected_delivery).toLocaleDateString()}
- **Status:** ${order.status}

#### Items:
${items.map(item => `
- **${item.description}**
  - Article Code: ${item.article_code || 'N/A'}
  - Quantity: ${item.quantity}
  - Unit Price: €${item.unit_price || 'N/A'}
  - Total: €${item.total_price || 'N/A'}
`).join('')}
`;
}).join('')}
`;
};

const generateTimeRegistrationReport = (data: ExportData): string => {
  const totalHours = data.timeRegistrations.reduce((sum, reg) => sum + (reg.duration_minutes || 0), 0) / 60;
  
  return `# Time Registration Report - ${data.project.name}

## Summary
- **Total Time Registered:** ${totalHours.toFixed(2)} hours
- **Total Registrations:** ${data.timeRegistrations.length}

## Detailed Registrations
${data.timeRegistrations.map(reg => `
### Registration ${reg.id}
- **Employee:** ${reg.employees?.name || 'Unknown'}
- **Task:** ${reg.tasks?.title || 'Unknown'}
- **Phase:** ${reg.tasks?.phases?.name || 'Unknown'}
- **Start Time:** ${new Date(reg.start_time).toLocaleString()}
- **End Time:** ${reg.end_time ? new Date(reg.end_time).toLocaleString() : 'Still active'}
- **Duration:** ${reg.duration_minutes ? `${Math.round(reg.duration_minutes / 60 * 100) / 100} hours` : 'N/A'}
`).join('')}
`;
};

const generateBrokenPartsReport = (data: ExportData): string => {
  return `# Broken Parts Report - ${data.project.name}

## Summary
Total Broken Parts Reported: ${data.brokenParts.length}

## Detailed Reports
${data.brokenParts.map(part => `
### Report ${part.id}
- **Reported by:** ${part.employees?.name || 'Unknown'}
- **Workstation:** ${part.workstations?.name || 'Not specified'}
- **Description:** ${part.description}
- **Reported on:** ${new Date(part.created_at).toLocaleString()}
${part.image_path ? `- **Image:** Attached (${part.image_path})` : '- **Image:** No image provided'}
`).join('')}
`;
};
