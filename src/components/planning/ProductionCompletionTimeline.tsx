import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, CheckCircle2, Flag, Clock, ChevronLeft, ChevronRight, FlaskConical } from 'lucide-react';
import { format, addDays, startOfDay, differenceInDays, isWeekend, isSameDay, isValid } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useLanguage } from '@/context/LanguageContext';
import TestRushProjectDialog from './TestRushProjectDialog';

export interface ProjectCompletionData {
  projectId: string;
  projectName: string;
  client: string;
  installationDate: Date;
  lastProductionStepEnd: Date | null;
  status: 'on_track' | 'at_risk' | 'overdue' | 'pending';
  daysRemaining: number;
}

interface ProductionCompletionTimelineProps {
  projectCompletions: ProjectCompletionData[];
  loading?: boolean;
  lastProductionStepName?: string;
}

const ProductionCompletionTimeline: React.FC<ProductionCompletionTimelineProps> = ({
  projectCompletions,
  loading = false,
  lastProductionStepName
}) => {
  const { t } = useLanguage();
  const [weekOffset, setWeekOffset] = useState(0);
  const [showTestDialog, setShowTestDialog] = useState(false);

  const timelineStart = useMemo(() => addDays(startOfDay(new Date()), weekOffset * 7), [weekOffset]);
  const daysToShow = 21;
  const dayWidth = 32;

  const timelineDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < daysToShow; i++) {
      days.push(addDays(timelineStart, i));
    }
    return days;
  }, [timelineStart]);

  const sortedProjects = useMemo(() => {
    return [...projectCompletions]
      .filter(p => {
        if (!isValid(p.installationDate)) return false;
        const daysDiff = differenceInDays(p.installationDate, timelineStart);
        return daysDiff >= -3 && daysDiff <= daysToShow;
      })
      .sort((a, b) => a.installationDate.getTime() - b.installationDate.getTime());
  }, [projectCompletions, daysToShow, timelineStart]);

  const getStatusColor = (status: ProjectCompletionData['status']) => {
    switch (status) {
      case 'on_track': return 'bg-green-500';
      case 'at_risk': return 'bg-yellow-500';
      case 'overdue': return 'bg-red-500';
      default: return 'bg-muted-foreground/40';
    }
  };

  const getStatusBadge = (status: ProjectCompletionData['status']) => {
    switch (status) {
      case 'on_track': return <Badge className="bg-green-100 text-green-800 text-[10px] px-1 py-0">OK</Badge>;
      case 'at_risk': return <Badge className="bg-yellow-100 text-yellow-800 text-[10px] px-1 py-0">{t('timeline_at_risk')}</Badge>;
      case 'overdue': return <Badge className="bg-red-100 text-red-800 text-[10px] px-1 py-0">{t('timeline_overdue')}</Badge>;
      default: return <Badge variant="secondary" className="text-[10px] px-1 py-0">?</Badge>;
    }
  };

  const stats = useMemo(() => ({
    onTrack: projectCompletions.filter(p => p.status === 'on_track').length,
    atRisk: projectCompletions.filter(p => p.status === 'at_risk').length,
    overdue: projectCompletions.filter(p => p.status === 'overdue').length,
    pending: projectCompletions.filter(p => p.status === 'pending').length,
  }), [projectCompletions]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 bg-muted/50 rounded">
        <Clock className="h-3 w-3 animate-spin" />
        <span>{t('timeline_calculating')}</span>
      </div>
    );
  }

  if (!lastProductionStepName) {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-700 p-2 bg-amber-50 rounded border border-amber-200">
        <AlertTriangle className="h-3 w-3" />
        <span>{t('timeline_configure_step')}</span>
      </div>
    );
  }

  if (sortedProjects.length === 0 && weekOffset === 0) {
    return (
      <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded flex items-center justify-between">
        <span>{t('timeline_no_projects').replace('{{days}}', String(daysToShow))}</span>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setWeekOffset(w => w - 1)}>
            <ChevronLeft className="h-3 w-3" />
          </Button>
          {weekOffset !== 0 && (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setWeekOffset(0)}>
              {t('timeline_today')}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setWeekOffset(w => w + 1)}>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Compact header with stats */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <Flag className="h-3 w-3 text-primary" />
          <span className="font-medium">{t('timeline_production_deadline')}</span>
          <span className="text-muted-foreground">({lastProductionStepName})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-green-600 font-medium">{stats.onTrack} ✓</span>
          <span className="text-yellow-600 font-medium">{stats.atRisk} ⚠</span>
          <span className="text-red-600 font-medium">{stats.overdue} ✗</span>
          <span className="text-muted-foreground">{stats.pending} ?</span>
          
          {/* Week navigation */}
          <div className="flex items-center gap-0.5 ml-2 border-l pl-2">
            <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => setWeekOffset(w => w - 1)}>
              <ChevronLeft className="h-3 w-3" />
            </Button>
            {weekOffset !== 0 && (
              <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={() => setWeekOffset(0)}>
                {t('timeline_today')}
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => setWeekOffset(w => w + 1)}>
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>

          {/* Test Rush Project button */}
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px] ml-1"
            onClick={() => setShowTestDialog(true)}
          >
            <FlaskConical className="h-3 w-3 mr-1" />
            {t('timeline_test_project')}
          </Button>
        </div>
      </div>

      {/* Compact timeline */}
      <ScrollArea className="w-full">
        <div style={{ width: `${daysToShow * dayWidth}px` }} className="min-h-[80px]">
          {/* Days header */}
          <div className="flex border-b text-[10px]">
            {timelineDays.map((day, index) => {
              const isToday = isSameDay(day, new Date());
              const isWeekendDay = isWeekend(day);
              return (
                <div
                  key={index}
                  className={`flex-shrink-0 text-center py-0.5 border-r ${
                    isToday ? 'bg-primary/10 font-bold' : isWeekendDay ? 'bg-muted/30' : ''
                  }`}
                  style={{ width: `${dayWidth}px` }}
                >
                  <div>{format(day, 'EEE', { locale: nl }).slice(0, 2)}</div>
                  <div className={isToday ? 'text-primary' : 'text-muted-foreground'}>
                    {format(day, 'dd')}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Project rows */}
          <div className="relative">
            {/* Today indicator */}
            {weekOffset <= 0 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary/50 z-10"
                style={{ left: `${(-weekOffset * 7) * dayWidth + dayWidth / 2}px` }}
              />
            )}

            {sortedProjects.map((project) => {
              const installPos = differenceInDays(project.installationDate, timelineStart);
              const completionPos = project.lastProductionStepEnd && isValid(project.lastProductionStepEnd)
                ? differenceInDays(project.lastProductionStepEnd, timelineStart)
                : null;

              const isInView = installPos >= 0 && installPos < daysToShow;
              if (!isInView) return null;

              return (
                <div key={project.projectId} className="h-6 relative flex items-center border-b border-muted/30">
                  {completionPos !== null && completionPos >= 0 && (
                    <>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`absolute w-2 h-2 rounded-full ${getStatusColor(project.status)} z-20`}
                              style={{ left: `${completionPos * dayWidth + dayWidth / 2 - 4}px` }}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <div>{t('timeline_production_ready')}: {format(project.lastProductionStepEnd!, 'dd/MM HH:mm')}</div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      <div
                        className={`absolute h-0.5 ${getStatusColor(project.status)}`}
                        style={{
                          left: `${Math.min(completionPos, installPos) * dayWidth + dayWidth / 2}px`,
                          width: `${Math.abs(installPos - completionPos) * dayWidth}px`
                        }}
                      />
                    </>
                  )}

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="absolute flex items-center gap-0.5 z-20 cursor-pointer"
                          style={{ left: `${installPos * dayWidth + dayWidth / 2 - 2}px` }}
                        >
                          <Flag className="h-3 w-3 text-primary" />
                          <span className="text-[9px] font-medium truncate max-w-16">
                            {project.projectName.slice(0, 8)}
                          </span>
                          {getStatusBadge(project.status)}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs max-w-60">
                        <div className="space-y-1">
                          <div className="font-bold">{project.projectName}</div>
                          <div>{t('timeline_client')}: {project.client}</div>
                          <div>{t('timeline_installation')}: {format(project.installationDate, 'dd/MM/yyyy')}</div>
                          {project.lastProductionStepEnd && (
                            <div>{t('timeline_production_ready')}: {format(project.lastProductionStepEnd, 'dd/MM HH:mm')}</div>
                          )}
                          <div className="flex items-center gap-1">
                            Status: {getStatusBadge(project.status)}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              );
            })}
          </div>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Test Rush Project Dialog */}
      <TestRushProjectDialog
        open={showTestDialog}
        onOpenChange={setShowTestDialog}
        currentCompletions={projectCompletions}
      />
    </div>
  );
};

export default ProductionCompletionTimeline;
