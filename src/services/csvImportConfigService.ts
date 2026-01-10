import { supabase } from '@/integrations/supabase/client';

export interface CsvImportConfig {
  id: string;
  config_name: string;
  csv_header: string;
  db_column: string;
  is_required: boolean;
  display_order: number;
  description: string | null;
}

class CsvImportConfigService {
  private cachedConfigs: CsvImportConfig[] | null = null;

  async getConfigs(configName: string = 'parts_list'): Promise<CsvImportConfig[]> {
    if (this.cachedConfigs) {
      return this.cachedConfigs;
    }

    const { data, error } = await supabase
      .from('csv_import_configs')
      .select('*')
      .eq('config_name', configName)
      .order('display_order', { ascending: true });

    if (error) throw error;
    
    this.cachedConfigs = data || [];
    return this.cachedConfigs;
  }

  async getHeaderMap(configName: string = 'parts_list'): Promise<Record<string, string>> {
    const configs = await this.getConfigs(configName);
    const headerMap: Record<string, string> = {};
    
    for (const config of configs) {
      headerMap[config.csv_header] = config.db_column;
    }
    
    return headerMap;
  }

  async getRequiredHeaders(configName: string = 'parts_list'): Promise<string[]> {
    const configs = await this.getConfigs(configName);
    return configs.filter(c => c.is_required).map(c => c.csv_header);
  }

  clearCache() {
    this.cachedConfigs = null;
  }
}

export const csvImportConfigService = new CsvImportConfigService();
