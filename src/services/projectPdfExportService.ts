import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from '@/integrations/supabase/client';
import { Project } from '@/services/dataService';
import { orderService } from '@/services/orderService';
import { accessoriesService } from '@/services/accessoriesService';
import { projectChatService } from '@/services/projectChatService';
import { rushOrderService } from '@/services/rushOrderService';
import { partsListService } from '@/services/partsListService';

interface ComprehensiveExportData {
  project: Project;
  phases: any[];
  tasks: any[];
  orders: any[];
  orderItems: any[];
  orderAttachments: any[];
  accessories: any[];
  projectMessages: any[];
  rushOrders: any[];
  timeRegistrations: any[];
  brokenParts: any[];
  partsLists: any[];
  parts: any[];
  employees: any[];
  workstations: any[];
  documents: any[];
}

export const exportProjectToPDF = async (project: Project): Promise<void> => {
  try {
    // Collect all comprehensive project data
    const exportData = await collectComprehensiveProjectData(project.id);
    
    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let currentY = margin;

    // Title page
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Project Export Report', pageWidth / 2, currentY, { align: 'center' });
    
    currentY += 15;
    pdf.setFontSize(18);
    pdf.text(exportData.project.name, pageWidth / 2, currentY, { align: 'center' });
    
    currentY += 10;
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, currentY, { align: 'center' });

    // Project Overview
    pdf.addPage();
    currentY = margin;
    currentY = addSection(pdf, 'Project Overview', currentY, margin, contentWidth);
    currentY = addProjectOverview(pdf, exportData, currentY, margin, contentWidth);

    // Phases
    if (exportData.phases.length > 0) {
      currentY = checkPageBreak(pdf, currentY, 40, pageHeight, margin);
      currentY = addSection(pdf, 'Project Phases', currentY, margin, contentWidth);
      currentY = addPhasesData(pdf, exportData.phases, currentY, margin, contentWidth);
    }

    // Tasks
    if (exportData.tasks.length > 0) {
      currentY = checkPageBreak(pdf, currentY, 40, pageHeight, margin);
      currentY = addSection(pdf, 'Tasks', currentY, margin, contentWidth);
      currentY = addTasksData(pdf, exportData.tasks, currentY, margin, contentWidth);
    }

    // Orders
    if (exportData.orders.length > 0) {
      currentY = checkPageBreak(pdf, currentY, 40, pageHeight, margin);
      currentY = addSection(pdf, 'Orders', currentY, margin, contentWidth);
      currentY = addOrdersData(pdf, exportData, currentY, margin, contentWidth);
    }

    // Accessories
    if (exportData.accessories.length > 0) {
      currentY = checkPageBreak(pdf, currentY, 40, pageHeight, margin);
      currentY = addSection(pdf, 'Accessories', currentY, margin, contentWidth);
      currentY = addAccessoriesData(pdf, exportData.accessories, currentY, margin, contentWidth);
    }

    // Parts Lists
    if (exportData.partsLists.length > 0) {
      currentY = checkPageBreak(pdf, currentY, 40, pageHeight, margin);
      currentY = addSection(pdf, 'Parts Lists', currentY, margin, contentWidth);
      currentY = addPartsListsData(pdf, exportData, currentY, margin, contentWidth);
    }

    // Project Chat
    if (exportData.projectMessages.length > 0) {
      currentY = checkPageBreak(pdf, currentY, 40, pageHeight, margin);
      currentY = addSection(pdf, 'Project Communication', currentY, margin, contentWidth);
      currentY = addProjectMessagesData(pdf, exportData.projectMessages, currentY, margin, contentWidth);
    }

    // Rush Orders
    if (exportData.rushOrders.length > 0) {
      currentY = checkPageBreak(pdf, currentY, 40, pageHeight, margin);
      currentY = addSection(pdf, 'Rush Orders', currentY, margin, contentWidth);
      currentY = addRushOrdersData(pdf, exportData.rushOrders, currentY, margin, contentWidth);
    }

    // Time Registrations
    if (exportData.timeRegistrations.length > 0) {
      currentY = checkPageBreak(pdf, currentY, 40, pageHeight, margin);
      currentY = addSection(pdf, 'Time Registrations', currentY, margin, contentWidth);
      currentY = addTimeRegistrationsData(pdf, exportData.timeRegistrations, currentY, margin, contentWidth);
    }

    // Broken Parts
    if (exportData.brokenParts.length > 0) {
      currentY = checkPageBreak(pdf, currentY, 40, pageHeight, margin);
      currentY = addSection(pdf, 'Broken Parts Reports', currentY, margin, contentWidth);
      currentY = addBrokenPartsData(pdf, exportData.brokenParts, currentY, margin, contentWidth);
    }

    // Project Documents
    if (exportData.documents.length > 0) {
      currentY = checkPageBreak(pdf, currentY, 40, pageHeight, margin);
      currentY = addSection(pdf, 'Project Documents', currentY, margin, contentWidth);
      currentY = addDocumentsData(pdf, exportData.documents, currentY, margin, contentWidth);
    }

    // Save PDF
    const fileName = `${exportData.project.name.replace(/[^a-zA-Z0-9]/g, '_')}_Complete_Export_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);

  } catch (error) {
    console.error('Error exporting project to PDF:', error);
    throw error;
  }
};

const collectComprehensiveProjectData = async (projectId: string): Promise<ComprehensiveExportData> => {
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
  
  // Get order items and attachments
  let orderItems: any[] = [];
  let orderAttachments: any[] = [];
  if (orders.length > 0) {
    const orderIds = orders.map(order => order.id);
    
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds);
    if (itemsError) throw itemsError;
    orderItems = items || [];

    const { data: attachments, error: attachmentsError } = await supabase
      .from('order_attachments')
      .select('*')
      .in('order_id', orderIds);
    if (attachmentsError) throw attachmentsError;
    orderAttachments = attachments || [];
  }

  // Get accessories
  const accessories = await accessoriesService.getByProject(projectId);

  // Get project messages
  const projectMessages = await projectChatService.getProjectMessages(projectId);

  // Get rush orders
  const { data: rushOrders, error: rushOrdersError } = await supabase
    .from('rush_orders')
    .select(`
      *,
      rush_order_messages(
        id,
        message,
        created_at,
        employee_id,
        employees(name)
      )
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  
  if (rushOrdersError) throw rushOrdersError;

  // Get parts lists and parts
  const partsLists = await partsListService.getPartsListsByProject(projectId);
  let parts: any[] = [];
  if (partsLists.length > 0) {
    for (const partsList of partsLists) {
      const partsForList = await partsListService.getPartsByPartsList(partsList.id);
      parts.push(...partsForList);
    }
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
  
  // Get project documents from storage
  const { data: projectFilesList, error: projectFilesError } = await supabase.storage
    .from('project_files')
    .list(projectId);

  if (projectFilesError && !projectFilesError.message.includes('The resource was not found')) {
    throw projectFilesError;
  }

  const documents = projectFilesList?.filter(f => f.name !== '.folder' && !f.name.endsWith('/')) || [];

  return {
    project: project as Project,
    phases: phases || [],
    tasks: tasks || [],
    orders: orders || [],
    orderItems: orderItems || [],
    orderAttachments: orderAttachments || [],
    accessories: accessories || [],
    projectMessages: projectMessages || [],
    rushOrders: rushOrders || [],
    timeRegistrations: timeRegistrations || [],
    brokenParts: brokenParts || [],
    partsLists: partsLists || [],
    parts: parts || [],
    employees: employees || [],
    workstations: workstations || [],
    documents: documents || [],
  };
};

const checkPageBreak = (pdf: jsPDF, currentY: number, neededSpace: number, pageHeight: number, margin: number): number => {
  if (currentY + neededSpace > pageHeight - margin) {
    pdf.addPage();
    return margin;
  }
  return currentY;
};

const addSection = (pdf: jsPDF, title: string, currentY: number, margin: number, contentWidth: number): number => {
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, margin, currentY);
  return currentY + 10;
};

