import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Trash, Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  partTrackingService,
  TrackingRule,
  TrackingCondition,
  PART_COLUMNS,
  OPERATORS
} from '@/services/partTrackingService';
import { useLanguage } from '@/context/LanguageContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  workstationId: string;
  workstationName: string;
}

interface LocalCondition {
  tempId: string;
  column_name: string;
  operator: string;
  value: string | null;
}

interface LocalRule {
  tempId: string;
  logic_operator: 'AND' | 'OR';
  conditions: LocalCondition[];
}

const PartsTrackingSettingsDialog: React.FC<Props> = ({ isOpen, onClose, workstationId, workstationName }) => {
  const [rules, setRules] = useState<LocalRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    if (isOpen) loadRules();
  }, [isOpen, workstationId]);

  const loadRules = async () => {
    try {
      setLoading(true);
      const existing = await partTrackingService.getRulesForWorkstation(workstationId);
      if (existing.length > 0) {
        setRules(existing.map(r => ({
          tempId: r.id,
          logic_operator: r.logic_operator,
          conditions: r.conditions.map(c => ({
            tempId: c.id,
            column_name: c.column_name,
            operator: c.operator,
            value: c.value,
          })),
        })));
      } else {
        setRules([]);
      }
    } catch (error) {
      console.error('Error loading rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const addRule = () => {
    setRules(prev => [...prev, {
      tempId: crypto.randomUUID(),
      logic_operator: 'OR',
      conditions: [{
        tempId: crypto.randomUUID(),
        column_name: PART_COLUMNS[0].value,
        operator: 'is_not_empty',
        value: null,
      }],
    }]);
  };

  const removeRule = (ruleIdx: number) => {
    setRules(prev => prev.filter((_, i) => i !== ruleIdx));
  };

  const addCondition = (ruleIdx: number) => {
    setRules(prev => prev.map((r, i) => i === ruleIdx ? {
      ...r,
      conditions: [...r.conditions, {
        tempId: crypto.randomUUID(),
        column_name: PART_COLUMNS[0].value,
        operator: 'is_not_empty',
        value: null,
      }],
    } : r));
  };

  const removeCondition = (ruleIdx: number, condIdx: number) => {
    setRules(prev => prev.map((r, i) => i === ruleIdx ? {
      ...r,
      conditions: r.conditions.filter((_, ci) => ci !== condIdx),
    } : r));
  };

  const updateCondition = (ruleIdx: number, condIdx: number, field: string, value: string) => {
    setRules(prev => prev.map((r, i) => i === ruleIdx ? {
      ...r,
      conditions: r.conditions.map((c, ci) => ci === condIdx ? { ...c, [field]: value } : c),
    } : r));
  };

  const updateRuleOperator = (ruleIdx: number, op: 'AND' | 'OR') => {
    setRules(prev => prev.map((r, i) => i === ruleIdx ? { ...r, logic_operator: op } : r));
  };

  const needsValue = (op: string) => !['is_not_empty', 'is_empty'].includes(op);

  const handleSave = async () => {
    try {
      setSaving(true);
      await partTrackingService.saveRulesForWorkstation(workstationId, rules.map(r => ({
        workstation_id: workstationId,
        logic_operator: r.logic_operator,
        conditions: r.conditions.map(c => ({
          id: '',
          rule_id: '',
          column_name: c.column_name,
          operator: c.operator as TrackingCondition['operator'],
          value: needsValue(c.operator) ? c.value : null,
        })),
      })));
      toast({ title: t('success') || 'Success', description: 'Parts tracking rules saved' });
      onClose();
    } catch (error: any) {
      toast({ title: t('error') || 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Parts Tracking Settings — {workstationName}</DialogTitle>
          <DialogDescription>
            Define which parts from the imported CSV should be tracked at this workstation.
            Multiple rule groups are combined with OR logic.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin h-6 w-6" />
          </div>
        ) : (
          <div className="space-y-4">
            {rules.map((rule, ruleIdx) => (
              <Card key={rule.tempId} className="border-2">
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm">Rule Group {ruleIdx + 1}</CardTitle>
                    <Select
                      value={rule.logic_operator}
                      onValueChange={(v) => updateRuleOperator(ruleIdx, v as 'AND' | 'OR')}
                    >
                      <SelectTrigger className="w-24 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OR">OR (any)</SelectItem>
                        <SelectItem value="AND">AND (all)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Badge variant="outline" className="text-xs">
                      {rule.logic_operator === 'OR' ? 'Match any condition' : 'Match all conditions'}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeRule(ruleIdx)}>
                    <Trash className="h-4 w-4 text-destructive" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2 px-4 pb-4">
                  {rule.conditions.map((cond, condIdx) => (
                    <div key={cond.tempId} className="flex items-center gap-2">
                      {condIdx > 0 && (
                        <span className="text-xs font-medium text-muted-foreground w-8 text-center">
                          {rule.logic_operator}
                        </span>
                      )}
                      {condIdx === 0 && <span className="w-8" />}

                      <Select
                        value={cond.column_name}
                        onValueChange={(v) => updateCondition(ruleIdx, condIdx, 'column_name', v)}
                      >
                        <SelectTrigger className="w-44 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PART_COLUMNS.map(col => (
                            <SelectItem key={col.value} value={col.value}>{col.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={cond.operator}
                        onValueChange={(v) => updateCondition(ruleIdx, condIdx, 'operator', v)}
                      >
                        <SelectTrigger className="w-40 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OPERATORS.map(op => (
                            <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {needsValue(cond.operator) && (
                        <Input
                          className="h-8 w-32"
                          placeholder="Value"
                          value={cond.value || ''}
                          onChange={(e) => updateCondition(ruleIdx, condIdx, 'value', e.target.value)}
                        />
                      )}

                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeCondition(ruleIdx, condIdx)}>
                        <Trash className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}

                  <Button variant="outline" size="sm" onClick={() => addCondition(ruleIdx)} className="mt-2">
                    <PlusCircle className="h-3 w-3 mr-1" /> Add Condition
                  </Button>
                </CardContent>
              </Card>
            ))}

            <Button variant="outline" onClick={addRule} className="w-full">
              <PlusCircle className="h-4 w-4 mr-2" /> Add Rule Group
            </Button>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Rules
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PartsTrackingSettingsDialog;
