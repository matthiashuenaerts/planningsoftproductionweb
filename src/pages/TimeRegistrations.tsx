
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { useAuth } from '@/context/AuthContext';
import { Clock, Users, Calendar as CalendarIcon, BarChart3, Download, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

const TimeRegistrations = () => {
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: ''
  });
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);
  const [summaryDates, setSummaryDates] = useState<DateRange | undefined>();

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

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatDateTime = (dateString: string) => {
    return format(parseISO(dateString), 'MMM dd, yyyy HH:mm');
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
    const projects = new Set();
    registrations.forEach((reg: any) => {
      if (reg.tasks?.phases?.projects) {
        projects.add(JSON.stringify({
          id: reg.tasks.phases.projects.id,
          name: reg.tasks.phases.projects.name
        }));
      }
    });
    return Array.from(projects).map((proj: any) => JSON.parse(proj));
  };

  // Apply filters
  const getFilteredRegistrations = () => {
    let filtered = canViewAllRegistrations ? allRegistrations : myRegistrations;

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
        reg.tasks?.phases?.projects?.id.toString() === projectFilter
      );
    }

    return filtered;
  };

  const filteredRegistrations = getFilteredRegistrations();

  const totalFilteredMinutes = filteredRegistrations.reduce(
    (total: number, reg: any) => total + (reg.duration_minutes || 0),
    0
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

  const exportToCSV = () => {
    try {
      const headers = [
        'Employee',
        'Project',
        'Task',
        'Start Time',
        'End Time',
        'Duration (minutes)',
        'Status'
      ];

      const csvData = filteredRegistrations.map((reg: any) => [
        reg.employees?.name || 'Unknown Employee',
        reg.tasks?.phases?.projects?.name || 'Unknown Project',
        reg.tasks?.title || 'Unknown Task',
        formatDateTime(reg.start_time),
        reg.end_time ? formatDateTime(reg.end_time) : '',
        reg.duration_minutes || 0,
        reg.is_active ? 'Active' : 'Completed'
      ]);

      const csvContent = [
        headers.join(','),
        ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
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
        title: "Success",
        description: "Time registrations exported successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export data",
        variant: "destructive"
      });
    }
  };

  const handleGenerateSummaryPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    await import('jspdf-autotable');

    if (!summaryDates?.from || !summaryDates?.to) {
      toast({
        title: "Please select a date range",
        description: "A start and end date are required to generate the summary.",
        variant: "destructive",
      });
      return;
    }

    const filtered = allRegistrations.filter((reg: any) => {
      const regDate = new Date(reg.start_time);
      return reg.end_time && regDate >= summaryDates.from! && regDate <= summaryDates.to!;
    });

    if (filtered.length === 0) {
      toast({
        title: "No Data",
        description: "No completed time registrations found for the selected period.",
      });
      return;
    }

    const employeeSummary = filtered.reduce((acc, reg) => {
      const employeeId = reg.employee_id;
      if (!acc[employeeId]) {
        acc[employeeId] = {
          name: reg.employees.name,
          totalMinutes: 0,
          earliestStart: new Date(reg.start_time),
          latestEnd: new Date(reg.end_time),
        };
      }

      acc[employeeId].totalMinutes += reg.duration_minutes || 0;

      const startTime = new Date(reg.start_time);
      if (startTime < acc[employeeId].earliestStart) {
        acc[employeeId].earliestStart = startTime;
      }

      const endTime = new Date(reg.end_time);
      if (endTime > acc[employeeId].latestEnd) {
        acc[employeeId].latestEnd = endTime;
      }

      return acc;
    }, {} as { [key: string]: { name: string; totalMinutes: number; earliestStart: Date; latestEnd: Date } });

    const doc = new jsPDF();
    doc.text("Employee Time Registration Summary", 14, 16);
    doc.setFontSize(10);
    doc.text(`Period: ${format(summaryDates.from, "d MMM yyyy")} - ${format(summaryDates.to, "d MMM yyyy")}`, 14, 22);

    const tableColumns = ["Employee", "Total Hours", "Earliest Start", "Latest Stop"];
    const tableRows = Object.values(employeeSummary).map((emp: { name: string; totalMinutes: number; earliestStart: Date; latestEnd: Date }) => [
      emp.name,
      formatDuration(emp.totalMinutes),
      format(emp.earliestStart, 'HH:mm'),
      format(emp.latestEnd, 'HH:mm'),
    ]);

    (doc as any).autoTable({
      head: [tableColumns],
      body: tableRows,
      startY: 30,
    });
    
    doc.save(`employee_summary_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    
    toast({
      title: "PDF Generated",
      description: "The employee summary has been downloaded.",
    });

    setIsSummaryDialogOpen(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <Navbar />
        <div className="flex-1 ml-64 p-6">
          <div>Loading...</div>
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
            <h1 className="text-3xl font-bold text-gray-900">My Time Registrations</h1>
            <p className="text-gray-600 mt-2">View and filter your personal time tracking history</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sessions (Filtered)</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredRegistrations.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Time (Filtered)</CardTitle>
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
                <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
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
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={dateFilter.startDate}
                    onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={dateFilter.endDate}
                    onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-filter">Project</Label>
                  <Select value={projectFilter} onValueChange={setProjectFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Projects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Projects</SelectItem>
                      {getUniqueProjects(myRegistrations).map((project: any) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
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
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>My Registration History</CardTitle>
                <Button onClick={exportToCSV} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
              <CardDescription>
                Showing {filteredRegistrations.length} registration(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegistrations.map((registration: any) => (
                    <TableRow key={registration.id}>
                      <TableCell className="font-medium">
                        {registration.tasks?.phases?.projects?.name || 'Unknown Project'}
                      </TableCell>
                      <TableCell>{registration.tasks?.title || 'Unknown Task'}</TableCell>
                      <TableCell>{formatDateTime(registration.start_time)}</TableCell>
                      <TableCell>
                        {registration.end_time ? formatDateTime(registration.end_time) : '-'}
                      </TableCell>
                      <TableCell>{formatDuration(registration.duration_minutes)}</TableCell>
                      <TableCell>
                        <Badge variant={registration.is_active ? 'default' : 'secondary'}>
                          {registration.is_active ? 'Active' : 'Completed'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
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
          <h1 className="text-3xl font-bold text-gray-900">Time Registration Dashboard</h1>
          <p className="text-gray-600 mt-2">Monitor time tracking across all employees</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Hours</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(totalMinutesToday)}</div>
              <p className="text-xs text-muted-foreground">
                {todayRegistrations.length} sessions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeRegistrations.length}</div>
              <p className="text-xs text-muted-foreground">
                Currently tracking
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getUniqueEmployees(allRegistrations).length}</div>
              <p className="text-xs text-muted-foreground">
                With registrations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Time (Filtered)</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(totalFilteredMinutes)}</div>
              <p className="text-xs text-muted-foreground">
                in {filteredRegistrations.length} sessions
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employee-filter">Employee</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {getUniqueEmployees(allRegistrations).map((employee: any) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={dateFilter.startDate}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={dateFilter.endDate}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="project-filter">Project</Label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {getUniqueProjects(allRegistrations).map((project: any) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.name}
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
                }}
              >
                Clear Filters
              </Button>
              <Button onClick={exportToCSV} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export Filtered Data
              </Button>
               <Dialog open={isSummaryDialogOpen} onOpenChange={setIsSummaryDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Users className="h-4 w-4 mr-2" />
                    Employee Summary
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Employee Summary</DialogTitle>
                    <DialogDescription>
                      Select a date range to generate a PDF summary for all employees.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            id="date"
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !summaryDates && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {summaryDates?.from ? (
                              summaryDates.to ? (
                                <>
                                  {format(summaryDates.from, "LLL dd, y")} -{" "}
                                  {format(summaryDates.to, "LLL dd, y")}
                                </>
                              ) : (
                                format(summaryDates.from, "LLL dd, y")
                              )
                            ) : (
                              <span>Pick a date range</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={summaryDates?.from}
                            selected={summaryDates}
                            onSelect={setSummaryDates}
                            numberOfMonths={2}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setSummaryDates({ from: new Date(), to: new Date() })}>Today</Button>
                        <Button size="sm" variant="secondary" onClick={() => setSummaryDates({ from: startOfWeek(new Date()), to: endOfWeek(new Date()) })}>This Week</Button>
                        <Button size="sm" variant="secondary" onClick={() => {
                            const lastWeekStart = startOfWeek(subWeeks(new Date(), 1));
                            const lastWeekEnd = endOfWeek(subWeeks(new Date(), 1));
                            setSummaryDates({ from: lastWeekStart, to: lastWeekEnd });
                        }}>Last Week</Button>
                        <Button size="sm" variant="secondary" onClick={() => setSummaryDates({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })}>This Month</Button>
                        <Button size="sm" variant="secondary" onClick={() => {
                            const lastMonthStart = startOfMonth(subMonths(new Date(), 1));
                            const lastMonthEnd = endOfMonth(subMonths(new Date(), 1));
                            setSummaryDates({ from: lastMonthStart, to: lastMonthEnd });
                        }}>Last Month</Button>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleGenerateSummaryPDF}>Generate PDF</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Registration History */}
        <Card>
          <CardHeader>
            <CardTitle>Time Registration History</CardTitle>
            <CardDescription>
              Showing {filteredRegistrations.length} registration(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.map((registration: any) => (
                  <TableRow key={registration.id}>
                    <TableCell className="font-medium">
                      {registration.employees?.name || 'Unknown Employee'}
                    </TableCell>
                    <TableCell>
                      {registration.tasks?.phases?.projects?.name || 'Unknown Project'}
                    </TableCell>
                    <TableCell>{registration.tasks?.title || 'Unknown Task'}</TableCell>
                    <TableCell>{formatDateTime(registration.start_time)}</TableCell>
                    <TableCell>
                      {registration.end_time ? formatDateTime(registration.end_time) : '-'}
                    </TableCell>
                    <TableCell>{formatDuration(registration.duration_minutes)}</TableCell>
                    <TableCell>
                      <Badge variant={registration.is_active ? 'default' : 'secondary'}>
                        {registration.is_active ? 'Active' : 'Completed'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TimeRegistrations;
