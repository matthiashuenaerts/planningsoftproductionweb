import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
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
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Edit, Trash2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface InstallationTeam {
  id: string;
  name: string;
  color: string;
  external_team_names: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const InstallationTeamsSettings: React.FC = () => {
  const [teams, setTeams] = useState<InstallationTeam[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAddOrEditOpen, setIsAddOrEditOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<InstallationTeam | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState<InstallationTeam | null>(null);
  
  const [teamData, setTeamData] = useState({
    name: '',
    color: '#3b82f6',
    external_team_names: [] as string[],
    is_active: true
  });
  
  const [newExternalName, setNewExternalName] = useState('');
  
  const { toast } = useToast();

  const loadTeams = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('placement_teams')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setTeams(data || []);
    } catch (error: any) {
      console.error('Error loading installation teams:', error);
      toast({
        title: "Error",
        description: `Failed to load installation teams: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeams();
  }, []);

  const handleOpenAddOrEditDialog = (team: InstallationTeam | null) => {
    if (team) {
      setEditingTeam(team);
      setTeamData({
        name: team.name,
        color: team.color,
        external_team_names: team.external_team_names || [],
        is_active: team.is_active
      });
    } else {
      setEditingTeam(null);
      setTeamData({
        name: '',
        color: '#3b82f6',
        external_team_names: [],
        is_active: true
      });
    }
    setNewExternalName('');
    setIsAddOrEditOpen(true);
  };

  const handleAddExternalName = () => {
    const trimmed = newExternalName.trim();
    if (trimmed && !teamData.external_team_names.includes(trimmed)) {
      setTeamData(prev => ({
        ...prev,
        external_team_names: [...prev.external_team_names, trimmed]
      }));
      setNewExternalName('');
    }
  };

  const handleRemoveExternalName = (name: string) => {
    setTeamData(prev => ({
      ...prev,
      external_team_names: prev.external_team_names.filter(n => n !== name)
    }));
  };

  const handleSubmit = async () => {
    try {
      if (!teamData.name.trim()) {
        toast({ 
          title: "Validation Error", 
          description: "Team name is required", 
          variant: "destructive" 
        });
        return;
      }

      if (editingTeam) {
        const { error } = await supabase
          .from('placement_teams')
          .update(teamData)
          .eq('id', editingTeam.id);
        
        if (error) throw error;
        toast({ title: "Success", description: "Installation team updated successfully" });
      } else {
        const { error } = await supabase
          .from('placement_teams')
          .insert([teamData]);
        
        if (error) throw error;
        toast({ title: "Success", description: "Installation team added successfully" });
      }
      
      setIsAddOrEditOpen(false);
      setEditingTeam(null);
      loadTeams();
    } catch (error: any) {
      console.error('Error saving installation team:', error);
      toast({
        title: "Error",
        description: `Failed to save installation team: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const handleDeleteClick = (team: InstallationTeam) => {
    setTeamToDelete(team);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!teamToDelete) return;
    try {
      const { error } = await supabase
        .from('placement_teams')
        .delete()
        .eq('id', teamToDelete.id);
      
      if (error) throw error;
      toast({ title: "Success", description: "Installation team deleted successfully" });
      loadTeams();
    } catch (error: any) {
      console.error('Error deleting installation team:', error);
      toast({ 
        title: "Error", 
        description: `Failed to delete installation team: ${error.message}`, 
        variant: "destructive" 
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setTeamToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Installation Teams</CardTitle>
            <CardDescription>Manage installation teams and their external team name mappings</CardDescription>
          </div>
          <Dialog open={isAddOrEditOpen} onOpenChange={setIsAddOrEditOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenAddOrEditDialog(null)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Team
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingTeam ? 'Edit Installation Team' : 'Add New Installation Team'}</DialogTitle>
                <DialogDescription>
                  {editingTeam ? 'Update installation team details.' : 'Create a new installation team.'}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Team Name</Label>
                  <Input 
                    id="name" 
                    placeholder="e.g., Installation Team Green" 
                    value={teamData.name}
                    onChange={(e) => setTeamData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="color">Team Color</Label>
                  <div className="flex gap-2 items-center">
                    <Input 
                      id="color" 
                      type="color" 
                      value={teamData.color}
                      onChange={(e) => setTeamData(prev => ({ ...prev, color: e.target.value }))}
                      className="w-20 h-10"
                    />
                    <Input 
                      type="text" 
                      value={teamData.color}
                      onChange={(e) => setTeamData(prev => ({ ...prev, color: e.target.value }))}
                      placeholder="#3b82f6"
                      className="flex-1"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>External Team Names</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="e.g., 05 - GROEN PLAATSING - SPRINTER 2" 
                      value={newExternalName}
                      onChange={(e) => setNewExternalName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddExternalName();
                        }
                      }}
                    />
                    <Button type="button" onClick={handleAddExternalName} variant="outline">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {teamData.external_team_names.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {teamData.external_team_names.map((name) => (
                        <Badge key={name} variant="secondary" className="flex items-center gap-1">
                          {name}
                          <button
                            type="button"
                            onClick={() => handleRemoveExternalName(name)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end space-x-2 mt-4">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSubmit}>{editingTeam ? 'Update Team' : 'Add Team'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="animate-spin h-6 w-6" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Name</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>External Team Names</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No installation teams found
                    </TableCell>
                  </TableRow>
                ) : (
                  teams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">{team.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-6 h-6 rounded border border-border" 
                            style={{ backgroundColor: team.color }}
                          />
                          <span className="text-sm text-muted-foreground">{team.color}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {team.external_team_names && team.external_team_names.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {team.external_team_names.map((name) => (
                              <Badge key={name} variant="outline" className="text-xs">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No mappings</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={team.is_active ? "default" : "secondary"}>
                          {team.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline" 
                            size="icon"
                            onClick={() => handleOpenAddOrEditDialog(team)}
                            title="Edit Team"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => handleDeleteClick(team)}
                            title="Delete Team"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the installation team "{teamToDelete?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default InstallationTeamsSettings;
