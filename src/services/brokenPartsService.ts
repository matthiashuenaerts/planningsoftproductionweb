
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { applyTenantFilter } from "@/lib/tenantQuery";

export interface BrokenPart {
  id?: string;
  project_id: string | null;
  workstation_id: string | null;
  description: string;
  image_path?: string | null;
  reported_by: string;
  created_at?: string;
  updated_at?: string;
  projects?: { name: string } | null;
  workstations?: { name: string } | null;
  employees?: { name: string } | null;
}

export const brokenPartsService = {
  // Upload image to Supabase storage
  async uploadImage(file: File, employeeId: string): Promise<string | null> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${employeeId}_${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('broken_parts')
        .upload(fileName, file);
      
      if (error) {
        console.error('Error uploading file:', error);
        toast.error('Failed to upload image');
        return null;
      }
      
      return data.path;
    } catch (error) {
      console.error('Error in uploadImage:', error);
      toast.error('Failed to upload image');
      return null;
    }
  },
  
  // Create a new broken part report
  async create(brokenPart: BrokenPart): Promise<BrokenPart | null> {
    try {
      const { data, error } = await supabase
        .from('broken_parts')
        .insert([brokenPart])
        .select()
        .single();
      
      if (error) {
        console.error('Error creating broken part record:', error);
        toast.error('Failed to save broken part information');
        return null;
      }
      
      toast.success('Broken part reported successfully');
      return data as BrokenPart;
    } catch (error) {
      console.error('Error in create:', error);
      toast.error('Failed to save broken part information');
      return null;
    }
  },
  
  // Get all broken parts
  async getAll(tenantId?: string | null): Promise<BrokenPart[]> {
    try {
      let query = supabase
        .from('broken_parts')
        .select(`
          *,
          projects:project_id (name),
          workstations:workstation_id (name),
          employees:reported_by (name)
        `)
        .order('created_at', { ascending: false });
      query = applyTenantFilter(query, tenantId);
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching broken parts:', error);
        toast.error('Failed to fetch broken parts');
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Error in getAll:', error);
      toast.error('Failed to fetch broken parts');
      return [];
    }
  },
  
  // Get broken parts statistics
  async getStatistics(timeFilter?: string): Promise<any> {
    try {
      let query = supabase
        .from('broken_parts')
        .select(`
          *,
          projects:project_id (name),
          workstations:workstation_id (name), 
          employees:reported_by (name)
        `);
        
      if (timeFilter) {
        // Apply time filtering if needed
        // This would be implemented based on specific requirements
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching statistics:', error);
        toast.error('Failed to fetch statistics');
        return null;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error in getStatistics:', error);
      toast.error('Failed to fetch statistics');
      return null;
    }
  },
  
  // Get image URL from path
  getImageUrl(path: string | null): string | null {
    if (!path) return null;
    
    try {
      const { data } = supabase.storage.from('broken_parts').getPublicUrl(path);
      return data.publicUrl;
    } catch (error) {
      console.error('Error getting image URL:', error);
      return null;
    }
  },

  // Delete a broken part
  async delete(id: string): Promise<boolean> {
    try {
      // First, get the broken part to see if it has an image
      const { data: brokenPart, error: fetchError } = await supabase
        .from('broken_parts')
        .select('image_path')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('Error fetching broken part:', fetchError);
        throw fetchError;
      }

      // Delete the image from storage if it exists
      if (brokenPart?.image_path) {
        const { error: storageError } = await supabase.storage
          .from('broken_parts')
          .remove([brokenPart.image_path]);

        if (storageError) {
          console.error('Error deleting image from storage:', storageError);
          // Continue with deletion even if image deletion fails
        }
      }

      // Delete the broken part record
      const { error: deleteError } = await supabase
        .from('broken_parts')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.error('Error deleting broken part:', deleteError);
        throw deleteError;
      }

      return true;
    } catch (error) {
      console.error('Error in delete:', error);
      throw error;
    }
  }
};
