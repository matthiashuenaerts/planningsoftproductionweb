
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { useAuth } from '@/context/AuthContext';
import { Clock, Users, Calendar, BarChart3, Download, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface FilterOptions {
  employee: string;
  project: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  minDuration: string;
  maxDuration: string;
}

const TimeRegistrations = () => {
  const { currentEmployee } = useAuth();
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [filters, setFilters] = useState<FilterOptions>({
    employee: 'all',
    project: 'all',
    status: 'all',
    startDate: null,
    endDate: null,
    minDuration: '',
    maxDuration: ''
  });

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
    return new Date(dateString).toLocaleString();
  };

  const getUniqueEmployees = () => {
    const employees = new Set();
    allRegistrations.forEach((reg: any) => {
      if (reg.employees) {
        employees.add(JSON.stringify({
          id: reg.employee_id,
          name: reg.employees.name
        }));
      }
    });
    return Array.from(employees).map((emp: any) => JSON.parse(emp));
  };

  const getUniqueProjects = () => {
    const projects = new Set();
    allRegistrations.forEach((reg: any) => {
      if (reg.tasks?.phases?.projects?.name) {
        projects.add(reg.tasks.phases.projects.name);
      }
    });
    return Array.from(projects);
  };

  const applyFilters = (registrations: any[]) => {
    return registrations.filter((reg: any) => {
      // Employee filter
      if (filters.employee !== 'all' && reg.employee_id !== filters.employee) {
        return false;
      }

      // Project filter
      if (filters.project !== 'all' && reg.tasks?.phases?.projects?.name !== filters.project) {
        return false;
      }

      // Status filter
      if (filters.status !== 'all') {
        const isActive = reg.is_active;
        if (filters.status === 'active' && !isActive) return false;
        if (filters.status === 'completed' && isActive) return false;
      }

      // Date range filter
      if (filters.startDate) {
        const regDate = new Date(reg.start_time);
        if (regDate < filters.startDate) return false;
      }

      if (filters.endDate) {
        const regDate = new Date(reg.start_time);
        if (regDate > filters.endDate) return false;
      }

      // Duration filter
      if (filters.minDuration && reg.duration_minutes) {
        const minMinutes = parseInt(filters.minDuration) * 60;
        if (reg.duration_minutes < minMinutes) return false;
      }

      if (filters.maxDuration && reg.duration_minutes) {
        const maxMinutes = parseInt(filters.maxDuration) * 60;
        if (reg.duration_minutes > maxMinutes) return false;
      }

      return true;
    });
  };

  const filteredRegistrations = canViewAllRegistrations 
    ? applyFilters(allRegistrations)
    : myRegistrations;

  // Calculate statistics based on filtered data
  const todayRegistrations = filteredRegistrations.filter((reg: any) => {
    const regDate = new Date(reg.start_time).toDateString();
    const today = new Date().toDateString();
    return regDate === today;
  });

  const totalMinutesToday = todayRegistrations.reduce((total: number, reg: any) => total + (reg.duration_minutes || 0), 0);
  const activeRegistrations = filteredRegistrations.filter((reg: any) => reg.is_active);

  const exportToCSV = () => {
    const headers = ['Employee', 'Project', 'Task', 'Start Time', 'End Time', 'Duration (minutes)', 'Status'];
    const csvData = filteredRegistrations.map((reg: any) => [
      reg.employees?.name || 'Unknown Employee',
      reg.tasks?.phases?.projects?.name || 'Unknown Project',
      reg.tasks?.title || 'Unknown Task',
      formatDateTime(reg.start_time),
      reg.end_time ? formatDateTime(reg.end_time) : '-',
      reg.duration_minutes || 0,
      reg.is_active ? 'Active' : 'Completed'
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `time-registrations-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setFilters({
      employee: 'all',
      project: 'all',
      status: 'all',
      startDate: null,
      endDate: null,
      minDuration: '',
      maxDuration: ''
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="ml-64 container mx-auto px-4 py-8">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  if (!canViewAllRegistrations) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="ml-64 container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">My Time Registrations</h1>
            <p className="text-gray-600 mt-2">View your personal time tracking history</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{myRegistrations.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Time</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatDuration(myRegistrations.reduce((total: number, reg: any) => total + (reg.duration_minutes || 0), 0))}
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
                  {myRegistrations.filter((reg: any) => reg.is_active).length}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>My Registration History</CardTitle>
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
                  {myRegistrations.map((registration: any) => (
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
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="ml-64 w-full p-6">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Time Registration Dashboard</h1>
              <p className="text-gray-600 mt-2">Monitor time tracking across all employees</p>
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <Filter className="h-4 w-4" />
                <span>Filters</span>
              </Button>
              <Button
                onClick={exportToCSV}
                className="flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Export CSV</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Advanced Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <Label>Employee</Label>
                  <Select value={filters.employee} onValueChange={(value) => setFilters({...filters, employee: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Employees</SelectItem>
                      {getUniqueEmployees().map((employee: any) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Project</Label>
                  <Select value={filters.project} onValueChange={(value) => setFilters({...filters, project: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Projects</SelectItem>
                      {getUniqueProjects().map((project: any) => (
                        <SelectItem key={project} value={project}>
                          {project}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Status</Label>
                  <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Start Date</Label>
                  <DatePicker
                    date={filters.startDate}
                    onDateChange={(date) => setFilters({...filters, startDate: date})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>End Date</Label>
                  <DatePicker
                    date={filters.endDate}
                    onDateChange={(date) => setFilters({...filters, endDate: date})}
                  />
                </div>

                <div>
                  <Label>Min Duration (hours)</Label>
                  <Input
                    type="number"
                    value={filters.minDuration}
                    onChange={(e) => setFilters({...filters, minDuration: e.target.value})}
                    placeholder="0"
                  />
                </div>

                <div>
                  <Label>Max Duration (hours)</Label>
                  <Input
                    type="number"
                    value={filters.maxDuration}
                    onChange={(e) => setFilters({...filters, maxDuration: e.target.value})}
                    placeholder="24"
                  />
                </div>

                <div className="flex items-end">
                  <Button onClick={resetFilters} variant="outline" className="w-full">
                    Reset Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
              <div className="text-2xl font-bold">{getUniqueEmployees().length}</div>
              <p className="text-xs text-muted-foreground">
                With registrations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Filtered Sessions</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredRegistrations.length}</div>
              <p className="text-xs text-muted-foreground">
                Matching filters
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Time Registration History</CardTitle>
            <CardDescription>
              Filtered results: {filteredRegistrations.length} registrations
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
