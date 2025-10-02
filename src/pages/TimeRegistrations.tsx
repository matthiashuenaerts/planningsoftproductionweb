
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { useAuth } from '@/context/AuthContext';
import { Clock, Users, Calendar, BarChart3, Download, Filter, DollarSign, Plus, Edit, FileText } from 'lucide-react';
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

const TimeRegistrations = () => {
  const { currentEmployee } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
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

  // Check if user is admin or manager
  const canViewAllRegistrations = currentEmployee && ['admin', 'manager'].includes(currentEmployee.role);

  const { data: allRegistrations = [], isLoading } = useQuery({
    queryKey: ['allTimeRegistrations'],
    queryFn: () => timeRegistrationService.getAllRegistrations(),
    enabled: !!canViewAllRegistrations
  });

  const { data: myRegistrations = [] } = useQuery({
    queryKey: ['myTimeRegistrations', currentEmployee?.id],
    queryFn: () => currentEmployee ? timeRegistrationService.getRegistrationsByEmployee(currentEmployee.id) : [],
    enabled: !!currentEmployee
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

    // Task filter
    if (taskFilter !== 'all') {
      filtered = filtered.filter((reg: any) => 
        reg.task_id === taskFilter || reg.workstation_task_id === taskFilter
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

  const getUniqueTasks = (registrations: any[]) => {
    const tasks = new Map<string, { id: string; name: string }>();
    registrations.forEach((reg: any) => {
      if (reg.task_id && reg.tasks?.title) {
        tasks.set(reg.task_id, {
          id: reg.task_id,
          name: reg.tasks.title,
        });
      } else if (reg.workstation_task_id && reg.workstation_tasks?.task_name) {
        tasks.set(reg.workstation_task_id, {
          id: reg.workstation_task_id,
          name: reg.workstation_tasks.task_name,
        });
      }
    });
    return Array.from(tasks.values());
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

  const exportMonthlyReport = () => {
    try {
      // Define regular working hours
      const REGULAR_START_HOUR = 8;
      const REGULAR_END_HOUR = 17;

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

      filteredRegistrations.forEach((reg: any) => {
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

        // Calculate overtime (before 8:00 or after 17:00)
        const startHour = startDate.getHours() + startDate.getMinutes() / 60;
        const endHour = endDate.getHours() + endDate.getMinutes() / 60;
        
        if (startHour < REGULAR_START_HOUR) {
          const overtimeHours = Math.min(REGULAR_START_HOUR - startHour, (reg.duration_minutes || 0) / 60);
          dailyData.overtimeMinutes += overtimeHours * 60;
        }
        
        if (endHour > REGULAR_END_HOUR) {
          const overtimeHours = Math.min(endHour - REGULAR_END_HOUR, (reg.duration_minutes || 0) / 60);
          dailyData.overtimeMinutes += overtimeHours * 60;
        }
      });

      // Sort by employee name and date
      const sortedData = Array.from(dailyDataMap.values()).sort((a, b) => {
        const nameCompare = a.employeeName.localeCompare(b.employeeName);
        if (nameCompare !== 0) return nameCompare;
        return a.date.localeCompare(b.date);
      });

      // Prepare CSV headers
      const headers = [
        t("employee"),
        t("date"),
        t("earliest_start"),
        t("latest_finish"),
        t("total_hours"),
        t("overtime_hours")
      ];

      // Prepare CSV data
      const csvData = sortedData.map((data) => [
        data.employeeName,
        format(new Date(data.date), 'dd/MM/yyyy'),
        data.earliestStart ? format(data.earliestStart, 'HH:mm') : '-',
        data.latestEnd ? format(data.latestEnd, 'HH:mm') : '-',
        formatDuration(data.totalMinutes),
        formatDuration(Math.round(data.overtimeMinutes))
      ]);

      const csvContent = [
        headers.join(','),
        ...csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `monthly_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: t("success"),
        description: t("monthly_report_exported"),
      });
    } catch (error) {
      toast({
        title: t("error"),
        description: t("export_failed"),
        variant: "destructive"
      });
    }
  };

  const exportToCSV = () => {
    try {
      const headers = [
        t("employee"),
        t("project"),
        t("task"),
        t("start_time"),
        t("end_time"),
        t("duration_hours"),
        t("cost"),
        t("status")
      ];

      const csvData = filteredRegistrations.map((reg: any) => {
        const duration = reg.duration_minutes || 0;
        const hourlyCost = reg.tasks?.standard_tasks?.hourly_cost;
        let cost = 0;
        if (hourlyCost && duration > 0) {
          cost = parseFloat(((duration / 60) * hourlyCost).toFixed(2));
        }
        
        const rowData = [
          reg.employees?.name || (currentEmployee?.name || t("unknown_employee")),
          reg.tasks?.phases?.projects?.name || (reg.workstation_tasks?.workstations ? `${t("workstation_prefix")}${reg.workstation_tasks.workstations.name}` : t("unknown_project")),
          reg.tasks?.title || reg.workstation_tasks?.task_name || t("unknown_task"),
          formatDateTime(reg.start_time),
          reg.end_time ? formatDateTime(reg.end_time) : '',
          reg.duration_minutes || 0,
          cost,
          reg.is_active ? t("active") : t("completed")
        ];

        if(!canViewAllRegistrations){
          return rowData.slice(1); // remove employee from personal view
        }
        return rowData;
      });

      const csvHeaders = canViewAllRegistrations ? headers : headers.slice(1);

      const csvContent = [
        csvHeaders.join(','),
        ...csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `time_registrations_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: t("success"),
        description: t("export_success"),
      });
    } catch (error) {
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
        <Navbar />
        <div className="flex-1 ml-64 p-6">
          <div>{t("loading")}</div>
        </div>
      </div>
    );
  }

  if (!canViewAllRegistrations) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <Navbar />
        <div className="flex-1 ml-64 p-6">
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
                      {getUniqueTasks(myRegistrations).map((task: any) => (
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
                <Button onClick={exportToCSV} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  {t("export_filtered_data")}
                </Button>
                <Button onClick={exportMonthlyReport} variant="outline">
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
                  <Button onClick={exportToCSV} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    {t("export_timesheet")}
                  </Button>
                  <Button onClick={exportMonthlyReport} variant="outline" size="sm">
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
      <Navbar />
      <div className="flex-1 ml-64 p-6">
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
                      {getUniqueTasks(allRegistrations).map((task: any) => (
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
              <Button onClick={exportToCSV} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                {t("export_filtered_data")}
              </Button>
              <Button onClick={exportMonthlyReport} variant="outline">
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
              <Button onClick={() => setShowAddDialog(true)} variant="default" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t("add_manual_registration")}
              </Button>
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
      </div>
    </div>
  );
};

export default TimeRegistrations;
