import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Project } from '@/services/dataService';
import { orderService } from '@/services/orderService';

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
  documents: any[];
  orderAttachments: any[];
}

// Custom file download function to replace file-saver
const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportProjectData = async (project: Project): Promise<void> => {
  try {
    // Import the PDF export service
    const { exportProjectToPDF } = await import('./projectPdfExportService');
    
    // Export as comprehensive PDF
    await exportProjectToPDF(project);
  } catch (error) {
    console.error('Error exporting project data:', error);
    throw error;
  }
};

export const exportProjectDataAsZip = async (project: Project): Promise<void> => {
  try {
    // Collect all project data
    const exportData = await collectProjectData(project.id);
    
    // Generate comprehensive PDF and add it to ZIP
    const { generateProjectPDFBlob } = await import('./projectPdfExportService');
    
    // Generate ZIP file
    const zip = new JSZip();
    
    // Add comprehensive PDF to ZIP
    try {
      const pdfBlob = await generateProjectPDFBlob(project);
      const pdfFileName = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_Complete_Report.pdf`;
      zip.file(pdfFileName, pdfBlob);
    } catch (error) {
      console.error('Failed to generate PDF for ZIP:', error);
      // Continue with export even if PDF generation fails
    }
    
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
    
    // Add Excel files
    const excelFolder = zip.folder('excel_files');
    
    // Tasks Excel
    const tasksWorkbook = generateTasksExcel(exportData);
    const tasksBuffer = XLSX.write(tasksWorkbook, { type: 'array', bookType: 'xlsx' });
    excelFolder?.file('Tasks.xlsx', tasksBuffer);
    
    // Orders Excel
    const ordersWorkbook = generateOrdersExcel(exportData);
    const ordersBuffer = XLSX.write(ordersWorkbook, { type: 'array', bookType: 'xlsx' });
    excelFolder?.file('Orders.xlsx', ordersBuffer);
    
    // Time Registration Excel
    const timeWorkbook = generateTimeRegistrationExcel(exportData);
    const timeBuffer = XLSX.write(timeWorkbook, { type: 'array', bookType: 'xlsx' });
    excelFolder?.file('Time_Registrations.xlsx', timeBuffer);
    
    // Project Overview Excel
    const overviewWorkbook = generateProjectOverviewExcel(exportData);
    const overviewBuffer = XLSX.write(overviewWorkbook, { type: 'array', bookType: 'xlsx' });
    excelFolder?.file('Project_Overview.xlsx', overviewBuffer);
    
    // Add project documents (files from file manager)
    if (exportData.documents.length > 0) {
      const documentsFolder = zip.folder('project_documents');
      for (const doc of exportData.documents) {
        try {
          const { data, error } = await supabase.storage
            .from('project_files')
            .download(`${project.id}/${doc.name}`);
          if (error) throw error;
          documentsFolder?.file(doc.name, data);
        } catch(e) {
          console.error(`Failed to download document ${doc.name}:`, e);
          documentsFolder?.file(`${doc.name}.error.txt`, `Could not download file.`);
        }
      }
    }

    // Add broken part images
    if (exportData.brokenParts.some(p => p.image_path)) {
      const brokenPartsImagesFolder = zip.folder('broken_parts_images');
      for (const part of exportData.brokenParts) {
        if (part.image_path) {
          try {
            const { data, error } = await supabase.storage
              .from('broken_parts')
              .download(part.image_path);
            if (error) throw error;
            brokenPartsImagesFolder?.file(part.image_path.split('/').pop() || part.image_path, data);
          } catch(e) {
            console.error(`Failed to download broken part image ${part.image_path}:`, e);
            brokenPartsImagesFolder?.file(`${part.image_path.split('/').pop() || part.image_path}.error.txt`, `Could not download file.`);
          }
        }
      }
    }

    // Add order attachments (e.g. delivery notes)
    if (exportData.orderAttachments.length > 0) {
      const attachmentsFolder = zip.folder('order_attachments');
      for (const attachment of exportData.orderAttachments) {
        try {
          const { data, error } = await supabase.storage
            .from('order_attachments')
            .download(attachment.file_path);
          if (error) throw error;
          attachmentsFolder?.file(attachment.file_name, data);
        } catch(e) {
          console.error(`Failed to download attachment ${attachment.file_name}:`, e);
          attachmentsFolder?.file(`${attachment.file_name}.error.txt`, `Could not download file.`);
        }
      }
    }
    
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
    downloadBlob(blob, fileName);
    
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
  if (orders.length > 0) {
    const orderIds = orders.map(order => order.id);
    const { data: items, error } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds);
    if (error) throw error;
    orderItems = items || [];
  }
  
  // Get order attachments
  const orderIdsForAttachments = orders.map(o => o.id);
  let orderAttachments: any[] = [];
  if (orderIdsForAttachments.length > 0) {
      const { data: attachments, error: attachmentsError } = await supabase
          .from('order_attachments')
          .select('*')
          .in('order_id', orderIdsForAttachments);

      if (attachmentsError) throw attachmentsError;
      orderAttachments = attachments || [];
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
    timeRegistrations: timeRegistrations || [],
    brokenParts: brokenParts || [],
    employees: employees || [],
    workstations: workstations || [],
    documents: documents || [],
    orderAttachments: orderAttachments || [],
  };
};

const generateTasksExcel = (data: ExportData): XLSX.WorkBook => {
  const workbook = XLSX.utils.book_new();
  
  // Tasks summary sheet
  const summaryData = [
    ['Total Tasks', data.tasks.length],
    ['Completed Tasks', data.tasks.filter(t => t.status === 'COMPLETED').length],
    ['In Progress Tasks', data.tasks.filter(t => t.status === 'IN_PROGRESS').length],
    ['Todo Tasks', data.tasks.filter(t => t.status === 'TODO').length],
    ['On Hold Tasks', data.tasks.filter(t => t.status === 'HOLD').length]
  ];
  
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  
  // Detailed tasks sheet
  const tasksData = data.tasks.map(task => ({
    'Task Title': task.title,
    'Phase': task.phases?.name || 'N/A',
    'Status': task.status,
    'Priority': task.priority,
    'Due Date': new Date(task.due_date).toLocaleDateString(),
    'Assignee': task.assignee?.name || 'Unassigned',
    'Workstation': task.workstation,
    'Description': task.description || 'No description',
    'Completed At': task.completed_at ? new Date(task.completed_at).toLocaleString() : '',
    'Completed By': task.completed_by_employee?.name || '',
    'Duration (minutes)': task.duration || ''
  }));
  
  const tasksSheet = XLSX.utils.json_to_sheet(tasksData);
  XLSX.utils.book_append_sheet(workbook, tasksSheet, 'Tasks');
  
  return workbook;
};

const generateOrdersExcel = (data: ExportData): XLSX.WorkBook => {
  const workbook = XLSX.utils.book_new();
  
  // Orders sheet
  const ordersData = data.orders.map(order => ({
    'Order ID': order.id,
    'Supplier': order.supplier,
    'Order Date': new Date(order.order_date).toLocaleDateString(),
    'Expected Delivery': new Date(order.expected_delivery).toLocaleDateString(),
    'Status': order.status
  }));
  
  const ordersSheet = XLSX.utils.json_to_sheet(ordersData);
  XLSX.utils.book_append_sheet(workbook, ordersSheet, 'Orders');
  
  // Order items sheet
  const itemsData = data.orderItems.map(item => ({
    'Order ID': item.order_id,
    'Description': item.description,
    'Article Code': item.article_code || 'N/A',
    'Quantity': item.quantity,
    'Unit Price': item.unit_price || 'N/A',
    'Total Price': item.total_price || 'N/A'
  }));
  
  const itemsSheet = XLSX.utils.json_to_sheet(itemsData);
  XLSX.utils.book_append_sheet(workbook, itemsSheet, 'Order Items');
  
  return workbook;
};

const generateTimeRegistrationExcel = (data: ExportData): XLSX.WorkBook => {
  const workbook = XLSX.utils.book_new();

  // Summary by Employee
  const employeeHours: { [key: string]: number } = {};
  data.timeRegistrations.forEach(reg => {
    const employeeName = reg.employees?.name || 'Unknown';
    if (reg.duration_minutes) {
      employeeHours[employeeName] = (employeeHours[employeeName] || 0) + reg.duration_minutes;
    }
  });

  const employeeSummaryData = Object.entries(employeeHours).map(([name, minutes]) => ({
    'Employee': name,
    'Total Hours': Math.round(minutes / 60 * 100) / 100
  }));

  const employeeSummarySheet = XLSX.utils.json_to_sheet(employeeSummaryData.length > 0 ? employeeSummaryData : [
    { 'Info': 'No time registered with duration.' }
  ]);
  XLSX.utils.book_append_sheet(workbook, employeeSummarySheet, 'Summary by Employee');
  
  const timeData = data.timeRegistrations.map(reg => ({
    'Employee': reg.employees?.name || 'Unknown',
    'Task': reg.tasks?.title || 'Unknown',
    'Phase': reg.tasks?.phases?.name || 'Unknown',
    'Start Time': new Date(reg.start_time).toLocaleString(),
    'End Time': reg.end_time ? new Date(reg.end_time).toLocaleString() : 'Still active',
    'Duration (hours)': reg.duration_minutes ? Math.round(reg.duration_minutes / 60 * 100) / 100 : 'N/A'
  }));
  
  const timeSheet = XLSX.utils.json_to_sheet(timeData);
  XLSX.utils.book_append_sheet(workbook, timeSheet, 'Time Registrations');
  
  return workbook;
};

const generateProjectOverviewExcel = (data: ExportData): XLSX.WorkBook => {
  const workbook = XLSX.utils.book_new();
  
  // Project info
  const projectInfo = [
    ['Project Name', data.project.name],
    ['Client', data.project.client],
    ['Description', data.project.description || 'No description'],
    ['Start Date', new Date(data.project.start_date).toLocaleDateString()],
    ['Installation Date', new Date(data.project.installation_date).toLocaleDateString()],
    ['Status', data.project.status],
    ['Progress', `${data.project.progress}%`]
  ];
  
  const projectSheet = XLSX.utils.aoa_to_sheet(projectInfo);
  XLSX.utils.book_append_sheet(workbook, projectSheet, 'Project Info');
  
  // Phases
  const phasesData = data.phases.map(phase => ({
    'Phase Name': phase.name,
    'Start Date': new Date(phase.start_date).toLocaleDateString(),
    'End Date': new Date(phase.end_date).toLocaleDateString(),
    'Progress': `${phase.progress}%`
  }));
  
  const phasesSheet = XLSX.utils.json_to_sheet(phasesData);
  XLSX.utils.book_append_sheet(workbook, phasesSheet, 'Phases');
  
  return workbook;
};

const addProjectDocuments = async (documentsFolder: any, documents: any[]) => {
  // Add document references
  const documentsList = documents.map(doc => 
    `${doc.name}: ${doc.url || 'No URL available'}`
  ).join('\n');
  
  documentsFolder?.file('documents_list.txt', documentsList);
  
  // Note: In a real implementation, you would download actual files from OneDrive
  // For now, we're just creating a reference file
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
- **Completed Tasks:** ${completedTasks} (${totalTasks > 0 ? Math.round((completedTasks/totalTasks) * 100) : 0}%)
- **Total Orders:** ${totalOrders}
- **Total Time Spent:** ${Math.round(totalTimeSpent / 60)} hours
- **Broken Parts Reported:** ${data.brokenParts.length}
- **Project Documents:** ${data.documents.length}

## Phases
${data.phases.map(phase => `
### ${phase.name}
- **Start Date:** ${new Date(phase.start_date).toLocaleDateString()}
- **End Date:** ${new Date(phase.end_date).toLocaleDateString()}
- **Progress:** ${phase.progress}%
`).join('')}

## Export Information
- **Exported on:** ${new Date().toLocaleString()}
- **Export includes:** Project Files, Order Attachments, Broken Part Images, Tasks, Orders, Time Registrations, Broken Parts, Excel files, and detailed reports
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
${part.image_path ? `- **Image:** See 'broken_parts_images/${part.image_path.split('/').pop() || part.image_path}' in ZIP.` : '- **Image:** No image provided'}
`).join('')}
`;
};
