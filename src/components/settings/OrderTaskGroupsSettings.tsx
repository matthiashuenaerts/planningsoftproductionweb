import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Package, Link, ChevronDown } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface TaskGroup {
  id: string;
  name: string;
  description: string | null;
}

interface StandardTask {
  id: string;
  task_name: string;
  task_number: string;
}

interface GroupLink {
  group_id: string;
  standard_task_id: string;
}

const OrderTaskGroupsSettings: React.FC = () => {
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [standardTasks, setStandardTasks] = useState<StandardTask[]>([]);
  const [links, setLinks] = useState<GroupLink[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [deleteGroup, setDeleteGroup] = useState<TaskGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAll = async () => {
    setLoading(true);
    const [groupsRes, tasksRes, linksRes] = await Promise.all([
      supabase.from('order_task_groups').select('id, name, description').order('name'),
      supabase.from('standard_tasks').select('id, task_name, task_number').order('task_number'),
      supabase.from('order_task_group_links').select('group_id, standard_task_id'),
    ]);
    setGroups((groupsRes.data as TaskGroup[]) || []);
    setStandardTasks((tasksRes.data as StandardTask[]) || []);
    setLinks((linksRes.data as GroupLink[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return;
    const { error } = await supabase.from('order_task_groups').insert({ name: newGroupName.trim(), description: newGroupDesc.trim() || null });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Group created' });
    setNewGroupName('');
    setNewGroupDesc('');
    fetchAll();
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroup) return;
    const { error } = await supabase.from('order_task_groups').delete().eq('id', deleteGroup.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Group deleted' });
    setDeleteGroup(null);
    fetchAll();
  };

  const handleToggleLink = async (groupId: string, taskId: string) => {
    const existing = links.find(l => l.group_id === groupId && l.standard_task_id === taskId);
    if (existing) {
      setLinks(prev => prev.filter(l => !(l.group_id === groupId && l.standard_task_id === taskId)));
      await supabase.from('order_task_group_links').delete().eq('group_id', groupId).eq('standard_task_id', taskId);
    } else {
      setLinks(prev => [...prev, { group_id: groupId, standard_task_id: taskId }]);
      await supabase.from('order_task_group_links').insert({ group_id: groupId, standard_task_id: taskId });
    }
  };

  const getLinkedTasks = (groupId: string) => links.filter(l => l.group_id === groupId).map(l => l.standard_task_id);

  if (loading) return <div className="text-muted-foreground p-4">Loading...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Task Groups
          </CardTitle>
          <CardDescription>
            Create groups of standard tasks that depend on order delivery dates. When an order is assigned a group, linked tasks won't be scheduled before the expected delivery.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new group */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label>Group Name</Label>
              <Input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="e.g., Material Delivery" />
            </div>
            <div className="flex-1">
              <Label>Description (optional)</Label>
              <Input value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)} placeholder="Tasks that depend on material arrival" />
            </div>
            <Button onClick={handleAddGroup} disabled={!newGroupName.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add Group
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Group cards with task linking */}
      {groups.map(group => {
        const linkedTaskIds = getLinkedTasks(group.id);
        return (
          <Card key={group.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Link className="h-4 w-4 text-primary" />
                    {group.name}
                    <Badge variant="secondary" className="ml-2">{linkedTaskIds.length} tasks</Badge>
                  </CardTitle>
                  {group.description && <CardDescription className="mt-1">{group.description}</CardDescription>}
                </div>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteGroup(group)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Label className="text-xs text-muted-foreground mb-2 block">Select standard tasks that should wait for orders in this group:</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {standardTasks.map(task => {
                  const isLinked = linkedTaskIds.includes(task.id);
                  return (
                    <label
                      key={task.id}
                      className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                        isLinked ? 'bg-primary/10 border-primary/30' : 'bg-card border-border hover:bg-muted/50'
                      }`}
                    >
                      <Checkbox checked={isLinked} onCheckedChange={() => handleToggleLink(group.id, task.id)} />
                      <span className="text-sm">
                        <span className="font-medium text-muted-foreground">{task.task_number}</span>{' '}
                        {task.task_name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {groups.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            No order task groups yet. Create one above to link standard tasks to order delivery dates.
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteGroup} onOpenChange={() => setDeleteGroup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteGroup?.name}" and remove all task links. Orders using this group will be unlinked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGroup}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OrderTaskGroupsSettings;
