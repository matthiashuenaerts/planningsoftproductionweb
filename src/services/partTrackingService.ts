import { supabase } from '@/integrations/supabase/client';

export interface TrackingRule {
  id: string;
  workstation_id: string;
  logic_operator: 'AND' | 'OR';
  conditions: TrackingCondition[];
}

export interface TrackingCondition {
  id: string;
  rule_id: string;
  column_name: string;
  operator: 'is_not_empty' | 'is_empty' | 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: string | null;
}

export interface PartWorkstationStatus {
  id: string;
  part_id: string;
  workstation_id: string;
  status: 'pending' | 'in_progress' | 'completed';
  completed_at: string | null;
  created_at: string;
}

// All available part columns for filtering
export const PART_COLUMNS = [
  { value: 'materiaal', label: 'Materiaal' },
  { value: 'dikte', label: 'Dikte' },
  { value: 'nerf', label: 'Nerf' },
  { value: 'lengte', label: 'Lengte' },
  { value: 'breedte', label: 'Breedte' },
  { value: 'aantal', label: 'Aantal' },
  { value: 'cnc_pos', label: 'CNC Pos' },
  { value: 'wand_naam', label: 'Wand Naam' },
  { value: 'afplak_boven', label: 'Afplak Boven' },
  { value: 'afplak_onder', label: 'Afplak Onder' },
  { value: 'afplak_links', label: 'Afplak Links' },
  { value: 'afplak_rechts', label: 'Afplak Rechts' },
  { value: 'commentaar', label: 'Commentaar' },
  { value: 'commentaar_2', label: 'Commentaar 2' },
  { value: 'cncprg1', label: 'CNC Prg 1' },
  { value: 'cncprg2', label: 'CNC Prg 2' },
  { value: 'abd', label: 'ABD' },
  { value: 'doorlopende_nerf', label: 'Doorlopende Nerf' },
];

export const OPERATORS = [
  { value: 'is_not_empty', label: 'Has a value' },
  { value: 'is_empty', label: 'Is empty' },
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'less_than', label: 'Less than' },
];

class PartTrackingService {
  async getRulesForWorkstation(workstationId: string): Promise<TrackingRule[]> {
    const { data: rules, error } = await supabase
      .from('workstation_part_tracking_rules')
      .select('*')
      .eq('workstation_id', workstationId);

    if (error) throw error;
    if (!rules || rules.length === 0) return [];

    const ruleIds = rules.map(r => r.id);
    const { data: conditions, error: condError } = await supabase
      .from('workstation_part_tracking_conditions')
      .select('*')
      .in('rule_id', ruleIds);

    if (condError) throw condError;

    return rules.map(rule => ({
      id: rule.id,
      workstation_id: rule.workstation_id,
      logic_operator: rule.logic_operator as 'AND' | 'OR',
      conditions: (conditions || [])
        .filter(c => c.rule_id === rule.id)
        .map(c => ({
          id: c.id,
          rule_id: c.rule_id,
          column_name: c.column_name,
          operator: c.operator as TrackingCondition['operator'],
          value: c.value,
        })),
    }));
  }

  async saveRulesForWorkstation(workstationId: string, rules: Omit<TrackingRule, 'id'>[]): Promise<void> {
    // Delete existing rules (cascade deletes conditions)
    await supabase
      .from('workstation_part_tracking_rules')
      .delete()
      .eq('workstation_id', workstationId);

    for (const rule of rules) {
      const { data: newRule, error: ruleError } = await supabase
        .from('workstation_part_tracking_rules')
        .insert({
          workstation_id: workstationId,
          logic_operator: rule.logic_operator,
        })
        .select()
        .single();

      if (ruleError) throw ruleError;

      if (rule.conditions.length > 0) {
        const { error: condError } = await supabase
          .from('workstation_part_tracking_conditions')
          .insert(
            rule.conditions.map(c => ({
              rule_id: newRule.id,
              column_name: c.column_name,
              operator: c.operator,
              value: c.value,
            }))
          );

        if (condError) throw condError;
      }
    }
  }

  // Check if a part matches a workstation's rules
  evaluatePartAgainstRules(part: Record<string, any>, rules: TrackingRule[]): boolean {
    if (rules.length === 0) return false;

    // Multiple rule groups are OR'd together
    return rules.some(rule => {
      if (rule.conditions.length === 0) return false;

      const evaluateCondition = (cond: TrackingCondition): boolean => {
        const val = part[cond.column_name];
        switch (cond.operator) {
          case 'is_not_empty':
            return val !== null && val !== undefined && val !== '';
          case 'is_empty':
            return val === null || val === undefined || val === '';
          case 'equals':
            return String(val) === cond.value;
          case 'not_equals':
            return String(val) !== cond.value;
          case 'contains':
            return val != null && String(val).toLowerCase().includes((cond.value || '').toLowerCase());
          case 'greater_than':
            return Number(val) > Number(cond.value);
          case 'less_than':
            return Number(val) < Number(cond.value);
          default:
            return false;
        }
      };

      if (rule.logic_operator === 'AND') {
        return rule.conditions.every(evaluateCondition);
      } else {
        return rule.conditions.some(evaluateCondition);
      }
    });
  }

