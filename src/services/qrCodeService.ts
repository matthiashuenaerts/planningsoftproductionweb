import { supabase } from '@/integrations/supabase/client';

export interface Part {
  id: string;
  wand_naam: string | null;
  materiaal: string | null;
  dikte: string | null;
  doorlopende_nerf: string | null;
  nerf: string | null;
  commentaar: string | null;
  commentaar_2: string | null;
  cncprg1: string | null;
  cncprg2: string | null;
  abd: string | null;
  afbeelding: string | null;
  lengte: string | null;
  breedte: string | null;
  cnc_pos: string | null;
  afplak_boven: string | null;
  afplak_onder: string | null;
  afplak_links: string | null;
  afplak_rechts: string | null;
  aantal: number | null;
  workstation_name_status: string | null;
  parts_list_id: string;
  color_status: string | null;
}

export const qrCodeService = {
  /**
   * Search for a QR code value in cncprg1, cncprg2, and abd columns
   */
  async findPartByQRCode(qrCode: string): Promise<Part | null> {
    try {
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .or(`cncprg1.eq.${qrCode},cncprg2.eq.${qrCode},abd.eq.${qrCode}`)
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data || null;
    } catch (error: any) {
      console.error('Error finding part by QR code:', error);
      throw error;
    }
  },

  /**
   * Update the workstation_name_status for a specific part
   */
  async updatePartWorkstationStatus(partId: string, workstationName: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('parts')
        .update({ 
          workstation_name_status: workstationName,
          updated_at: new Date().toISOString()
        })
        .eq('id', partId);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error updating part workstation status:', error);
      throw error;
    }
  },

  /**
   * Search for multiple parts that match the QR code
   */
  async findAllPartsByQRCode(qrCode: string): Promise<Part[]> {
    try {
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .or(
          `wand_naam.ilike.%${qrCode}%,` +
          `materiaal.ilike.%${qrCode}%,` +
          `dikte.ilike.%${qrCode}%,` +
          `doorlopende_nerf.ilike.%${qrCode}%,` +
          `nerf.ilike.%${qrCode}%,` +
          `commentaar.ilike.%${qrCode}%,` +
          `commentaar_2.ilike.%${qrCode}%,` +
          `cncprg1.ilike.%${qrCode}%,` +
          `cncprg2.ilike.%${qrCode}%,` +
          `abd.ilike.%${qrCode}%,` +
          `afbeelding.ilike.%${qrCode}%,` +
          `lengte.ilike.%${qrCode}%,` +
          `breedte.ilike.%${qrCode}%,` +
          `cnc_pos.ilike.%${qrCode}%,` +
          `afplak_boven.ilike.%${qrCode}%,` +
          `afplak_onder.ilike.%${qrCode}%,` +
          `afplak_links.ilike.%${qrCode}%,` +
          `afplak_rechts.ilike.%${qrCode}%`
        );

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error finding all parts by QR code:', error);
      throw error;
    }
  }
};