import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { useAuth } from '@/context/AuthContext';
import { Clock, Users, Calendar, BarChart3, Download, Filter, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';

const TimeRegistrations = () => {
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: ''
  });
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [taskFilter, setTaskFilter] = useState<string>('all');

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

  const exportToCSV = () => {
    try {
      const headers = [
        'Employee',
        'Project',
        'Task',
        'Start Time',
        'End Time',
        'Duration (minutes)',
        'Cost (EUR)',
        'Status'
      ];

      const csvData = filteredRegistrations.map((reg: any) => {
        const duration = reg.duration_minutes || 0;
        const hourlyCost = reg.tasks?.standard_tasks?.hourly_cost;
        let cost = 0;
        if (hourlyCost && duration > 0) {
          cost = parseFloat(((duration / 60) * hourlyCost).toFixed(2));
        }
        
        const rowData = [
          reg.employees?.name || (currentEmployee?.name ||'Unknown Employee'),
          reg.tasks?.phases?.projects?.name || (reg.workstation_tasks?.workstations ? `Workstation: ${reg.workstation_tasks.workstations.name}` : 'Unknown Project'),
          reg.tasks?.title || reg.workstation_tasks?.task_name || 'Unknown Task',
          formatDateTime(reg.start_time),
          reg.end_time ? formatDateTime(reg.end_time) : '',
          reg.duration_minutes || 0,
          cost,
          reg.is_active ? 'Active' : 'Completed'
        ];

        // For non-admin view, the 'Employee' column is not in the table, but we want it in the CSV.
        // We'll remove it from the headers if not admin, for visual consistency with table.
        // Oh wait, the user wants it in the CSV for both. I'll just keep it.

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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
                <CardTitle className="text-sm font-medium">Total Cost (Filtered)</CardTitle>
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <div className="space-y-2">
                  <Label htmlFor="task-filter">Task</Label>
                  <Select value={taskFilter} onValueChange={setTaskFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Tasks" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tasks</SelectItem>
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
                {!isFilterActive && myRegistrations.length > 50 && (
                  <span className="text-muted-foreground ml-2">
                    (Showing the 50 most recent. Use filters to see more.)
                  </span>
                )}
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
                    <TableHead>Cost</TableHead>
                    <TableHead>Status</TableHead>
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
                        {registration.tasks?.phases?.projects?.name || (registration.workstation_tasks?.workstations ? `Workstation: ${registration.workstation_tasks.workstations.name}` : 'Unknown Project')}
                      </TableCell>
                      <TableCell>{registration.tasks?.title || registration.workstation_tasks?.task_name || 'Unknown Task'}</TableCell>
                      <TableCell>{formatDateTime(registration.start_time)}</TableCell>
                      <TableCell>
                        {registration.end_time ? formatDateTime(registration.end_time) : '-'}
                      </TableCell>
                      <TableCell>{formatDuration(registration.duration_minutes)}</TableCell>
                      <TableCell>{formatCurrency(cost)}</TableCell>
                      <TableCell>
                        <Badge variant={registration.is_active ? 'default' : 'secondary'}>
                          {registration.is_active ? 'Active' : 'Completed'}
                        </Badge>
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
          <h1 className="text-3xl font-bold text-gray-900">Time Registration Dashboard</h1>
          <p className="text-gray-600 mt-2">Monitor time tracking across all employees</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Hours</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cost (Filtered)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalCost)}</div>
              <p className="text-xs text-muted-foreground">
                based on standard task cost
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                  <Label htmlFor="task-filter">Task</Label>
                  <Select value={taskFilter} onValueChange={setTaskFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Tasks" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tasks</SelectItem>
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
                Clear Filters
              </Button>
              <Button onClick={exportToCSV} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export Filtered Data
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Registration History */}
        <Card>
          <CardHeader>
            <CardTitle>Time Registration History</CardTitle>
            <CardDescription>
              Showing {filteredRegistrations.length} registration(s)
              {!isFilterActive && allRegistrations.length > 50 && (
                  <span className="text-muted-foreground ml-2">
                    (Showing the 50 most recent. Use filters to see more.)
                  </span>
                )}
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
                  <TableHead>Cost</TableHead>
                  <TableHead>Status</TableHead>
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
                      {registration.employees?.name || 'Unknown Employee'}
                    </TableCell>
                    <TableCell>
                      {registration.tasks?.phases?.projects?.name || (registration.workstation_tasks?.workstations ? `Workstation: ${registration.workstation_tasks.workstations.name}` : 'Unknown Project')}
                    </TableCell>
                    <TableCell>{registration.tasks?.title || registration.workstation_tasks?.task_name || 'Unknown Task'}</TableCell>
                    <TableCell>{formatDateTime(registration.start_time)}</TableCell>
                    <TableCell>
                      {registration.end_time ? formatDateTime(registration.end_time) : '-'}
                    </TableCell>
                    <TableCell>{formatDuration(registration.duration_minutes)}</TableCell>
                    <TableCell>{formatCurrency(cost)}</TableCell>
                    <TableCell>
                      <Badge variant={registration.is_active ? 'default' : 'secondary'}>
                        {registration.is_active ? 'Active' : 'Completed'}
                      </Badge>
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
};

export default TimeRegistrations;
