import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { nl, fr, enUS } from 'date-fns/locale';
import Navbar from '@/components/Navbar';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/context/LanguageContext';
import { useTenant } from '@/context/TenantContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Ruler } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface MeasurementEntry {
  id: string;
  project_id: string;
  measurement_date: string | null;
  measurer_id: string | null;
  status: string;
  notes: string | null;
  project_name?: string;
  project_number?: string;
  measurer_name?: string;
}

const MeasurementCalendar = () => {
  const { t, lang, createLocalizedPath } = useLanguage();
  const { tenant } = useTenant();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const dateLocale = lang === 'nl' ? nl : lang === 'fr' ? fr : enUS;

  const { data: measurements = [], isLoading } = useQuery({
    queryKey: ['measurement-calendar', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('project_measurements' as any)
        .select('*')
        .eq('tenant_id', tenant.id)
        .not('measurement_date', 'is', null);
      if (error) throw error;

      const entries = (data ?? []) as unknown as MeasurementEntry[];

      // Fetch project names
      const projectIds = [...new Set(entries.map(e => e.project_id))];
      if (projectIds.length > 0) {
        const { data: projects } = await supabase
          .from('projects')
          .select('id, name, project_number')
          .in('id', projectIds);
        const projectMap = new Map((projects ?? []).map((p: any) => [p.id, p]));
        entries.forEach(e => {
          const proj = projectMap.get(e.project_id);
          if (proj) {
            e.project_name = proj.name;
            e.project_number = proj.project_number;
          }
        });
      }

      // Fetch measurer names
      const measurerIds = [...new Set(entries.filter(e => e.measurer_id).map(e => e.measurer_id!))];
      if (measurerIds.length > 0) {
        const { data: employees } = await supabase
          .from('employees')
          .select('id, name')
          .in('id', measurerIds);
        const empMap = new Map((employees ?? []).map((e: any) => [e.id, e.name]));
        entries.forEach(e => {
          if (e.measurer_id) e.measurer_name = empMap.get(e.measurer_id);
        });
      }

      return entries;
    },
    enabled: !!tenant?.id,
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getMeasurementsForDay = (day: Date) =>
    measurements.filter(m => m.measurement_date && isSameDay(new Date(m.measurement_date), day));

  const statusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="flex min-h-screen bg-muted/30">
      {!isMobile && (
        <div className="w-64 bg-sidebar fixed top-0 bottom-0">
          <Navbar />
        </div>
      )}
      {isMobile && <Navbar />}
      <div className={`w-full ${!isMobile ? 'ml-64 p-6' : 'px-3 pt-16 pb-4'}`}>
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className={`font-bold tracking-tight ${isMobile ? 'text-xl' : 'text-3xl'}`}>
                {t('measurement_calendar') || 'Measurement Calendar'}
              </h1>
              <p className="text-muted-foreground text-sm">
                {t('measurement_calendar_desc') || 'Overview of all scheduled measurements'}
              </p>
            </div>
          </div>

          {/* Month navigation */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <CardTitle className="text-lg capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: dateLocale })}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>
              ) : (
                <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                  {/* Week day headers */}
                  {weekDays.map(day => (
                    <div key={day} className="bg-muted px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                      {day}
                    </div>
                  ))}

                  {/* Calendar cells */}
                  {calendarDays.map(day => {
                    const dayMeasurements = getMeasurementsForDay(day);
                    const isToday = isSameDay(day, new Date());
                    const isCurrentMonth = isSameMonth(day, currentMonth);

                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "bg-background min-h-[100px] p-1.5 transition-colors",
                          !isCurrentMonth && "opacity-40",
                          isToday && "ring-2 ring-primary ring-inset"
                        )}
                      >
                        <span className={cn(
                          "text-xs font-medium",
                          isToday && "text-primary font-bold"
                        )}>
                          {format(day, 'd')}
                        </span>
                        <div className="mt-1 space-y-0.5">
                          {dayMeasurements.map(m => (
                            <button
                              key={m.id}
                              onClick={() => navigate(createLocalizedPath(`/projects/${m.project_id}`))}
                              className={cn(
                                "w-full text-left text-[10px] leading-tight px-1.5 py-1 rounded border truncate cursor-pointer hover:opacity-80 transition-opacity",
                                statusColor(m.status)
                              )}
                              title={`${m.project_name || 'Project'} — ${m.measurer_name || ''}`}
                            >
                              <div className="flex items-center gap-1">
                                <Ruler className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate font-medium">
                                  {m.project_number ? `${m.project_number} - ` : ''}{m.project_name || 'Project'}
                                </span>
                              </div>
                              {m.measurer_name && (
                                <div className="truncate text-[9px] opacity-75 mt-0.5">{m.measurer_name}</div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default MeasurementCalendar;
