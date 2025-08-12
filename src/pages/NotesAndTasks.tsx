import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import PersonalItemCard from '@/components/personal-items/PersonalItemCard';
import CreatePersonalItemDialog from '@/components/personal-items/CreatePersonalItemDialog';
import EditPersonalItemDialog from '@/components/personal-items/EditPersonalItemDialog';
import SharePersonalItemDialog from '@/components/personal-items/SharePersonalItemDialog';
import Navbar from '@/components/Navbar';

export interface PersonalItem {
  id: string;
  user_id: string;
  title: string;
  content: string | null;
  type: 'note' | 'task';
  status: 'active' | 'completed' | 'archived';
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
  attachments?: Array<{
    id: string;
    file_name: string;
    file_path: string;
    file_type: string;
    file_size: number;
  }>;
  shares?: Array<{
    id: string;
    shared_with_user_id: string;
    shared_by_user_id: string;
    can_edit: boolean;
    employee_name?: string;
  }>;
}

const NotesAndTasks = () => {
  const { currentEmployee } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PersonalItem | null>(null);
  const [sharingItem, setSharingItem] = useState<PersonalItem | null>(null);

  const { data: personalItems = [], isLoading, refetch } = useQuery({
    queryKey: ['personal-items', currentEmployee?.id],
    queryFn: async () => {
      if (!currentEmployee?.id) {
        throw new Error('User not authenticated');
      }

      // First, get items owned by the user
      const { data: ownedItems, error: ownedError } = await supabase
        .from('personal_items')
        .select(`
          *,
          personal_item_attachments(*),
          personal_item_shares(
            *,
            employees!personal_item_shares_shared_with_user_id_fkey(name)
          )
        `)
        .eq('user_id', currentEmployee.id)
        .order('updated_at', { ascending: false });

      if (ownedError) throw ownedError;

      // Then, get items shared with the user
      const { data: sharedItemIds, error: sharedIdsError } = await supabase
        .from('personal_item_shares')
        .select('personal_item_id')
        .eq('shared_with_user_id', currentEmployee.id);

      if (sharedIdsError) throw sharedIdsError;

      let sharedItems = [];
      if (sharedItemIds && sharedItemIds.length > 0) {
        const { data: sharedItemsData, error: sharedError } = await supabase
          .from('personal_items')
          .select(`
            *,
            personal_item_attachments(*),
            personal_item_shares(
              *,
              employees!personal_item_shares_shared_with_user_id_fkey(name)
            )
          `)
          .in('id', sharedItemIds.map(item => item.personal_item_id))
          .order('updated_at', { ascending: false });

        if (sharedError) throw sharedError;
        sharedItems = sharedItemsData || [];
      }

      // Combine owned and shared items, removing duplicates
      const allItems = [...(ownedItems || [])];
      
      // Add shared items that are not already owned
      sharedItems.forEach(sharedItem => {
        if (!allItems.find(item => item.id === sharedItem.id)) {
          allItems.push(sharedItem);
        }
      });

      // Sort by updated_at descending
      allItems.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      
      return allItems.map(item => ({
        ...item,
        type: item.type as 'note' | 'task',
        status: item.status as 'active' | 'completed' | 'archived',
        priority: item.priority as 'low' | 'medium' | 'high',
        attachments: item.personal_item_attachments || [],
        shares: (item.personal_item_shares || []).map(share => ({
          ...share,
          employee_name: share.employees?.name
        }))
      })) as PersonalItem[];
    },
    enabled: !!currentEmployee?.id,
  });

  const filteredItems = personalItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (item.content && item.content.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || item.priority === filterPriority;
    const matchesTab = activeTab === 'all' || item.type === activeTab;
    
    return matchesSearch && matchesStatus && matchesPriority && matchesTab;
  });

  const handleDeleteItem = async (item: PersonalItem) => {
    try {
      // Check if the current user is the owner of the item
      const isOwner = item.user_id === currentEmployee?.id;
      
      if (isOwner) {
        // If owner, delete the entire item (this will cascade delete shares and attachments)
        const { error } = await supabase
          .from('personal_items')
          .delete()
          .eq('id', item.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Item deleted successfully",
        });
      } else {
        // If not owner, just remove the sharing relationship
        const { error } = await supabase
          .from('personal_item_shares')
          .delete()
          .eq('personal_item_id', item.id)
          .eq('shared_with_user_id', currentEmployee?.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Item removed from your shared items",
        });
      }
      
      refetch();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive",
      });
    }
  };

  const handleToggleComplete = async (item: PersonalItem) => {
    try {
      const newStatus = item.status === 'completed' ? 'active' : 'completed';
      const { error } = await supabase
        .from('personal_items')
        .update({ status: newStatus })
        .eq('id', item.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Task ${newStatus === 'completed' ? 'completed' : 'reopened'}`,
      });
      
      refetch();
    } catch (error) {
      console.error('Error updating task status:', error);
      toast({
        title: "Error",
        description: "Failed to update task status",
        variant: "destructive",
      });
    }
  };

  if (!currentEmployee) {
    return (
      <div className="flex min-h-screen">
        <Navbar />
        <div className="flex-1 ml-64">
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">Please log in to access your notes and tasks.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <Navbar />
        <div className="flex-1 ml-64">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Navbar />
      <div className="flex-1 ml-64">
        <div className="w-full px-4 py-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Notes & Tasks</h1>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create New
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search notes and tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="note">Notes</TabsTrigger>
              <TabsTrigger value="task">Tasks</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">
              <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
                {filteredItems.map((item) => (
                  <div key={item.id} className="break-inside-avoid mb-4">
                    <PersonalItemCard
                      item={item}
                      onEdit={() => setEditingItem(item)}
                      onDelete={() => handleDeleteItem(item)}
                      onShare={() => setSharingItem(item)}
                      onToggleComplete={() => handleToggleComplete(item)}
                      refetch={refetch}
                    />
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="note" className="mt-6">
              <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
                {filteredItems.map((item) => (
                  <div key={item.id} className="break-inside-avoid mb-4">
                    <PersonalItemCard
                      item={item}
                      onEdit={() => setEditingItem(item)}
                      onDelete={() => handleDeleteItem(item)}
                      onShare={() => setSharingItem(item)}
                      onToggleComplete={() => handleToggleComplete(item)}
                      refetch={refetch}
                    />
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="task" className="mt-6">
              <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
                {filteredItems.map((item) => (
                  <div key={item.id} className="break-inside-avoid mb-4">
                    <PersonalItemCard
                      item={item}
                      onEdit={() => setEditingItem(item)}
                      onDelete={() => handleDeleteItem(item)}
                      onShare={() => setSharingItem(item)}
                      onToggleComplete={() => handleToggleComplete(item)}
                      refetch={refetch}
                    />
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          {filteredItems.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No items found. Create your first note or task!</p>
            </div>
          )}

          {/* Dialogs */}
          <CreatePersonalItemDialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
            onSuccess={refetch}
          />

          {editingItem && (
            <EditPersonalItemDialog
              item={editingItem}
              open={!!editingItem}
              onOpenChange={(open) => !open && setEditingItem(null)}
              onSuccess={refetch}
            />
          )}

          {sharingItem && (
            <SharePersonalItemDialog
              item={sharingItem}
              open={!!sharingItem}
              onOpenChange={(open) => !open && setSharingItem(null)}
              onSuccess={refetch}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default NotesAndTasks;
