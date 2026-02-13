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
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Edit, Trash2, X, Users, Truck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/context/TenantContext';
import { applyTenantFilter } from '@/lib/tenantQuery';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface InstallationTeam {
  id: string;
  name: string;
  color: string;
  external_team_names: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Employee {
  id: string;
  name: string;
}

interface TeamMember {
  id: string;
  team_id: string;
  employee_id: string;
  is_default: boolean;
}

interface TruckData {
  id: string;
  truck_number: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  tenant_id: string;
}

const InstallationTeamsSettings: React.FC = () => {
  const { tenant } = useTenant();
  const [teams, setTeams] = useState<InstallationTeam[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [teamMembers, setTeamMembers] = useState<Record<string, TeamMember[]>>({});
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
  
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [newExternalName, setNewExternalName] = useState('');
  
  // Trucks state
  const [trucks, setTrucks] = useState<TruckData[]>([]);
  const [trucksLoading, setTrucksLoading] = useState(true);
  const [isTruckDialogOpen, setIsTruckDialogOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<TruckData | null>(null);
  const [truckFormData, setTruckFormData] = useState({ truck_number: '', description: '' });
  const [truckToDelete, setTruckToDelete] = useState<TruckData | null>(null);
  const [isTruckDeleteOpen, setIsTruckDeleteOpen] = useState(false);
  
  const { toast } = useToast();

  const loadTeams = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('placement_teams')
        .select('*')
        .order('name');
      query = applyTenantFilter(query, tenant?.id);
      const { data, error } = await query;
      
      if (error) throw error;
      setTeams(data || []);
      
      // Load team members for all teams
      if (data && data.length > 0) {
        const { data: membersData, error: membersError } = await supabase
          .from('placement_team_members')
          .select('*');
        
        if (membersError) throw membersError;
        
        // Group members by team_id
        const membersByTeam: Record<string, TeamMember[]> = {};
        (membersData || []).forEach((member: TeamMember) => {
          if (!membersByTeam[member.team_id]) {
            membersByTeam[member.team_id] = [];
          }
          membersByTeam[member.team_id].push(member);
        });
        setTeamMembers(membersByTeam);
      }
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

  const loadEmployees = async () => {
    try {
      let query = supabase
        .from('employees')
        .select('id, name')
        .order('name');
      query = applyTenantFilter(query, tenant?.id);
      const { data, error } = await query;
      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      console.error('Error loading employees:', error);
    }
  };

  const loadTrucks = async () => {
    try {
      setTrucksLoading(true);
      let query = supabase
        .from('trucks')
        .select('*')
        .order('truck_number');
      query = applyTenantFilter(query, tenant?.id);
      const { data, error } = await query;
      if (error) throw error;
      setTrucks(data || []);
    } catch (error: any) {
      console.error('Error loading trucks:', error);
      toast({ title: "Error", description: `Failed to load trucks: ${error.message}`, variant: "destructive" });
    } finally {
      setTrucksLoading(false);
    }
  };

  const handleOpenTruckDialog = (truck: TruckData | null) => {
    if (truck) {
      setEditingTruck(truck);
      setTruckFormData({ truck_number: truck.truck_number.toString(), description: truck.description || '' });
    } else {
      setEditingTruck(null);
      setTruckFormData({ truck_number: '', description: '' });
    }
    setIsTruckDialogOpen(true);
  };

  const handleSaveTruck = async () => {
    try {
      if (!truckFormData.truck_number) {
        toast({ title: "Error", description: "Truck number is required", variant: "destructive" });
        return;
      }
      const payload = {
        truck_number: truckFormData.truck_number,
        description: truckFormData.description || null,
      };
      if (editingTruck) {
        const { error } = await supabase.from('trucks').update(payload).eq('id', editingTruck.id);
        if (error) throw error;
        toast({ title: "Success", description: "Truck updated successfully" });
      } else {
        const { error } = await supabase.from('trucks').insert([payload]).select();
        if (error) throw error;
        toast({ title: "Success", description: "Truck added successfully" });
      }
      setIsTruckDialogOpen(false);
      loadTrucks();
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to save truck: ${error.message}`, variant: "destructive" });
    }
  };

  const handleDeleteTruck = async () => {
    if (!truckToDelete) return;
    try {
      const { error } = await supabase.from('trucks').delete().eq('id', truckToDelete.id);
      if (error) throw error;
      toast({ title: "Success", description: "Truck deleted successfully" });
      loadTrucks();
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to delete truck: ${error.message}`, variant: "destructive" });
    } finally {
      setIsTruckDeleteOpen(false);
      setTruckToDelete(null);
    }
  };

  useEffect(() => {
    loadTeams();
    loadEmployees();
    loadTrucks();
  }, [tenant?.id]);

  const handleOpenAddOrEditDialog = (team: InstallationTeam | null) => {
    if (team) {
      setEditingTeam(team);
      setTeamData({
        name: team.name,
        color: team.color,
        external_team_names: team.external_team_names || [],
        is_active: team.is_active
      });
      // Load existing team members
      const existingMembers = teamMembers[team.id] || [];
      setSelectedMemberIds(existingMembers.map(m => m.employee_id));
    } else {
      setEditingTeam(null);
      setTeamData({
        name: '',
        color: '#3b82f6',
        external_team_names: [],
        is_active: true
      });
      setSelectedMemberIds([]);
    }
    setNewExternalName('');
    setIsAddOrEditOpen(true);
  };

  const handleToggleMember = (employeeId: string) => {
    setSelectedMemberIds(prev => 
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
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

      let teamId: string;

      if (editingTeam) {
        const { error } = await supabase
          .from('placement_teams')
          .update(teamData)
          .eq('id', editingTeam.id);
        
        if (error) throw error;
        teamId = editingTeam.id;
        
        // Delete existing team members
        await supabase
          .from('placement_team_members')
          .delete()
          .eq('team_id', editingTeam.id);
          
        toast({ title: "Success", description: "Installation team updated successfully" });
      } else {
        const { data, error } = await supabase
          .from('placement_teams')
          .insert([teamData])
          .select()
          .single();
        
        if (error) throw error;
        teamId = data.id;
        toast({ title: "Success", description: "Installation team added successfully" });
      }
      
      // Insert team members
      if (selectedMemberIds.length > 0) {
        const membersToInsert = selectedMemberIds.map(employeeId => ({
          team_id: teamId,
          employee_id: employeeId,
          is_default: false
        }));
        
        const { error: membersError } = await supabase
          .from('placement_team_members')
          .insert(membersToInsert);
        
        if (membersError) throw membersError;
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
    <Tabs defaultValue="teams" className="space-y-6">
      <TabsList>
        <TabsTrigger value="teams"><Users className="h-4 w-4 mr-2" />Teams</TabsTrigger>
        <TabsTrigger value="trucks"><Truck className="h-4 w-4 mr-2" />Trucks</TabsTrigger>
      </TabsList>
      <TabsContent value="teams">
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
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Default Team Members
                  </Label>
                  <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                    {employees.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No employees found</p>
                    ) : (
                      employees.map((employee) => (
                        <div key={employee.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`employee-${employee.id}`}
                            checked={selectedMemberIds.includes(employee.id)}
                            onCheckedChange={() => handleToggleMember(employee.id)}
                          />
                          <Label 
                            htmlFor={`employee-${employee.id}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {employee.name}
                          </Label>
                        </div>
                      ))
                    )}
                  </div>
                  {selectedMemberIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {selectedMemberIds.length} member(s) selected
                    </p>
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
                  <TableHead>Default Members</TableHead>
                  <TableHead>External Team Names</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No installation teams found
                    </TableCell>
                  </TableRow>
                ) : (
                  teams.map((team) => {
                    const members = teamMembers[team.id] || [];
                    const memberNames = members
                      .map(m => employees.find(e => e.id === m.employee_id)?.name)
                      .filter(Boolean);
                    
                    return (
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
                          {memberNames.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {memberNames.map((name) => (
                                <Badge key={name} variant="secondary" className="text-xs">
                                  {name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">No members</span>
                          )}
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
                    );
                  })
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
      </TabsContent>
      <TabsContent value="trucks">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Trucks</CardTitle>
              <CardDescription>Manage available trucks for installation</CardDescription>
            </div>
            <Button onClick={() => handleOpenTruckDialog(null)}>
              <Plus className="mr-2 h-4 w-4" />Add Truck
            </Button>
          </CardHeader>
          <CardContent>
            {trucksLoading ? (
              <div className="flex justify-center p-4"><Loader2 className="animate-spin h-6 w-6" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Truck Number</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trucks.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No trucks found</TableCell></TableRow>
                  ) : (
                    trucks.map((truck) => (
                      <TableRow key={truck.id}>
                        <TableCell className="font-medium">T{truck.truck_number}</TableCell>
                        <TableCell>{truck.description || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={() => handleOpenTruckDialog(truck)}><Edit className="h-4 w-4" /></Button>
                            <Button variant="destructive" size="icon" onClick={() => { setTruckToDelete(truck); setIsTruckDeleteOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
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

        <Dialog open={isTruckDialogOpen} onOpenChange={setIsTruckDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTruck ? 'Edit Truck' : 'Add New Truck'}</DialogTitle>
              <DialogDescription>{editingTruck ? 'Update truck details.' : 'Add a new truck.'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="truck_number">Truck Number</Label>
                <Input id="truck_number" placeholder="e.g., 1" value={truckFormData.truck_number} onChange={(e) => setTruckFormData(prev => ({ ...prev, truck_number: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="truck_desc">Description</Label>
                <Input id="truck_desc" placeholder="e.g., Large delivery truck" value={truckFormData.description} onChange={(e) => setTruckFormData(prev => ({ ...prev, description: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={handleSaveTruck}>{editingTruck ? 'Update' : 'Add'}</Button>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isTruckDeleteOpen} onOpenChange={setIsTruckDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Truck?</AlertDialogTitle>
              <AlertDialogDescription>This will permanently delete truck T{truckToDelete?.truck_number}.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTruck}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TabsContent>
    </Tabs>
  );
};

export default InstallationTeamsSettings;