  // Generate tracking records for all parts in a parts list against all workstation rules
  async generateTrackingForPartsList(partsListId: string): Promise<void> {
    // Get parts
    const { data: parts, error: partsError } = await supabase
      .from('parts')
      .select('*')
      .eq('parts_list_id', partsListId);

    if (partsError) throw partsError;
    if (!parts || parts.length === 0) return;

    // Get all rules with conditions
    const { data: allRules, error: rulesError } = await supabase
      .from('workstation_part_tracking_rules')
      .select('*');

    if (rulesError) throw rulesError;
    if (!allRules || allRules.length === 0) return;

    const ruleIds = allRules.map(r => r.id);
    const { data: allConditions, error: condError } = await supabase
      .from('workstation_part_tracking_conditions')
      .select('*')
      .in('rule_id', ruleIds);

    if (condError) throw condError;

    // Group rules by workstation
    const workstationRules = new Map<string, TrackingRule[]>();
    for (const rule of allRules) {
      const conditions = (allConditions || [])
        .filter(c => c.rule_id === rule.id)
        .map(c => ({
          id: c.id,
          rule_id: c.rule_id,
          column_name: c.column_name,
          operator: c.operator as TrackingCondition['operator'],
          value: c.value,
        }));

      const trackingRule: TrackingRule = {
        id: rule.id,
        workstation_id: rule.workstation_id,
        logic_operator: rule.logic_operator as 'AND' | 'OR',
        conditions,
      };

      if (!workstationRules.has(rule.workstation_id)) {
        workstationRules.set(rule.workstation_id, []);
      }
      workstationRules.get(rule.workstation_id)!.push(trackingRule);
    }

    // Generate tracking records
    const inserts: Array<{ part_id: string; workstation_id: string; status: string }> = [];

    for (const part of parts) {
      for (const [workstationId, rules] of workstationRules) {
        if (this.evaluatePartAgainstRules(part, rules)) {
          inserts.push({
            part_id: part.id,
            workstation_id: workstationId,
            status: 'pending',
          });
        }
      }
    }

    if (inserts.length > 0) {
      // Batch insert, ignore conflicts
      const { error } = await supabase
        .from('part_workstation_tracking')
        .upsert(inserts, { onConflict: 'part_id,workstation_id', ignoreDuplicates: true });

      if (error) throw error;
    }
  }

  // Get part counts per workstation for a project
  async getPartCountsByWorkstation(projectId: string): Promise<Record<string, { total: number; pending: number; completed: number }>> {
    // Get all parts lists for the project
    const { data: partsLists, error: plError } = await supabase
      .from('parts_lists')
      .select('id')
      .eq('project_id', projectId);

    if (plError) throw plError;
    if (!partsLists || partsLists.length === 0) return {};

    const plIds = partsLists.map(pl => pl.id);

    // Get all parts for these lists
    const { data: parts, error: partsError } = await supabase
      .from('parts')
      .select('id')
      .in('parts_list_id', plIds);

    if (partsError) throw partsError;
    if (!parts || parts.length === 0) return {};

    const partIds = parts.map(p => p.id);

    // Get tracking records
    const { data: tracking, error: trackError } = await supabase
      .from('part_workstation_tracking')
      .select('workstation_id, status')
      .in('part_id', partIds);

    if (trackError) throw trackError;

    const counts: Record<string, { total: number; pending: number; completed: number }> = {};
    for (const t of (tracking || [])) {
      if (!counts[t.workstation_id]) {
        counts[t.workstation_id] = { total: 0, pending: 0, completed: 0 };
      }
      counts[t.workstation_id].total++;
      if (t.status === 'pending') counts[t.workstation_id].pending++;
      if (t.status === 'completed') counts[t.workstation_id].completed++;
    }

    return counts;
  }

  // Get buffered part count for a workstation - only counts parts where the project has a TODO task at that workstation
  async getBufferedPartCount(workstationId: string): Promise<number> {
    const { data, error } = await supabase
      .rpc('get_buffered_part_count_with_todo', { p_workstation_id: workstationId });

    if (error) throw error;
    return data || 0;
  }

  // Mark parts as completed for a workstation when last task completes
  async completePartsForWorkstation(projectId: string, workstationId: string): Promise<number> {
    // Get all parts for this project
    const { data: partsLists } = await supabase
      .from('parts_lists')
      .select('id')
      .eq('project_id', projectId);

    if (!partsLists || partsLists.length === 0) return 0;

    const plIds = partsLists.map(pl => pl.id);
    const { data: parts } = await supabase
      .from('parts')
      .select('id')
      .in('parts_list_id', plIds);

    if (!parts || parts.length === 0) return 0;

    const partIds = parts.map(p => p.id);

    const { data, error } = await supabase
      .from('part_workstation_tracking')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('workstation_id', workstationId)
      .eq('status', 'pending')
      .in('part_id', partIds)
      .select();

    if (error) throw error;
    return data?.length || 0;
  }
}

export const partTrackingService = new PartTrackingService();
