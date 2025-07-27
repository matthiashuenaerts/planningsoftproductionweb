
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit2, Trash2, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface EmailConnection {
  id: string;
  email_address: string;
  general_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const EmailSettings: React.FC = () => {
  const [emailConnections, setEmailConnections] = useState<EmailConnection[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<EmailConnection | null>(null);
  const [formData, setFormData] = useState({
    email_address: '',
    general_name: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    loadEmailConnections();
  }, []);

  const loadEmailConnections = async () => {
    try {
      const { data, error } = await supabase
        .from('email_connections')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading email connections:', error);
        toast({
          title: "Error",
          description: "Failed to load email connections",
          variant: "destructive"
        });
        return;
      }

      setEmailConnections(data || []);
    } catch (error) {
      console.error('Error loading email connections:', error);
      toast({
        title: "Error",
        description: "Failed to load email connections",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email_address || !formData.general_name) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingConnection) {
        // Update existing connection
        const { error } = await supabase
          .from('email_connections')
          .update({
            email_address: formData.email_address,
            general_name: formData.general_name,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingConnection.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Email connection updated successfully"
        });
      } else {
        // Create new connection
        const { error } = await supabase
          .from('email_connections')
          .insert([{
            email_address: formData.email_address,
            general_name: formData.general_name,
            is_active: true
          }]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Email connection added successfully"
        });
      }

      setFormData({ email_address: '', general_name: '' });
      setIsAddDialogOpen(false);
      setIsEditDialogOpen(false);
      setEditingConnection(null);
      loadEmailConnections();
    } catch (error) {
      console.error('Error saving email connection:', error);
      toast({
        title: "Error",
        description: "Failed to save email connection",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (connection: EmailConnection) => {
    setEditingConnection(connection);
    setFormData({
      email_address: connection.email_address,
      general_name: connection.general_name
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('email_connections')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Email connection deleted successfully"
      });
      
      loadEmailConnections();
    } catch (error) {
      console.error('Error deleting email connection:', error);
      toast({
        title: "Error",
        description: "Failed to delete email connection",
        variant: "destructive"
      });
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('email_connections')
        .update({ 
          is_active: !isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Email connection ${!isActive ? 'activated' : 'deactivated'}`
      });
      
      loadEmailConnections();
    } catch (error) {
      console.error('Error toggling email connection:', error);
      toast({
        title: "Error",
        description: "Failed to update email connection",
        variant: "destructive"
      });
    }
  };

  const EmailConnectionForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email_address">Email Address</Label>
        <Input
          id="email_address"
          type="email"
          value={formData.email_address}
          onChange={(e) => setFormData({ ...formData, email_address: e.target.value })}
          placeholder="Enter email address"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="general_name">General Name</Label>
        <Input
          id="general_name"
          type="text"
          value={formData.general_name}
          onChange={(e) => setFormData({ ...formData, general_name: e.target.value })}
          placeholder="Enter a general name for this email"
          required
        />
      </div>
      <div className="flex gap-2 pt-4">
        <Button type="submit" className="flex-1">
          {editingConnection ? 'Update' : 'Add'} Email Connection
        </Button>
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => {
            setIsAddDialogOpen(false);
            setIsEditDialogOpen(false);
            setEditingConnection(null);
            setFormData({ email_address: '', general_name: '' });
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Connections
              </CardTitle>
              <CardDescription>
                Manage email addresses for sending system notifications
              </CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Email Connection
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Email Connection</DialogTitle>
                </DialogHeader>
                <EmailConnectionForm />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {emailConnections.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No email connections configured</p>
              <p className="text-sm text-gray-400 mt-1">
                Add an email connection to start sending notifications
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {emailConnections.map((connection) => (
                <div 
                  key={connection.id}
                  className={`p-4 border rounded-lg ${
                    connection.is_active 
                      ? 'border-green-200 bg-green-50' 
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{connection.general_name}</h4>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          connection.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {connection.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {connection.email_address}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleActive(connection.id, connection.is_active)}
                      >
                        {connection.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(connection)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(connection.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Email Connection</DialogTitle>
          </DialogHeader>
          <EmailConnectionForm />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailSettings;
