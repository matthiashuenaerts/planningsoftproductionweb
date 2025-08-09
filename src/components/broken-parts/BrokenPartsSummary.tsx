import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, subMonths, subYears, startOfDay, startOfWeek, startOfMonth, startOfYear } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { brokenPartsService, BrokenPart } from '@/services/brokenPartsService';
import { CalendarDays, ListFilter, Users, Filter, List, PlusCircle } from 'lucide-react';
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
type TimeFilter = 'day' | 'week' | 'month' | 'year' | 'all';
type GroupBy = 'project' | 'workstation' | 'employee';
const BrokenPartsSummary: React.FC = () => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');
  const [groupBy, setGroupBy] = useState<GroupBy>('workstation');

  // Fetch broken parts
  const {
    data: brokenParts = [],
    isLoading
  } = useQuery({
    queryKey: ['broken-parts'],
    queryFn: () => brokenPartsService.getAll()
  });

  // Filter data based on time period
  const getFilteredData = () => {
    const now = new Date();
    let startDate: Date;
    switch (timeFilter) {
      case 'day':
        startDate = startOfDay(now);
        break;
      case 'week':
        startDate = startOfWeek(now);
        break;
      case 'month':
        startDate = startOfMonth(now);
        break;
      case 'year':
        startDate = startOfYear(now);
        break;
      default:
        return brokenParts;
    }
    return brokenParts.filter(part => {
      const partDate = new Date(part.created_at as string);
      return partDate >= startDate;
    });
  };
  const filteredData = getFilteredData();

  // Group data by selected attribute
  const getGroupedData = () => {
    const grouped = filteredData.reduce((acc: Record<string, number>, part: BrokenPart) => {
      let key = 'Unknown';
      switch (groupBy) {
        case 'project':
          key = part.projects?.name || 'No Project';
          break;
        case 'workstation':
          key = part.workstations?.name || 'No Workstation';
          break;
        case 'employee':
          key = part.employees?.name || 'Unknown Employee';
          break;
      }
      if (!acc[key]) {
        acc[key] = 0;
      }
      acc[key]++;
      return acc;
    }, {});
    return Object.entries(grouped).map(([name, value]) => ({
      name,
      value
    }));
  };
  const groupedData = getGroupedData();

  // Calculate time-based statistics
  const getTimeBasedStats = () => {
    const last7Days = Array.from({
      length: 7
    }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dateStr = format(date, 'MMM dd');
      return {
        date: dateStr,
        count: 0
      };
    });
    filteredData.forEach(part => {
      const partDate = new Date(part.created_at as string);
      const dateStr = format(partDate, 'MMM dd');
      const dayEntry = last7Days.find(day => day.date === dateStr);
      if (dayEntry) {
        dayEntry.count++;
      }
    });
    return last7Days;
  };
  const timeBasedData = getTimeBasedStats();

  // Calculate total stats
  const totalReports = filteredData.length;
  const uniqueProjects = new Set(filteredData.map(part => part.project_id)).size;
  const uniqueWorkstations = new Set(filteredData.map(part => part.workstation_id)).size;
  const uniqueEmployees = new Set(filteredData.map(part => part.reported_by)).size;
  return <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 justify-between mt-10">
        <h1 className="text-2xl font-bold">Broken Parts Summary</h1>
        
        <div className="flex flex-wrap gap-2 py-[10px]">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Label>Time Period:</Label>
            <Select value={timeFilter} onValueChange={value => setTimeFilter(value as TimeFilter)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Select time period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <ListFilter className="h-4 w-4 text-muted-foreground" />
            <Label>Group By:</Label>
            <Select value={groupBy} onValueChange={value => setGroupBy(value as GroupBy)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Select grouping" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="workstation">Workstation</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/broken-parts">
                <List className="h-4 w-4 mr-2" />
                List View
              </Link>
            </Button>
          </div>
        </div>
      </div>
      
      <div className="grid md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReports}</div>
            <p className="text-xs text-muted-foreground">in selected time period</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Projects</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueProjects}</div>
            <p className="text-xs text-muted-foreground">with broken parts reported</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workstations Affected</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueWorkstations}</div>
            <p className="text-xs text-muted-foreground">with issues reported</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reporters</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueEmployees}</div>
            <p className="text-xs text-muted-foreground">employees reported issues</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="charts" className="w-full">
        <TabsList>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="table">Table</TabsTrigger>
        </TabsList>
        <TabsContent value="charts" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Broken Parts by {groupBy === 'project' ? 'Project' : groupBy === 'workstation' ? 'Workstation' : 'Employee'}</CardTitle>
                <CardDescription>Distribution of broken parts in the selected time period</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <ChartContainer config={{}} className="h-80">
                  <PieChart>
                    <Pie data={groupedData} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value" label={({
                    name,
                    percent
                  }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                      {groupedData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltipContent />} />
                    <Legend />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Broken Parts Trend (Last 7 Days)</CardTitle>
                <CardDescription>Number of reports per day</CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <ChartContainer config={{}} className="h-80">
                  <BarChart data={timeBasedData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar dataKey="count" name="Reports" fill="#3B82F6" />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="table">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Broken Parts Data</CardTitle>
              <CardDescription>Complete listing of all broken parts in the selected time period</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Workstation</TableHead>
                    <TableHead>Reported By</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.length === 0 ? <TableRow>
                      <TableCell colSpan={5} className="text-center">No data available for the selected filters</TableCell>
                    </TableRow> : filteredData.map(part => <TableRow key={part.id}>
                        <TableCell>{part.created_at ? format(new Date(part.created_at), 'MMM dd, yyyy') : 'N/A'}</TableCell>
                        <TableCell>{part.projects?.name || 'N/A'}</TableCell>
                        <TableCell>{part.workstations?.name || 'N/A'}</TableCell>
                        <TableCell>{part.employees?.name || 'N/A'}</TableCell>
                        <TableCell className="max-w-xs truncate">{part.description}</TableCell>
                      </TableRow>)}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>;
};
export default BrokenPartsSummary;