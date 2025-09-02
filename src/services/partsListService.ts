
import { supabase } from '@/integrations/supabase/client';

export interface PartsList {
  id: string;
  project_id: string;
  task_id?: string;
  order_id?: string;
  file_name: string;
  imported_by?: string;
  imported_at: string;
  created_at: string;
  updated_at: string;
}

export interface Part {
  id: string;
  parts_list_id: string;
  materiaal?: string;
  dikte?: string;
  nerf?: string;
  lengte?: string;
  breedte?: string;
  aantal?: number;
  cnc_pos?: string;
  wand_naam?: string;
  afplak_boven?: string;
  afplak_onder?: string;
  afplak_links?: string;
  afplak_rechts?: string;
  commentaar?: string;
  commentaar_2?: string;
  cncprg1?: string;
  cncprg2?: string;
  abd?: string;
  afbeelding?: string;
  doorlopende_nerf?: string;
  workstation_name_status?: string;
  color_status: 'none' | 'green' | 'orange' | 'red';
  created_at: string;
  updated_at: string;
}

export class PartsListService {
  async importPartsFromCSV(
    projectId: string,
    taskId: string | null,
    csvContent: string,
    fileName: string,
    importedBy?: string,
    orderId?: string
  ): Promise<PartsList> {
    // Create parts list record
    const { data: partsList, error: partsListError } = await supabase
      .from('parts_lists')
      .insert({
        project_id: projectId,
        task_id: taskId,
        order_id: orderId,
        file_name: fileName,
        imported_by: importedBy
      })
      .select()
      .single();

    if (partsListError) throw partsListError;

    // Parse CSV content using semicolon delimiter
    const lines = csvContent.split('\n');
    const headers = lines[0].split(';').map(h => h.trim());
    
    // Expected headers mapping
    const headerMap = {
      'Materiaal': 'materiaal',
      'Dikte': 'dikte',
      'Nerf': 'nerf',
      'Lengte': 'lengte',
      'Breedte': 'breedte',
      'Aantal': 'aantal',
      'CNC pos': 'cnc_pos',
      'CNC  pos': 'cnc_pos', // Handle extra space variation
      'Wand Naam': 'wand_naam',
      'Afplak Boven': 'afplak_boven',
      'Afplak Onder': 'afplak_onder',
      'Afplak Links': 'afplak_links',
      'Afplak Rechts': 'afplak_rechts',
      'Commentaar': 'commentaar',
      'Commentaar 2': 'commentaar_2',
      'CNCPRG1': 'cncprg1',
      'CNCPRG2': 'cncprg2',
      'ABD': 'abd',
      'Afbeelding': 'afbeelding',
      'Doorlopende nerf': 'doorlopende_nerf'
    };

    // Parse parts from CSV
    const parts = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(';');
      const part: any = {
        parts_list_id: partsList.id,
        color_status: 'none' as const
      };

      headers.forEach((header, index) => {
        const fieldName = headerMap[header as keyof typeof headerMap];
        if (fieldName && values[index]) {
          const value = values[index].trim();
          if (fieldName === 'aantal') {
            part[fieldName] = parseInt(value) || 0;
          } else {
            part[fieldName] = value;
          }
        }
      });

      parts.push(part);
    }

    // Insert parts with proper type casting
    if (parts.length > 0) {
      const { error: partsError } = await supabase
        .from('parts')
        .insert(parts);

      if (partsError) throw partsError;
    }

    return partsList;
  }

  async getPartsListsByProject(projectId: string): Promise<PartsList[]> {
    const { data, error } = await supabase
      .from('parts_lists')
      .select('*')
      .eq('project_id', projectId)
      .order('imported_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getPartsListsByTask(taskId: string): Promise<PartsList[]> {
    const { data, error } = await supabase
      .from('parts_lists')
      .select('*')
      .eq('task_id', taskId)
      .order('imported_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getPartsListsByOrder(orderId: string): Promise<PartsList[]> {
    const { data, error } = await supabase
      .from('parts_lists')
      .select('*')
      .eq('order_id', orderId)
      .order('imported_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async createPart(part: Omit<Part, 'id' | 'created_at' | 'updated_at'>): Promise<Part> {
    const { data, error } = await supabase
      .from('parts')
      .insert(part)
      .select()
      .single();

    if (error) throw error;
    return data as Part;
  }

  async updatePart(partId: string, updates: Partial<Part>): Promise<Part> {
    const { data, error } = await supabase
      .from('parts')
      .update(updates)
      .eq('id', partId)
      .select()
      .single();

    if (error) throw error;
    return data as Part;
  }

  async deletePart(partId: string): Promise<void> {
    const { error } = await supabase
      .from('parts')
      .delete()
      .eq('id', partId);

    if (error) throw error;
  }

  async getPartsByPartsList(partsListId: string): Promise<Part[]> {
    const { data, error } = await supabase
      .from('parts')
      .select('*')
      .eq('parts_list_id', partsListId)
      .order('created_at');

    if (error) throw error;
    
    // Cast the data to ensure proper typing
    return (data || []).map(part => ({
      ...part,
      color_status: part.color_status as 'none' | 'green' | 'orange' | 'red'
    }));
  }

  async updatePartColor(partId: string, colorStatus: 'none' | 'green' | 'orange' | 'red'): Promise<void> {
    const { error } = await supabase
      .from('parts')
      .update({ color_status: colorStatus })
      .eq('id', partId);

    if (error) throw error;
  }

  async deletePartsList(partsListId: string): Promise<void> {
    const { error } = await supabase
      .from('parts_lists')
      .delete()
      .eq('id', partsListId);

    if (error) throw error;
  }
}

export const partsListService = new PartsListService();
