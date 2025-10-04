import { supabase } from '@/integrations/supabase/client';

export interface EmailConfig {
  id?: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_password: string;
  from_email: string;
  from_name: string;
  created_at?: string;
  updated_at?: string;
}

export const emailConfigService = {
  async getConfig(): Promise<EmailConfig | null> {
    const { data, error } = await supabase
      .from('email_config')
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No config exists yet
        return null;
      }
      throw error;
    }

    return data;
  },

  async saveConfig(config: Omit<EmailConfig, 'id' | 'created_at' | 'updated_at'>): Promise<EmailConfig> {
    // Check if config exists
    const existingConfig = await this.getConfig();

    if (existingConfig) {
      // Update existing config
      const { data, error } = await supabase
        .from('email_config')
        .update(config)
        .eq('id', existingConfig.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Insert new config
      const { data, error } = await supabase
        .from('email_config')
        .insert(config)
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  async testConnection(config: Omit<EmailConfig, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('test-email-connection', {
        body: config
      });

      if (error) throw error;
      return data?.success || false;
    } catch (error) {
      console.error('Failed to test email connection:', error);
      return false;
    }
  }
};
