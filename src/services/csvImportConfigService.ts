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
  private cachedConfigs: Map<string, CsvImportConfig[]> = new Map();

  async getConfigs(configName: string = 'parts_list'): Promise<CsvImportConfig[]> {
    // Check cache for this specific config type
    if (this.cachedConfigs.has(configName)) {
      return this.cachedConfigs.get(configName)!;
    }

    const { data, error } = await supabase
      .from('csv_import_configs')
      .select('*')
      .eq('config_name', configName)
      .order('display_order', { ascending: true });

    if (error) throw error;
    
    const configs = data || [];
    this.cachedConfigs.set(configName, configs);
    return configs;
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

  clearCache(configName?: string) {
    if (configName) {
      this.cachedConfigs.delete(configName);
    } else {
      this.cachedConfigs.clear();
    }
  }
}

export const csvImportConfigService = new CsvImportConfigService();