const addProjectOverview = (pdf: jsPDF, data: ComprehensiveExportData, currentY: number, margin: number, contentWidth: number): number => {
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  const overview = [
    `Client: ${data.project.client}`,
    `Description: ${data.project.description || 'No description provided'}`,
    `Start Date: ${new Date(data.project.start_date).toLocaleDateString()}`,
    `Installation Date: ${new Date(data.project.installation_date).toLocaleDateString()}`,
    `Status: ${data.project.status}`,
    `Progress: ${data.project.progress}%`,
    '',
    `Statistics:`,
    `- Total Phases: ${data.phases.length}`,
    `- Total Tasks: ${data.tasks.length}`,
    `- Total Orders: ${data.orders.length}`,
    `- Total Accessories: ${data.accessories.length}`,
    `- Total Messages: ${data.projectMessages.length}`,
    `- Total Rush Orders: ${data.rushOrders.length}`,
    `- Total Time Registrations: ${data.timeRegistrations.length}`,
    `- Total Broken Parts: ${data.brokenParts.length}`,
    `- Total Parts Lists: ${data.partsLists.length}`,
    `- Total Documents: ${data.documents.length}`,
  ];
  
  overview.forEach(line => {
    pdf.text(line, margin, currentY);
    currentY += 5;
  });
  
  return currentY + 5;
};

