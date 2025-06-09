import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { timeRegistrationService } from '@/services/timeRegistrationService';
import { useAuth } from '@/context/AuthContext';
import { Clock, Users, Calendar, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
const TimeRegistrations = () => {
  const {
    currentEmployee
  } = useAuth();
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');

  // Check if user is admin or manager
  const canViewAllRegistrations = currentEmployee && ['admin', 'manager'].includes(currentEmployee.role);
  const {
    data: allRegistrations = [],
    isLoading
  } = useQuery({
    queryKey: ['allTimeRegistrations'],
    queryFn: () => timeRegistrationService.getAllRegistrations(),
    enabled: !!canViewAllRegistrations
  });
  const {
    data: myRegistrations = []
  } = useQuery({
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
  const filteredRegistrations = selectedEmployee === 'all' ? allRegistrations : allRegistrations.filter((reg: any) => reg.employee_id === selectedEmployee);

  // Calculate statistics
  const todayRegistrations = filteredRegistrations.filter((reg: any) => {
    const regDate = new Date(reg.start_time).toDateString();
    const today = new Date().toDateString();
    return regDate === today;
  });
  const totalMinutesToday = todayRegistrations.reduce((total: number, reg: any) => total + (reg.duration_minutes || 0), 0);
  const activeRegistrations = filteredRegistrations.filter((reg: any) => reg.is_active);
  if (isLoading) {
    return <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="ml-64 container mx-auto px-4 py-8">
          <div>Loading...</div>
        </div>
      </div>;
  }
  if (!canViewAllRegistrations) {
    return <div className="min-h-screen bg-gray-50">
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
                  {myRegistrations.map((registration: any) => <TableRow key={registration.id}>
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
                    </TableRow>)}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="ml-64 w-full p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Time Registration Dashboard</h1>
          <p className="text-gray-600 mt-2">Monitor time tracking across all employees</p>
        </div>

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
              <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredRegistrations.length}</div>
              <p className="text-xs text-muted-foreground">
                All time
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Time Registration History</CardTitle>
            <CardDescription>
              <div className="flex items-center space-x-4">
                <span>Filter by employee:</span>
                <select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)} className="border rounded px-2 py-1">
                  <option value="all">All Employees</option>
                  {getUniqueEmployees().map((employee: any) => <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>)}
                </select>
              </div>
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
                {filteredRegistrations.map((registration: any) => <TableRow key={registration.id}>
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
                  </TableRow>)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>;
};
export default TimeRegistrations;
