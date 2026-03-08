import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, Users, ClipboardList, CheckCircle2, User, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

interface Employee {
  id: string;
  name: string;
  role: string;
}

interface StandardTask {
  id: string;
  task_name: string;
  task_number: string;
  multi_user_task?: boolean;
}

interface EmployeeTaskAssignmentPanelProps {
  standardTasks: StandardTask[];
}

const EmployeeTaskAssignmentPanel: React.FC<EmployeeTaskAssignmentPanelProps> = ({ standardTasks }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [links, setLinks] = useState<Map<string, Set<string>>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: empData }, { data: linkData }] = await Promise.all([
        supabase.from('employees').select('id, name, role').order('name'),
        supabase.from('employee_standard_task_links').select('employee_id, standard_task_id'),
      ]);

      setEmployees(empData || []);

      const linkMap = new Map<string, Set<string>>();
      (linkData || []).forEach((l: any) => {
        if (!linkMap.has(l.employee_id)) linkMap.set(l.employee_id, new Set());
        linkMap.get(l.employee_id)!.add(l.standard_task_id);
      });
      setLinks(linkMap);
    } catch (e) {
      console.error('Error loading employee data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleToggle = async (employeeId: string, taskId: string) => {
    const currentLinks = links.get(employeeId) || new Set();
    const isAssigned = currentLinks.has(taskId);

    // Optimistic update
    setLinks(prev => {
      const next = new Map(prev);
      const empSet = new Set(next.get(employeeId) || []);
      if (isAssigned) {
        empSet.delete(taskId);
      } else {
        empSet.add(taskId);
      }
      next.set(employeeId, empSet);
      return next;
    });

    try {
      if (isAssigned) {
        await supabase
          .from('employee_standard_task_links')
          .delete()
          .eq('employee_id', employeeId)
          .eq('standard_task_id', taskId);
      } else {
        await supabase
          .from('employee_standard_task_links')
          .insert({ employee_id: employeeId, standard_task_id: taskId });
      }
    } catch (error) {
      // Revert on error
      loadData();
      toast.error('Fout bij het bijwerken van taaktoewijzing');
    }
  };

  const filteredEmployees = useMemo(() => {
    if (!searchTerm) return employees;
    const lower = searchTerm.toLowerCase();
    return employees.filter(e => e.name.toLowerCase().includes(lower));
  }, [employees, searchTerm]);

  const sortedTasks = useMemo(() => 
    [...standardTasks].sort((a, b) => a.task_number.localeCompare(b.task_number)),
    [standardTasks]
  );

  const totalAssignments = useMemo(() => {
    let count = 0;
    links.forEach(set => count += set.size);
    return count;
  }, [links]);

  if (loading) {
    return (
      <Card className="mt-6">
        <CardContent className="py-8">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Header with stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Werknemers & Taaktoewijzingen</h3>
            <p className="text-sm text-muted-foreground">
              Beheer welke standaard taken elke werknemer mag uitvoeren
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="gap-1.5 py-1">
            <User className="h-3.5 w-3.5" />
            {employees.length} werknemers
          </Badge>
          <Badge variant="secondary" className="gap-1.5 py-1">
            <ClipboardList className="h-3.5 w-3.5" />
            {standardTasks.length} taken
          </Badge>
          <Badge variant="outline" className="gap-1.5 py-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            {totalAssignments} toewijzingen
          </Badge>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Zoek werknemer..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Employee cards grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredEmployees.map(employee => {
          const empLinks = links.get(employee.id) || new Set();
          const assignedCount = empLinks.size;

          return (
            <Card key={employee.id} className="overflow-hidden border-border/60 hover:shadow-md transition-shadow">
              {/* Employee header */}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/40">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                    {employee.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{employee.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{employee.role}</p>
                  </div>
                </div>
                <Badge
                  variant={assignedCount > 0 ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {assignedCount}/{standardTasks.length} taken
                </Badge>
              </div>

              {/* Task checkboxes */}
              <CardContent className="p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {sortedTasks.map(task => {
                    const isAssigned = empLinks.has(task.id);
                    return (
                      <label
                        key={task.id}
                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors text-sm ${
                          isAssigned
                            ? 'bg-primary/5 hover:bg-primary/10'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <Checkbox
                          checked={isAssigned}
                          onCheckedChange={() => handleToggle(employee.id, task.id)}
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <span className={`truncate ${isAssigned ? 'text-foreground' : 'text-muted-foreground'}`}>
                          <span className="font-mono text-xs mr-1 opacity-60">{task.task_number}</span>
                          {task.task_name}
                        </span>
                        {task.multi_user_task && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto shrink-0">
                            Multi
                          </Badge>
                        )}
                      </label>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredEmployees.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Geen werknemers gevonden
        </div>
      )}
    </div>
  );
};

export default EmployeeTaskAssignmentPanel;