const addPhasesData = (pdf: jsPDF, phases: any[], currentY: number, margin: number, contentWidth: number): number => {
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  phases.forEach(phase => {
    currentY = checkPageBreak(pdf, currentY, 15, pdf.internal.pageSize.getHeight(), margin);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${phase.name}`, margin, currentY);
    currentY += 5;
    
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Start: ${new Date(phase.start_date).toLocaleDateString()}`, margin + 5, currentY);
    currentY += 4;
    pdf.text(`End: ${new Date(phase.end_date).toLocaleDateString()}`, margin + 5, currentY);
    currentY += 4;
    pdf.text(`Progress: ${phase.progress}%`, margin + 5, currentY);
    currentY += 8;
  });
  
  return currentY;
};

const addTasksData = (pdf: jsPDF, tasks: any[], currentY: number, margin: number, contentWidth: number): number => {
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  tasks.forEach(task => {
    currentY = checkPageBreak(pdf, currentY, 20, pdf.internal.pageSize.getHeight(), margin);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${task.title}`, margin, currentY);
    currentY += 5;
    
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Phase: ${task.phases?.name || 'N/A'}`, margin + 5, currentY);
    currentY += 4;
    pdf.text(`Status: ${task.status}`, margin + 5, currentY);
    currentY += 4;
    pdf.text(`Assignee: ${task.assignee?.name || 'Unassigned'}`, margin + 5, currentY);
    currentY += 4;
    pdf.text(`Due: ${new Date(task.due_date).toLocaleDateString()}`, margin + 5, currentY);
    currentY += 8;
  });
  
  return currentY;
};

const addOrdersData = (pdf: jsPDF, data: ComprehensiveExportData, currentY: number, margin: number, contentWidth: number): number => {
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  data.orders.forEach(order => {
    currentY = checkPageBreak(pdf, currentY, 25, pdf.internal.pageSize.getHeight(), margin);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Order: ${order.supplier}`, margin, currentY);
    currentY += 5;
    
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Date: ${new Date(order.order_date).toLocaleDateString()}`, margin + 5, currentY);
    currentY += 4;
    pdf.text(`Expected Delivery: ${new Date(order.expected_delivery).toLocaleDateString()}`, margin + 5, currentY);
    currentY += 4;
    pdf.text(`Status: ${order.status}`, margin + 5, currentY);
    currentY += 4;
    
    const orderItems = data.orderItems.filter(item => item.order_id === order.id);
    if (orderItems.length > 0) {
      pdf.text(`Items: ${orderItems.length}`, margin + 5, currentY);
      currentY += 4;
      orderItems.slice(0, 3).forEach(item => {
        pdf.text(`  - ${item.description} (${item.quantity})`, margin + 10, currentY);
        currentY += 4;
      });
      if (orderItems.length > 3) {
        pdf.text(`  ... and ${orderItems.length - 3} more items`, margin + 10, currentY);
        currentY += 4;
      }
    }
    currentY += 4;
  });
  
  return currentY;
};

const addAccessoriesData = (pdf: jsPDF, accessories: any[], currentY: number, margin: number, contentWidth: number): number => {
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  accessories.forEach(accessory => {
    currentY = checkPageBreak(pdf, currentY, 15, pdf.internal.pageSize.getHeight(), margin);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${accessory.article_name}`, margin, currentY);
    currentY += 5;
    
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Quantity: ${accessory.quantity}`, margin + 5, currentY);
    currentY += 4;
    pdf.text(`Status: ${accessory.status}`, margin + 5, currentY);
    currentY += 4;
    if (accessory.supplier) {
      pdf.text(`Supplier: ${accessory.supplier}`, margin + 5, currentY);
      currentY += 4;
    }
    currentY += 4;
  });
  
  return currentY;
};

const addPartsListsData = (pdf: jsPDF, data: ComprehensiveExportData, currentY: number, margin: number, contentWidth: number): number => {
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  data.partsLists.forEach(partsList => {
    currentY = checkPageBreak(pdf, currentY, 15, pdf.internal.pageSize.getHeight(), margin);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Parts List: ${partsList.file_name}`, margin, currentY);
    currentY += 5;
    
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Imported: ${new Date(partsList.imported_at).toLocaleDateString()}`, margin + 5, currentY);
    currentY += 4;
    
    const partsCount = data.parts.filter(part => part.parts_list_id === partsList.id).length;
    pdf.text(`Total Parts: ${partsCount}`, margin + 5, currentY);
    currentY += 8;
  });
  
  return currentY;
};

