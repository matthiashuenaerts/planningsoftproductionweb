import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Pencil, Trash2, Route } from 'lucide-react';
import { productionRouteService, ProductionRoute } from '@/services/productionRouteService';
import { standardTasksService, StandardTask } from '@/services/standardTasksService';
import { useLanguage } from '@/context/LanguageContext';
import { useTenant } from '@/context/TenantContext';

const ProductionRoutingSettings: React.FC = () => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { tenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState<ProductionRoute[]>([]);
  const [standardTasks, setStandardTasks] = useState<StandardTask[]>([]);
  
  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editingRoute, setEditingRoute] = useState<ProductionRoute | null>(null);
  const [routeName, setRouteName] = useState('');
  const [routeDescription, setRouteDescription] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  
  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [routeToDelete, setRouteToDelete] = useState<ProductionRoute | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [routesData, tasksData] = await Promise.all([
        productionRouteService.getAll(tenant?.id),
        standardTasksService.getAll(tenant?.id)
      ]);
      setRoutes(routesData);
      setStandardTasks(tasksData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: t('error'),
        description: t('failed_to_load_data'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = async (route?: ProductionRoute) => {
    if (route) {
      setEditingRoute(route);
      setRouteName(route.name);
      setRouteDescription(route.description || '');
      
      // Load existing tasks for this route
      try {
        const routeTasks = await productionRouteService.getRouteTasks(route.id);
        setSelectedTaskIds(routeTasks.map(t => t.standard_task_id));
      } catch (error) {
        console.error('Error loading route tasks:', error);
        setSelectedTaskIds([]);
      }
    } else {
      setEditingRoute(null);
      setRouteName('');
      setRouteDescription('');
      setSelectedTaskIds([]);
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingRoute(null);
    setRouteName('');
    setRouteDescription('');
    setSelectedTaskIds([]);
  };

  const handleTaskToggle = (taskId: string, checked: boolean) => {
    if (checked) {
      setSelectedTaskIds(prev => [...prev, taskId]);
    } else {
      setSelectedTaskIds(prev => prev.filter(id => id !== taskId));
    }
  };

  const handleSave = async () => {
    if (!routeName.trim()) {
      toast({
        title: t('error'),
        description: t('route_name_required'),
        variant: 'destructive'
      });
      return;
    }

    try {
      setSaving(true);
      
      let routeId: string;
      
      if (editingRoute) {
        await productionRouteService.update(editingRoute.id, routeName, routeDescription || null);
        routeId = editingRoute.id;
      } else {
        const newRoute = await productionRouteService.create(routeName, routeDescription || null);
        routeId = newRoute.id;
      }

      // Set the tasks for this route
      await productionRouteService.setRouteTasks(routeId, selectedTaskIds);

      toast({
        title: t('success'),
        description: editingRoute ? t('route_updated') : t('route_created')
      });

      handleCloseDialog();
      loadData();
    } catch (error) {
      console.error('Error saving route:', error);
      toast({
        title: t('error'),
        description: t('failed_to_save_route'),
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (route: ProductionRoute) => {
    setRouteToDelete(route);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!routeToDelete) return;

    try {
      await productionRouteService.delete(routeToDelete.id);
      toast({
        title: t('success'),
        description: t('route_deleted')
      });
      setShowDeleteDialog(false);
      setRouteToDelete(null);
      loadData();
    } catch (error) {
      console.error('Error deleting route:', error);
      toast({
        title: t('error'),
        description: t('failed_to_delete_route'),
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Route className="h-5 w-5" />
          {t('production_routing')}
        </CardTitle>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          {t('add_route')}
        </Button>
      </CardHeader>
      <CardContent>
        {routes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {t('no_routes_found')}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('name')}</TableHead>
                <TableHead>{t('description')}</TableHead>
                <TableHead className="w-[100px]">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map(route => (
                <TableRow key={route.id}>
                  <TableCell className="font-medium">{route.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {route.description || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(route)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(route)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRoute ? t('edit_route') : t('add_route')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="routeName">{t('route_name')}</Label>
              <Input
                id="routeName"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder={t('enter_route_name')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="routeDescription">{t('description')}</Label>
              <Textarea
                id="routeDescription"
                value={routeDescription}
                onChange={(e) => setRouteDescription(e.target.value)}
                placeholder={t('enter_route_description')}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('select_tasks')}</Label>
              <div className="border rounded-md p-4 max-h-[300px] overflow-y-auto space-y-2">
                {standardTasks.map(task => (
                  <div key={task.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`task-${task.id}`}
                      checked={selectedTaskIds.includes(task.id)}
                      onCheckedChange={(checked) => handleTaskToggle(task.id, checked as boolean)}
                    />
                    <label
                      htmlFor={`task-${task.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {task.task_number} - {task.task_name}
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedTaskIds.length} {t('tasks_selected')}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t('saving') : t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_route')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('delete_route_confirmation', { name: routeToDelete?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default ProductionRoutingSettings;
