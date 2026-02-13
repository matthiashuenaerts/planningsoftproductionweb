
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { useAuth } from '@/context/AuthContext';
import { Clock, Users, Calendar, BarChart3, Download, Filter, DollarSign, Plus, Edit, FileText, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { subWeeks, subMonths } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ManualTimeRegistrationDialog } from '@/components/ManualTimeRegistrationDialog';
import { EditTimeRegistrationDialog } from '@/components/EditTimeRegistrationDialog';
import { workingHoursService, WorkingHours } from '@/services/workingHoursService';
import { useIsMobile } from '@/hooks/use-mobile';
import { standardTasksService, StandardTask } from '@/services/standardTasksService';
import { useTenant } from '@/context/TenantContext';

const TimeRegistrations = () => {
  const { currentEmployee } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { tenant } = useTenant();
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: ''
  });
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [taskFilter, setTaskFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<any>(null);
  const [showMonthlyReportDialog, setShowMonthlyReportDialog] = useState(false);
  const [monthlyReportDates, setMonthlyReportDates] = useState({
    startDate: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTimeframe, setDeleteTimeframe] = useState<'week' | 'month' | '6months' | 'year' | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if user is admin or manager
  const canViewAllRegistrations = currentEmployee && ['admin', 'manager'].includes(currentEmployee.role);

  const { data: allRegistrations = [], isLoading } = useQuery({
    queryKey: ['allTimeRegistrations', tenant?.id],
    queryFn: () => timeRegistrationService.getAllRegistrations(tenant?.id),
    enabled: !!canViewAllRegistrations
  });

  const { data: myRegistrations = [] } = useQuery({
    queryKey: ['myTimeRegistrations', currentEmployee?.id, tenant?.id],
    queryFn: () => currentEmployee ? timeRegistrationService.getRegistrationsByEmployee(currentEmployee.id, tenant?.id) : [],
    enabled: !!currentEmployee
  });

  const { data: workingHours = [] } = useQuery<WorkingHours[]>({
    queryKey: ['workingHours'],
    queryFn: () => workingHoursService.getWorkingHours(),
  });

  const { data: allStandardTasks = [] } = useQuery<StandardTask[]>({
    queryKey: ['allStandardTasks'],
    queryFn: () => standardTasksService.getAll(),
  });

  const isFilterActive = React.useMemo(() => (
    (canViewAllRegistrations && selectedEmployee !== 'all') ||
    dateFilter.startDate !== '' ||
    dateFilter.endDate !== '' ||
    projectFilter !== 'all' ||
    taskFilter !== 'all'
  ), [canViewAllRegistrations, selectedEmployee, dateFilter, projectFilter, taskFilter]);

  const filteredRegistrations = React.useMemo(() => {
    let sourceData = canViewAllRegistrations ? allRegistrations : myRegistrations;
    if (!isFilterActive) {
      return sourceData.slice(0, 50);
    }

    let filtered = sourceData;

    // Employee filter (only for admins/managers)
    if (canViewAllRegistrations && selectedEmployee !== 'all') {
      filtered = filtered.filter((reg: any) => reg.employee_id === selectedEmployee);
    }

    // Date filters
    if (dateFilter.startDate) {
      filtered = filtered.filter((reg: any) => 
        new Date(reg.start_time) >= new Date(dateFilter.startDate)
      );
    }
    if (dateFilter.endDate) {
      filtered = filtered.filter((reg: any) => 
        new Date(reg.start_time) <= new Date(dateFilter.endDate + 'T23:59:59')
      );
    }

    // Project filter
    if (projectFilter !== 'all') {
      filtered = filtered.filter((reg: any) => 
        reg.tasks?.phases?.projects?.id === projectFilter ||
        reg.workstation_tasks?.workstations?.id === projectFilter
      );
    }

    // Task filter (by standard task - only applies to project tasks, not workstation tasks)
    if (taskFilter !== 'all') {
      filtered = filtered.filter((reg: any) => 
        reg.tasks?.standard_task_id === taskFilter
      );
    }

    return filtered;
  }, [allRegistrations, myRegistrations, canViewAllRegistrations, selectedEmployee, dateFilter, projectFilter, taskFilter, isFilterActive]);

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatDateTime = (dateString: string) => {
    return format(parseISO(dateString), 'MMM dd, yyyy HH:mm');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
  };

  const getUniqueEmployees = (registrations: any[]) => {
    const employees = new Set();
    registrations.forEach((reg: any) => {
      if (reg.employees) {
        employees.add(JSON.stringify({
          id: reg.employee_id,
          name: reg.employees.name
        }));
      }
    });
    return Array.from(employees).map((emp: any) => JSON.parse(emp));
  };

  const getUniqueProjects = (registrations: any[]) => {
    const projects = new Map<string, { id: string; name: string }>();
    registrations.forEach((reg: any) => {
      if (reg.tasks?.phases?.projects) {
        projects.set(reg.tasks.phases.projects.id, {
          id: reg.tasks.phases.projects.id,
          name: reg.tasks.phases.projects.name
        });
      } else if (reg.workstation_tasks?.workstations) {
        projects.set(reg.workstation_tasks.workstations.id, {
          id: reg.workstation_tasks.workstations.id,
          name: `Workstation: ${reg.workstation_tasks.workstations.name}`
        });
      }
    });
    return Array.from(projects.values());
  };

  const getUniqueStandardTasks = () => {
    return allStandardTasks.map(task => ({
      id: task.id,
      name: task.task_name,
    }));
  };

  const { totalFilteredMinutes, totalCost } = filteredRegistrations.reduce(
    (acc: { totalFilteredMinutes: number; totalCost: number; }, reg: any) => {
      const duration = reg.duration_minutes || 0;
      acc.totalFilteredMinutes += duration;
      
      const hourlyCost = reg.tasks?.standard_tasks?.hourly_cost;
      if (hourlyCost && duration > 0) {
        const cost = (duration / 60) * hourlyCost;
        acc.totalCost += parseFloat(cost.toFixed(2));
      }
      
      return acc;
    },
    { totalFilteredMinutes: 0, totalCost: 0 }
  );
  
  // Calculate statistics
  const todayRegistrations = filteredRegistrations.filter((reg: any) => {
    const regDate = new Date(reg.start_time).toDateString();
    const today = new Date().toDateString();
    return regDate === today;
  });

  const totalMinutesToday = todayRegistrations.reduce((total: number, reg: any) => 
    total + (reg.duration_minutes || 0), 0
  );

  const activeRegistrations = filteredRegistrations.filter((reg: any) => reg.is_active);

  const handleDeleteOldRegistrations = async () => {
    if (!deleteTimeframe) return;
    
    setIsDeleting(true);
    try {
      const now = new Date();
      let cutoffDate: Date;
      
      switch (deleteTimeframe) {
        case 'week':
          cutoffDate = subWeeks(now, 1);
          break;
        case 'month':
          cutoffDate = subMonths(now, 1);
          break;
        case '6months':
          cutoffDate = subMonths(now, 6);
          break;
        case 'year':
          cutoffDate = subMonths(now, 12);
          break;
        default:
          return;
      }
      
      const deletedCount = await timeRegistrationService.deleteRegistrationsOlderThan(cutoffDate);
      
      toast({
        title: t("registrations_deleted"),
        description: t("deleted_count", { count: deletedCount.toString() }),
      });
      
      queryClient.invalidateQueries({ queryKey: ['allTimeRegistrations'] });
      queryClient.invalidateQueries({ queryKey: ['myTimeRegistrations'] });
    } catch (error) {
      console.error('Error deleting registrations:', error);
      toast({
        title: t("error"),
        description: t("failed_to_delete_registrations"),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
      setDeleteTimeframe(null);
    }
  };

  // Draw branded header for PDF exports
  const drawBrandedHeader = async (pdf: any, pageWidth: number, margin: number): Promise<number> => {
    let yPos = margin;
    const brandColor = { r: 45, g: 115, b: 135 }; // Teal color from logo
    
    // Load and add logo image
    try {
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = () => reject(new Error('Failed to load logo'));
        logoImg.src = '/images/automattion-compass-logo.png';
      });
      
      // Add logo to PDF (centered)
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
    pdf.setTextColor(brandColor.r, brandColor.g, brandColor.b);
    pdf.text('AutoMattiOn', pageWidth / 2 - 2, yPos, { align: 'right' });
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(80, 180, 210);
    pdf.text(' Compass', pageWidth / 2 - 2, yPos, { align: 'left' });
    yPos += 6;
    
    // Slogan
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(80, 180, 210);
    pdf.text('Guiding your production to perfection!', pageWidth / 2, yPos, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
    yPos += 10;
    
    // Divider line
    pdf.setDrawColor(brandColor.r, brandColor.g, brandColor.b);
    pdf.setLineWidth(0.5);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
    
    return yPos;
  };

  const generateMonthlyReport = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      
      // Get working hours configuration for overtime calculation
      const getWorkingHoursForDate = (date: Date, team: 'production' | 'installation' | 'preparation') => {
        const dayOfWeek = date.getDay();
        const hours = workingHoursService.getWorkingHoursForDay(workingHours, team, dayOfWeek);
        
        if (hours) {
          const [startHour, startMin] = hours.start_time.split(':').map(Number);
          const [endHour, endMin] = hours.end_time.split(':').map(Number);
          return {
            startHour: startHour + startMin / 60,
            endHour: endHour + endMin / 60,
            breakMinutes: hours.break_minutes,
          };
        }
        
        // Default to 8:00-17:00 if not configured
        return { startHour: 8, endHour: 17, breakMinutes: 0 };
      };

      // Filter registrations by selected date range
      const reportRegistrations = (canViewAllRegistrations ? allRegistrations : myRegistrations).filter((reg: any) => {
        const regDate = new Date(reg.start_time);
        const start = new Date(monthlyReportDates.startDate);
        const end = new Date(monthlyReportDates.endDate + 'T23:59:59');
        return regDate >= start && regDate <= end;
      });

      // Group registrations by employee and date
      type DailyData = {
        date: string;
        employeeName: string;
        totalMinutes: number;
        earliestStart: Date | null;
        latestEnd: Date | null;
        overtimeMinutes: number;
        registrations: any[];
      };

      const dailyDataMap = new Map<string, DailyData>();
      const employeeTotals = new Map<string, { totalMinutes: number; overtimeMinutes: number; days: number }>();

      reportRegistrations.forEach((reg: any) => {
        if (!reg.start_time || !reg.end_time) return;

        const employeeName = reg.employees?.name || t("unknown_employee");
        const startDate = new Date(reg.start_time);
        const endDate = new Date(reg.end_time);
        const dateKey = format(startDate, 'yyyy-MM-dd');
        const mapKey = `${reg.employee_id}_${dateKey}`;

        if (!dailyDataMap.has(mapKey)) {
          dailyDataMap.set(mapKey, {
            date: dateKey,
            employeeName,
            totalMinutes: 0,
            earliestStart: null,
            latestEnd: null,
            overtimeMinutes: 0,
            registrations: []
          });
        }

        const dailyData = dailyDataMap.get(mapKey)!;
        dailyData.totalMinutes += reg.duration_minutes || 0;
        dailyData.registrations.push(reg);

        // Track earliest start and latest end
        if (!dailyData.earliestStart || startDate < dailyData.earliestStart) {
          dailyData.earliestStart = startDate;
        }
        if (!dailyData.latestEnd || endDate > dailyData.latestEnd) {
          dailyData.latestEnd = endDate;
        }

        // Calculate overtime based on configured working hours
        const team = (reg.employees?.workstation?.toLowerCase().includes('install') ? 'installation' : 
                     reg.employees?.workstation?.toLowerCase().includes('prep') ? 'preparation' : 
                     'production') as 'production' | 'installation' | 'preparation';
        
        const workingHoursConfig = getWorkingHoursForDate(startDate, team);
        const startHour = startDate.getHours() + startDate.getMinutes() / 60;
        const endHour = endDate.getHours() + endDate.getMinutes() / 60;
        
        // Calculate overtime before work hours
        if (startHour < workingHoursConfig.startHour) {
          const overtimeHours = Math.min(workingHoursConfig.startHour - startHour, (reg.duration_minutes || 0) / 60);
          dailyData.overtimeMinutes += overtimeHours * 60;
        }
        
        // Calculate overtime after work hours
        if (endHour > workingHoursConfig.endHour) {
          const overtimeHours = Math.min(endHour - workingHoursConfig.endHour, (reg.duration_minutes || 0) / 60);
          dailyData.overtimeMinutes += overtimeHours * 60;
        }

        // Update employee totals
        if (!employeeTotals.has(employeeName)) {
          employeeTotals.set(employeeName, { totalMinutes: 0, overtimeMinutes: 0, days: 0 });
        }
      });

      // Calculate employee totals from daily data
      dailyDataMap.forEach((data) => {
        const totals = employeeTotals.get(data.employeeName)!;
        totals.totalMinutes += data.totalMinutes;
        totals.overtimeMinutes += data.overtimeMinutes;
        totals.days += 1;
      });

      // Sort by employee name and date
      const sortedData = Array.from(dailyDataMap.values()).sort((a, b) => {
        const nameCompare = a.employeeName.localeCompare(b.employeeName);
        if (nameCompare !== 0) return nameCompare;
        return a.date.localeCompare(b.date);
      });

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      
      // Draw branded header
      let yPos = await drawBrandedHeader(pdf, pageWidth, margin);

      // Helper function to add new page if needed
      const checkPageBreak = (requiredSpace: number) => {
        if (yPos + requiredSpace > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
          return true;
        }
        return false;
      };

      // Report title
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text(t("monthly_report"), pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;

      // Date range
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      const dateRangeText = `${format(new Date(monthlyReportDates.startDate), 'dd/MM/yyyy')} - ${format(new Date(monthlyReportDates.endDate), 'dd/MM/yyyy')}`;
      pdf.text(dateRangeText, pageWidth / 2, yPos, { align: 'center' });
      yPos += 6;

      // Generated date
      pdf.setFontSize(9);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`${t("generated")}: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth / 2, yPos, { align: 'center' });
      pdf.setTextColor(0, 0, 0);
      yPos += 12;

      // Summary section
      const grandTotalMinutes = Array.from(employeeTotals.values()).reduce((sum, emp) => sum + emp.totalMinutes, 0);
      const grandTotalOvertime = Array.from(employeeTotals.values()).reduce((sum, emp) => sum + emp.overtimeMinutes, 0);
      const totalEmployees = employeeTotals.size;
      const totalDays = Array.from(employeeTotals.values()).reduce((sum, emp) => sum + emp.days, 0);

      // Summary box
      pdf.setFillColor(245, 245, 245);
      pdf.roundedRect(margin, yPos, contentWidth, 30, 3, 3, 'F');
      yPos += 8;

      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text(t("summary"), margin + 5, yPos);
      yPos += 7;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const summaryCol1 = margin + 5;
      const summaryCol2 = margin + contentWidth / 2;

      pdf.text(`${t("total_employees")}: ${totalEmployees}`, summaryCol1, yPos);
      pdf.text(`${t("total_hours")}: ${formatDuration(grandTotalMinutes)}`, summaryCol2, yPos);
      yPos += 6;
      pdf.text(`${t("total_days")}: ${totalDays}`, summaryCol1, yPos);
      pdf.text(`${t("overtime_hours")}: ${formatDuration(Math.round(grandTotalOvertime))}`, summaryCol2, yPos);
      yPos += 15;

      // Employee details
      let currentEmployee = '';
      const colWidths = [45, 25, 25, 25, 25, 25];
      const colStarts = [margin];
      for (let i = 1; i < colWidths.length; i++) {
        colStarts.push(colStarts[i - 1] + colWidths[i - 1]);
      }

      sortedData.forEach((data, index) => {
        // Check if we're starting a new employee
        if (currentEmployee !== data.employeeName) {
          // Add previous employee total if not first employee
          if (currentEmployee) {
            checkPageBreak(20);
            const prevTotals = employeeTotals.get(currentEmployee)!;
            
            // Employee total row
            pdf.setFillColor(230, 230, 230);
            pdf.rect(margin, yPos - 4, contentWidth, 8, 'F');
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(9);
            pdf.text(`${t("total")} ${currentEmployee}`, colStarts[0], yPos);
            pdf.text(formatDuration(prevTotals.totalMinutes), colStarts[4], yPos);
            pdf.text(formatDuration(Math.round(prevTotals.overtimeMinutes)), colStarts[5], yPos);
            yPos += 12;
          }

          currentEmployee = data.employeeName;
          
          checkPageBreak(25);

          // Employee header
          pdf.setFillColor(59, 130, 246);
          pdf.setTextColor(255, 255, 255);
          pdf.roundedRect(margin, yPos - 5, contentWidth, 10, 2, 2, 'F');
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.text(data.employeeName, margin + 5, yPos);
          pdf.setTextColor(0, 0, 0);
          yPos += 10;

          // Table header
          pdf.setFillColor(240, 240, 240);
          pdf.rect(margin, yPos - 4, contentWidth, 8, 'F');
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.text(t("date"), colStarts[0], yPos);
          pdf.text(t("earliest_start"), colStarts[1], yPos);
          pdf.text(t("latest_finish"), colStarts[2], yPos);
          pdf.text(t("tasks"), colStarts[3], yPos);
          pdf.text(t("total_hours"), colStarts[4], yPos);
          pdf.text(t("overtime"), colStarts[5], yPos);
          yPos += 8;
        }

        checkPageBreak(10);

        // Data row
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        
        // Alternate row background
        if (index % 2 === 0) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, yPos - 4, contentWidth, 7, 'F');
        }

        pdf.text(format(new Date(data.date), 'dd/MM/yyyy'), colStarts[0], yPos);
        pdf.text(data.earliestStart ? format(data.earliestStart, 'HH:mm') : '-', colStarts[1], yPos);
        pdf.text(data.latestEnd ? format(data.latestEnd, 'HH:mm') : '-', colStarts[2], yPos);
        pdf.text(String(data.registrations.length), colStarts[3], yPos);
        pdf.text(formatDuration(data.totalMinutes), colStarts[4], yPos);
        
        // Highlight overtime
        if (data.overtimeMinutes > 0) {
          pdf.setTextColor(220, 38, 38);
        }
        pdf.text(formatDuration(Math.round(data.overtimeMinutes)), colStarts[5], yPos);
        pdf.setTextColor(0, 0, 0);
        
        yPos += 7;
      });

      // Final employee total
      if (currentEmployee) {
        checkPageBreak(20);
        const lastTotals = employeeTotals.get(currentEmployee)!;
        
        pdf.setFillColor(230, 230, 230);
        pdf.rect(margin, yPos - 4, contentWidth, 8, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.text(`${t("total")} ${currentEmployee}`, colStarts[0], yPos);
        pdf.text(formatDuration(lastTotals.totalMinutes), colStarts[4], yPos);
        pdf.text(formatDuration(Math.round(lastTotals.overtimeMinutes)), colStarts[5], yPos);
        yPos += 15;
      }

      // Grand total
      checkPageBreak(20);
      pdf.setFillColor(59, 130, 246);
      pdf.setTextColor(255, 255, 255);
      pdf.roundedRect(margin, yPos - 5, contentWidth, 12, 2, 2, 'F');
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('GRAND TOTAL', colStarts[0] + 5, yPos + 2);
      pdf.text(formatDuration(grandTotalMinutes), colStarts[4], yPos + 2);
      pdf.text(formatDuration(Math.round(grandTotalOvertime)), colStarts[5], yPos + 2);
      pdf.setTextColor(0, 0, 0);

      // Save PDF
      pdf.save(`monthly_report_${monthlyReportDates.startDate}_to_${monthlyReportDates.endDate}.pdf`);

      setShowMonthlyReportDialog(false);
      
      toast({
        title: t("success"),
        description: t("monthly_report_exported"),
      });
    } catch (error) {
      console.error('Error generating PDF report:', error);
      toast({
        title: t("error"),
        description: t("export_failed"),
        variant: "destructive"
      });
    }
  };

  const exportToPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      
      // Draw branded header
      let yPos = await drawBrandedHeader(pdf, pageWidth, margin);
      
      // Title
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text(t("filtered_time_registrations"), pageWidth / 2, yPos, { align: 'center' });
      yPos += 6;
      
      // Date range info
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      let filterInfo = `${t("generated")}: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
      if (dateFilter.startDate || dateFilter.endDate) {
        filterInfo += ` | ${t("period")}: ${dateFilter.startDate || '-'} - ${dateFilter.endDate || '-'}`;
      }
      pdf.setTextColor(100, 100, 100);
      pdf.text(filterInfo, pageWidth / 2, yPos, { align: 'center' });
      pdf.setTextColor(0, 0, 0);
      yPos += 10;
      
      // Summary box
      pdf.setFillColor(245, 245, 245);
      pdf.roundedRect(margin, yPos, contentWidth, 20, 3, 3, 'F');
      yPos += 8;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text(t("summary"), margin + 5, yPos);
      yPos += 6;
      
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${t("total_registrations")}: ${filteredRegistrations.length}`, margin + 5, yPos);
      pdf.text(`${t("total_hours")}: ${formatDuration(totalFilteredMinutes)}`, margin + contentWidth / 3, yPos);
      pdf.text(`${t("total_cost")}: ${formatCurrency(totalCost)}`, margin + (contentWidth * 2) / 3, yPos);
      yPos += 12;
      
      // Table headers
      const headers = canViewAllRegistrations 
        ? [t("employee"), t("project"), t("task"), t("start_time"), t("end_time"), t("duration"), t("cost")]
        : [t("project"), t("task"), t("start_time"), t("end_time"), t("duration"), t("cost")];
      
      const colWidths = canViewAllRegistrations 
        ? [28, 32, 32, 28, 28, 18, 18]
        : [40, 40, 32, 32, 20, 20];
      
      const colStarts = [margin];
      for (let i = 1; i < colWidths.length; i++) {
        colStarts.push(colStarts[i - 1] + colWidths[i - 1]);
      }
      
      // Helper function to check page break
      const checkPageBreak = (requiredSpace: number) => {
        if (yPos + requiredSpace > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
          return true;
        }
        return false;
      };
      
      // Draw table header
      const drawTableHeader = () => {
        pdf.setFillColor(45, 115, 135);
        pdf.rect(margin, yPos - 4, contentWidth, 8, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        headers.forEach((header, i) => {
          pdf.text(header, colStarts[i] + 1, yPos);
        });
        pdf.setTextColor(0, 0, 0);
        yPos += 6;
      };
      
      drawTableHeader();
      
      // Table data
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      
      filteredRegistrations.forEach((reg: any, index: number) => {
        if (checkPageBreak(10)) {
          drawTableHeader();
        }
        
        // Alternate row background
        if (index % 2 === 0) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, yPos - 3.5, contentWidth, 6, 'F');
        }
        
        const duration = reg.duration_minutes || 0;
        const hourlyCost = reg.tasks?.standard_tasks?.hourly_cost;
        let cost = 0;
        if (hourlyCost && duration > 0) {
          cost = parseFloat(((duration / 60) * hourlyCost).toFixed(2));
        }
        
        const employeeName = reg.employees?.name || (currentEmployee?.name || t("unknown_employee"));
        const projectName = reg.tasks?.phases?.projects?.name || 
          (reg.workstation_tasks?.workstations ? reg.workstation_tasks.workstations.name : t("unknown_project"));
        const taskName = reg.tasks?.title || reg.workstation_tasks?.task_name || t("unknown_task");
        
        // Truncate text to fit columns
        const truncate = (text: string, maxLen: number) => {
          return text.length > maxLen ? text.substring(0, maxLen - 2) + '..' : text;
        };
        
        if (canViewAllRegistrations) {
          pdf.text(truncate(employeeName, 16), colStarts[0] + 1, yPos);
          pdf.text(truncate(projectName, 18), colStarts[1] + 1, yPos);
          pdf.text(truncate(taskName, 18), colStarts[2] + 1, yPos);
          pdf.text(format(parseISO(reg.start_time), 'dd/MM HH:mm'), colStarts[3] + 1, yPos);
          pdf.text(reg.end_time ? format(parseISO(reg.end_time), 'dd/MM HH:mm') : '-', colStarts[4] + 1, yPos);
          pdf.text(formatDuration(duration), colStarts[5] + 1, yPos);
          pdf.text(formatCurrency(cost), colStarts[6] + 1, yPos);
        } else {
          pdf.text(truncate(projectName, 22), colStarts[0] + 1, yPos);
          pdf.text(truncate(taskName, 22), colStarts[1] + 1, yPos);
          pdf.text(format(parseISO(reg.start_time), 'dd/MM HH:mm'), colStarts[2] + 1, yPos);
          pdf.text(reg.end_time ? format(parseISO(reg.end_time), 'dd/MM HH:mm') : '-', colStarts[3] + 1, yPos);
          pdf.text(formatDuration(duration), colStarts[4] + 1, yPos);
          pdf.text(formatCurrency(cost), colStarts[5] + 1, yPos);
        }
        
        yPos += 6;
      });
      
      // Total row
      checkPageBreak(15);
      yPos += 2;
      pdf.setFillColor(45, 115, 135);
      pdf.rect(margin, yPos - 4, contentWidth, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text('TOTAL', margin + 5, yPos);
      
      const totalColIndex = canViewAllRegistrations ? 5 : 4;
      const costColIndex = canViewAllRegistrations ? 6 : 5;
      pdf.text(formatDuration(totalFilteredMinutes), colStarts[totalColIndex] + 1, yPos);
      pdf.text(formatCurrency(totalCost), colStarts[costColIndex] + 1, yPos);
      pdf.setTextColor(0, 0, 0);
      
      // Save PDF
      pdf.save(`time_registrations_filtered_${format(new Date(), 'yyyy-MM-dd')}.pdf`);

      toast({
        title: t("success"),
        description: t("export_success"),
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: t("error"),
        description: t("export_failed"),
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        {!isMobile && (
          <div className="w-64 bg-sidebar fixed top-0 bottom-0">
            <Navbar />
          </div>
        )}
        {isMobile && <Navbar />}
        <div className={`flex-1 p-6 ${!isMobile ? 'ml-64' : 'pt-16'}`}>
          <div>{t("loading")}</div>
        </div>
      </div>
    );
  }

  if (!canViewAllRegistrations) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        {!isMobile && (
          <div className="w-64 bg-sidebar fixed top-0 bottom-0">
            <Navbar />
          </div>
        )}
        {isMobile && <Navbar />}
        <div className={`flex-1 p-6 ${!isMobile ? 'ml-64' : 'pt-16'}`}>
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">{t("my_time_registrations")}</h1>
            <p className="text-gray-600 mt-2">{t("my_time_registrations_description")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("total_sessions_filtered")}</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredRegistrations.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("total_time_filtered")}</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatDuration(totalFilteredMinutes)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("total_cost_filtered")}</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(totalCost)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t("active_sessions")}</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {activeRegistrations.length}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                {t("filter")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date">{t("filter_by_date")} ({t("start_time")})</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={dateFilter.startDate}
                    onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">{t("filter_by_date")} ({t("end_time")})</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={dateFilter.endDate}
                    onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-filter">{t("filter_by_project")}</Label>
                  <Select value={projectFilter} onValueChange={setProjectFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("all_projects")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("all_projects")}</SelectItem>
                      {getUniqueProjects(myRegistrations).map((project: any) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-filter">{t("filter_by_task")}</Label>
                  <Select value={taskFilter} onValueChange={setTaskFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("all_tasks")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("all_tasks")}</SelectItem>
                      {getUniqueStandardTasks().map((task: any) => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDateFilter({ startDate: '', endDate: '' });
                    setProjectFilter('all');
                    setTaskFilter('all');
                  }}
                >
                  {t("clear_filters")}
                </Button>
                <Button onClick={exportToPDF} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  {t("export_filtered_data")}
                </Button>
                <Button onClick={() => setShowMonthlyReportDialog(true)} variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  {t("monthly_report")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>{t("time_registration_history")}</CardTitle>
                <div className="flex gap-2">
                  <Button onClick={exportToPDF} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    {t("export_timesheet")}
                  </Button>
                  <Button onClick={() => setShowMonthlyReportDialog(true)} variant="outline" size="sm">
                    <FileText className="h-4 w-4 mr-2" />
                    {t("monthly_report")}
                  </Button>
                </div>
              </div>
              <CardDescription>
                {t("showing_sessions", { count: filteredRegistrations.length.toString() })}
                {!isFilterActive && myRegistrations.length > 50 && (
                  <span className="text-muted-foreground ml-2">
                    {t("showing_recent")}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("project")}</TableHead>
                    <TableHead>{t("task")}</TableHead>
                    <TableHead>{t("start_time")}</TableHead>
                     <TableHead>{t("end_time")}</TableHead>
                     <TableHead>{t("duration")}</TableHead>
                     <TableHead>{t("cost")}</TableHead>
                     <TableHead>{t("status")}</TableHead>
                     <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegistrations.map((registration: any) => {
                    const duration = registration.duration_minutes || 0;
                    const hourlyCost = registration.tasks?.standard_tasks?.hourly_cost;
                    let cost = 0;
                    if (hourlyCost && duration > 0) {
                      cost = (duration / 60) * hourlyCost;
                    }
                    return (
                    <TableRow key={registration.id}>
                      <TableCell className="font-medium">
                        {registration.tasks?.phases?.projects?.name || (registration.workstation_tasks?.workstations ? `${t("workstation_prefix")}${registration.workstation_tasks.workstations.name}` : t("unknown_project"))}
                      </TableCell>
                      <TableCell>{registration.tasks?.title || registration.workstation_tasks?.task_name || t("unknown_task")}</TableCell>
                      <TableCell>{formatDateTime(registration.start_time)}</TableCell>
                      <TableCell>
                        {registration.end_time ? formatDateTime(registration.end_time) : '-'}
                      </TableCell>
                      <TableCell>{formatDuration(registration.duration_minutes)}</TableCell>
                      <TableCell>{formatCurrency(cost)}</TableCell>
                       <TableCell>
                         <Badge variant={registration.is_active ? 'default' : 'secondary'}>
                           {registration.is_active ? t("active") : t("completed")}
                         </Badge>
                       </TableCell>
                       <TableCell>
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => {
                             setSelectedRegistration(registration);
                             setShowEditDialog(true);
                           }}
                         >
                           <Edit className="h-4 w-4" />
                         </Button>
                       </TableCell>
                     </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {!isMobile && (
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
      )}
      {isMobile && <Navbar />}
      <div className={`flex-1 p-6 ${!isMobile ? 'ml-64' : 'pt-16'}`}>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t("time_registration_dashboard")}</h1>
          <p className="text-gray-600 mt-2">{t("time_registration_dashboard_description")}</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("today_hours")}</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(totalMinutesToday)}</div>
              <p className="text-xs text-muted-foreground">
                {t("in_sessions", { count: todayRegistrations.length.toString() })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("active_sessions")}</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeRegistrations.length}</div>
              <p className="text-xs text-muted-foreground">
                {t("currently_tracking")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("total_employees")}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getUniqueEmployees(allRegistrations).length}</div>
              <p className="text-xs text-muted-foreground">
                {t("with_registrations")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("total_time_filtered")}</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(totalFilteredMinutes)}</div>
              <p className="text-xs text-muted-foreground">
                {t("in_sessions", { count: filteredRegistrations.length.toString() })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("total_cost_filtered")}</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalCost)}</div>
              <p className="text-xs text-muted-foreground">
                {t("based_on_standard_task_cost")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              {t("filter")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employee-filter">{t("employee")}</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("all_employees")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("all_employees")}</SelectItem>
                    {getUniqueEmployees(allRegistrations).map((employee: any) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="start-date">{t("filter_by_date")} ({t("start_time")})</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={dateFilter.startDate}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-date">{t("filter_by_date")} ({t("end_time")})</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={dateFilter.endDate}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="project-filter">{t("filter_by_project")}</Label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("all_projects")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("all_projects")}</SelectItem>
                    {getUniqueProjects(allRegistrations).map((project: any) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                  <Label htmlFor="task-filter">{t("filter_by_task")}</Label>
                  <Select value={taskFilter} onValueChange={setTaskFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("all_tasks")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("all_tasks")}</SelectItem>
                      {getUniqueStandardTasks().map((task: any) => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
            </div>
            
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedEmployee('all');
                  setDateFilter({ startDate: '', endDate: '' });
                  setProjectFilter('all');
                  setTaskFilter('all');
                }}
              >
                {t("clear_filters")}
              </Button>
              <Button onClick={exportToPDF} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                {t("export_filtered_data")}
              </Button>
              <Button onClick={() => setShowMonthlyReportDialog(true)} variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                {t("monthly_report")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Registration History */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>{t("time_registration_history")}</CardTitle>
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t("delete_old")}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setDeleteTimeframe('week'); setDeleteConfirmOpen(true); }}>
                      {t("older_than_week")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setDeleteTimeframe('month'); setDeleteConfirmOpen(true); }}>
                      {t("older_than_month")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setDeleteTimeframe('6months'); setDeleteConfirmOpen(true); }}>
                      {t("older_than_6months")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setDeleteTimeframe('year'); setDeleteConfirmOpen(true); }}>
                      {t("older_than_year")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button onClick={() => setShowAddDialog(true)} variant="default" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  {t("add_manual_registration")}
                </Button>
              </div>
            </div>
            <CardDescription>
              {t("showing_sessions", { count: filteredRegistrations.length.toString() })}
              {!isFilterActive && allRegistrations.length > 50 && (
                  <span className="text-muted-foreground ml-2">
                    {t("showing_recent")}
                  </span>
                )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("employee")}</TableHead>
                  <TableHead>{t("project")}</TableHead>
                  <TableHead>{t("task")}</TableHead>
                  <TableHead>{t("start_time")}</TableHead>
                  <TableHead>{t("end_time")}</TableHead>
                  <TableHead>{t("duration")}</TableHead>
                   <TableHead>{t("cost")}</TableHead>
                   <TableHead>{t("status")}</TableHead>
                   <TableHead></TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.map((registration: any) => {
                   const duration = registration.duration_minutes || 0;
                   const hourlyCost = registration.tasks?.standard_tasks?.hourly_cost;
                   let cost = 0;
                   if (hourlyCost && duration > 0) {
                     cost = (duration / 60) * hourlyCost;
                   }
                  return (
                  <TableRow key={registration.id}>
                    <TableCell className="font-medium">
                      {registration.employees?.name || t("unknown_employee")}
                    </TableCell>
                    <TableCell>
                      {registration.tasks?.phases?.projects?.name || (registration.workstation_tasks?.workstations ? `${t("workstation_prefix")}${registration.workstation_tasks.workstations.name}` : t("unknown_project"))}
                    </TableCell>
                    <TableCell>{registration.tasks?.title || registration.workstation_tasks?.task_name || t("unknown_task")}</TableCell>
                    <TableCell>{formatDateTime(registration.start_time)}</TableCell>
                    <TableCell>
                      {registration.end_time ? formatDateTime(registration.end_time) : '-'}
                    </TableCell>
                    <TableCell>{formatDuration(registration.duration_minutes)}</TableCell>
                    <TableCell>{formatCurrency(cost)}</TableCell>
                     <TableCell>
                       <Badge variant={registration.is_active ? 'default' : 'secondary'}>
                         {registration.is_active ? t("active") : t("completed")}
                       </Badge>
                     </TableCell>
                     <TableCell>
                       <Button
                         variant="ghost"
                         size="sm"
                         onClick={() => {
                           setSelectedRegistration(registration);
                           setShowEditDialog(true);
                         }}
                       >
                         <Edit className="h-4 w-4" />
                       </Button>
                     </TableCell>
                   </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        <ManualTimeRegistrationDialog 
          open={showAddDialog} 
          onOpenChange={setShowAddDialog} 
        />
        
        <EditTimeRegistrationDialog 
          open={showEditDialog} 
          onOpenChange={setShowEditDialog} 
          registration={selectedRegistration}
        />

        {/* Monthly Report Dialog */}
        <Dialog open={showMonthlyReportDialog} onOpenChange={setShowMonthlyReportDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t("monthly_report")}</DialogTitle>
              <CardDescription>{t("select_report_period")}</CardDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("quick_select")}</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const today = format(new Date(), 'yyyy-MM-dd');
                      setMonthlyReportDates({ startDate: today, endDate: today });
                    }}
                  >
                    {t("today")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
                      setMonthlyReportDates({ startDate: yesterday, endDate: yesterday });
                    }}
                  >
                    {t("yesterday")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const now = new Date();
                      const startOfWeek = format(new Date(now.setDate(now.getDate() - now.getDay() + 1)), 'yyyy-MM-dd');
                      const endOfWeek = format(new Date(), 'yyyy-MM-dd');
                      setMonthlyReportDates({ startDate: startOfWeek, endDate: endOfWeek });
                    }}
                  >
                    {t("this_week")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const now = new Date();
                      const lastWeekStart = format(new Date(now.setDate(now.getDate() - now.getDay() - 6)), 'yyyy-MM-dd');
                      const lastWeekEnd = format(new Date(now.setDate(now.getDate() + 6)), 'yyyy-MM-dd');
                      setMonthlyReportDates({ startDate: lastWeekStart, endDate: lastWeekEnd });
                    }}
                  >
                    {t("last_week")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const now = new Date();
                      const startOfMonth = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');
                      const endOfMonth = format(new Date(), 'yyyy-MM-dd');
                      setMonthlyReportDates({ startDate: startOfMonth, endDate: endOfMonth });
                    }}
                  >
                    {t("this_month")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const now = new Date();
                      const startOfLastMonth = format(new Date(now.getFullYear(), now.getMonth() - 1, 1), 'yyyy-MM-dd');
                      const endOfLastMonth = format(new Date(now.getFullYear(), now.getMonth(), 0), 'yyyy-MM-dd');
                      setMonthlyReportDates({ startDate: startOfLastMonth, endDate: endOfLastMonth });
                    }}
                  >
                    {t("last_month")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const now = new Date();
                      const startOfYear = format(new Date(now.getFullYear(), 0, 1), 'yyyy-MM-dd');
                      const endOfYear = format(new Date(), 'yyyy-MM-dd');
                      setMonthlyReportDates({ startDate: startOfYear, endDate: endOfYear });
                    }}
                  >
                    {t("this_year")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const now = new Date();
                      const startOfLastYear = format(new Date(now.getFullYear() - 1, 0, 1), 'yyyy-MM-dd');
                      const endOfLastYear = format(new Date(now.getFullYear() - 1, 11, 31), 'yyyy-MM-dd');
                      setMonthlyReportDates({ startDate: startOfLastYear, endDate: endOfLastYear });
                    }}
                  >
                    {t("last_year")}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-start-date">{t("start_date")}</Label>
                <Input
                  id="report-start-date"
                  type="date"
                  value={monthlyReportDates.startDate}
                  onChange={(e) => setMonthlyReportDates(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-end-date">{t("end_date")}</Label>
                <Input
                  id="report-end-date"
                  type="date"
                  value={monthlyReportDates.endDate}
                  onChange={(e) => setMonthlyReportDates(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowMonthlyReportDialog(false)}>
                  {t("cancel")}
                </Button>
                <Button onClick={generateMonthlyReport}>
                  <Download className="h-4 w-4 mr-2" />
                  {t("generate_report")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("confirm_delete")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("delete_registrations_warning")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteOldRegistrations} disabled={isDeleting}>
                {isDeleting ? t("deleting") : t("delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default TimeRegistrations;