const addProjectMessagesData = (pdf: jsPDF, messages: any[], currentY: number, margin: number, contentWidth: number): number => {
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  // Show only recent messages to avoid overwhelming the PDF
  const recentMessages = messages.slice(0, 20);
  
  recentMessages.forEach(message => {
    currentY = checkPageBreak(pdf, currentY, 15, pdf.internal.pageSize.getHeight(), margin);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${message.employee?.name || 'Unknown'} - ${new Date(message.created_at).toLocaleDateString()}`, margin, currentY);
    currentY += 5;
    
    pdf.setFont('helvetica', 'normal');
    const messageText = message.message.length > 100 ? message.message.substring(0, 100) + '...' : message.message;
    pdf.text(messageText, margin + 5, currentY);
    currentY += 8;
  });
  
  if (messages.length > 20) {
    pdf.text(`... and ${messages.length - 20} more messages`, margin, currentY);
    currentY += 8;
  }
  
  return currentY;
};

const addRushOrdersData = (pdf: jsPDF, rushOrders: any[], currentY: number, margin: number, contentWidth: number): number => {
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  rushOrders.forEach(rushOrder => {
    currentY = checkPageBreak(pdf, currentY, 20, pdf.internal.pageSize.getHeight(), margin);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${rushOrder.title}`, margin, currentY);
    currentY += 5;
    
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Priority: ${rushOrder.priority}`, margin + 5, currentY);
    currentY += 4;
    pdf.text(`Status: ${rushOrder.status}`, margin + 5, currentY);
    currentY += 4;
    pdf.text(`Deadline: ${new Date(rushOrder.deadline).toLocaleDateString()}`, margin + 5, currentY);
    currentY += 4;
    
    if (rushOrder.rush_order_messages && rushOrder.rush_order_messages.length > 0) {
      pdf.text(`Messages: ${rushOrder.rush_order_messages.length}`, margin + 5, currentY);
      currentY += 4;
    }
    currentY += 4;
  });
  
  return currentY;
};

const addTimeRegistrationsData = (pdf: jsPDF, timeRegistrations: any[], currentY: number, margin: number, contentWidth: number): number => {
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  // Summary first
  const totalHours = timeRegistrations.reduce((sum, reg) => sum + (reg.duration_minutes || 0), 0) / 60;
  pdf.setFont('helvetica', 'bold');
  pdf.text(`Total Time Spent: ${Math.round(totalHours * 100) / 100} hours`, margin, currentY);
  currentY += 8;
  
  // Employee breakdown
  const employeeHours: { [key: string]: number } = {};
  timeRegistrations.forEach(reg => {
    const employeeName = reg.employees?.name || 'Unknown';
    if (reg.duration_minutes) {
      employeeHours[employeeName] = (employeeHours[employeeName] || 0) + reg.duration_minutes;
    }
  });
  
  pdf.setFont('helvetica', 'normal');
  pdf.text('Time by Employee:', margin, currentY);
  currentY += 5;
  
  Object.entries(employeeHours).forEach(([name, minutes]) => {
    pdf.text(`  ${name}: ${Math.round(minutes / 60 * 100) / 100} hours`, margin + 5, currentY);
    currentY += 4;
  });
  
  return currentY + 5;
};

const addBrokenPartsData = (pdf: jsPDF, brokenParts: any[], currentY: number, margin: number, contentWidth: number): number => {
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  brokenParts.forEach(part => {
    currentY = checkPageBreak(pdf, currentY, 15, pdf.internal.pageSize.getHeight(), margin);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`Broken Part Report`, margin, currentY);
    currentY += 5;
    
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Reported by: ${part.employees?.name || 'Unknown'}`, margin + 5, currentY);
    currentY += 4;
    pdf.text(`Workstation: ${part.workstations?.name || 'Unknown'}`, margin + 5, currentY);
    currentY += 4;
    pdf.text(`Date: ${new Date(part.created_at).toLocaleDateString()}`, margin + 5, currentY);
    currentY += 4;
    
    const description = part.description.length > 80 ? part.description.substring(0, 80) + '...' : part.description;
    pdf.text(`Description: ${description}`, margin + 5, currentY);
    currentY += 4;
    
    if (part.image_path) {
      pdf.text(`Image: Available`, margin + 5, currentY);
      currentY += 4;
    }
    currentY += 4;
  });
  
  return currentY;
};

const addDocumentsData = (pdf: jsPDF, documents: any[], currentY: number, margin: number, contentWidth: number): number => {
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  
  documents.forEach(doc => {
    currentY = checkPageBreak(pdf, currentY, 8, pdf.internal.pageSize.getHeight(), margin);
    pdf.text(`- ${doc.name}`, margin, currentY);
    currentY += 5;
  });
  
  return currentY;
};