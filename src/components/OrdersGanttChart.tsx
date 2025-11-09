import React, { useState, useEffect, useMemo } from 'react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, differenceInDays, getWeek, isSameDay } from 'date-fns';
import { nl } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, Menu, Share2, Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PlacementTeam {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
}

interface Order {
  id: string;
  external_order_number: string;
  expected_delivery: string;
  order_date: string;
  status: string;
  project_id: string;
  project?: {
    name: string;
    client: string;
    installation_date: string;
    project_team_assignments?: Array<{
      team: string;
      start_date: string;
      duration: number;
    }>;
  };
}

interface OrdersGanttChartProps {
  className?: string;
}

const OrdersGanttChart: React.FC<OrdersGanttChartProps> = ({ className }) => {
  const [teams, setTeams] = useState<PlacementTeam[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [weeksToShow, setWeeksToShow] = useState(4);
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [draggedOrder, setDraggedOrder] = useState<{ order: Order; teamId: string } | null>(null);

  // Fetch teams and orders
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch placement teams
        const { data: teamsData, error: teamsError } = await supabase
          .from('placement_teams')
          .select('id, name, color, is_active')
          .eq('is_active', true)
          .order('name');

        if (teamsError) throw teamsError;

        // Fetch orders with project and team assignment data
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select(`
            id,
            external_order_number,
            expected_delivery,
            order_date,
            status,
            project_id,
            projects:project_id (
              name,
              client,
              installation_date,
              project_team_assignments (
                team,
                start_date,
                duration
              )
            )
          `)
          .order('expected_delivery');

        if (ordersError) throw ordersError;

        setTeams(teamsData || []);
        setOrders(ordersData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Get date range for the timeline
  const dateRange = useMemo(() => {
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(addDays(weekStart, (weeksToShow * 7) - 1), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [currentWeek, weeksToShow]);

  // Group dates by week
  const weekGroups = useMemo(() => {
    const groups: { weekNumber: number; days: Date[] }[] = [];
    let currentWeekNum = -1;
    let currentGroup: Date[] = [];

    dateRange.forEach((date) => {
      const weekNum = getWeek(date, { weekStartsOn: 1, locale: nl });
      if (weekNum !== currentWeekNum) {
        if (currentGroup.length > 0) {
          groups.push({ weekNumber: currentWeekNum, days: currentGroup });
        }
        currentWeekNum = weekNum;
        currentGroup = [date];
      } else {
        currentGroup.push(date);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ weekNumber: currentWeekNum, days: currentGroup });
    }

    return groups;
  }, [dateRange]);

  // Group orders by team
  const ordersByTeam = useMemo(() => {
    const grouped: Record<string, Order[]> = {};
    
    teams.forEach((team) => {
      grouped[team.id] = [];
    });

    orders.forEach((order) => {
      // Get the first team assignment if available
      const teamAssignments = order.project?.project_team_assignments;
      if (teamAssignments && teamAssignments.length > 0) {
        const projectTeam = teamAssignments[0].team;
        
        // Find matching team
        const matchedTeam = teams.find((team) => {
          const teamNameLower = team.name.toLowerCase();
          const projectTeamLower = projectTeam.toLowerCase();
          return (
            projectTeamLower === teamNameLower ||
            projectTeamLower.includes(teamNameLower) ||
            teamNameLower.includes(projectTeamLower)
          );
        });

        if (matchedTeam) {
          grouped[matchedTeam.id].push(order);
        }
      }
    });

    return grouped;
  }, [orders, teams]);

  // Calculate order bar position
  const getOrderPosition = (order: Order) => {
    const teamAssignments = order.project?.project_team_assignments;
    const assignment = teamAssignments && teamAssignments.length > 0 ? teamAssignments[0] : null;
    
    const startDate = new Date(assignment?.start_date || order.expected_delivery);
    const duration = assignment?.duration || 1;
    const endDate = addDays(startDate, duration - 1);

    const firstDay = dateRange[0];
    const startDayIndex = differenceInDays(startDate, firstDay);
    const endDayIndex = differenceInDays(endDate, firstDay);

    if (endDayIndex < 0 || startDayIndex >= dateRange.length) {
      return null; // Order is outside visible range
    }

    const left = Math.max(0, (startDayIndex / dateRange.length) * 100);
    const width = Math.min(
      ((endDayIndex - Math.max(0, startDayIndex) + 1) / dateRange.length) * 100,
      100 - left
    );

    return { left: `${left}%`, width: `${width}%` };
  };

  // Toggle team collapse
  const toggleTeam = (teamId: string) => {
    setCollapsedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  // Drag handlers
  const handleDragStart = (order: Order, teamId: string) => {
    setDraggedOrder({ order, teamId });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetTeamId: string, targetDate: Date) => {
    if (!draggedOrder) return;

    const { order } = draggedOrder;
    const teamAssignments = order.project?.project_team_assignments;
    const assignment = teamAssignments && teamAssignments.length > 0 ? teamAssignments[0] : null;

    if (!assignment) {
      toast.error('No team assignment found for this order');
      setDraggedOrder(null);
      return;
    }

    // Find the target team name
    const targetTeam = teams.find(t => t.id === targetTeamId);
    if (!targetTeam) {
      toast.error('Target team not found');
      setDraggedOrder(null);
      return;
    }

    try {
      // Update the project team assignment in the database
      const { error } = await supabase
        .from('project_team_assignments')
        .update({
          team: targetTeam.name,
          start_date: format(targetDate, 'yyyy-MM-dd'),
        })
        .eq('project_id', order.project_id);

      if (error) throw error;

      toast.success('Project moved successfully');
      
      // Refresh data
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          external_order_number,
          expected_delivery,
          order_date,
          status,
          project_id,
          projects:project_id (
            name,
            client,
            installation_date,
            project_team_assignments (
              team,
              start_date,
              duration
            )
          )
        `)
        .order('expected_delivery');

      if (!ordersError && ordersData) {
        setOrders(ordersData);
      }
    } catch (error) {
      console.error('Error updating project assignment:', error);
      toast.error('Failed to move project');
    }

    setDraggedOrder(null);
  };

  // Navigation
  const goToPreviousWeek = () => setCurrentWeek(addDays(currentWeek, -7));
  const goToNextWeek = () => setCurrentWeek(addDays(currentWeek, 7));
  const goToToday = () => setCurrentWeek(new Date());

  // Get column width percentage
  const dayWidth = 100 / dateRange.length;

  // Find today's position for the indicator
  const todayPosition = useMemo(() => {
    const today = new Date();
    const todayIndex = dateRange.findIndex((date) => isSameDay(date, today));
    if (todayIndex === -1) return null;
    return (todayIndex / dateRange.length) * 100;
  }, [dateRange]);

  if (loading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>;
  }

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={goToPreviousWeek}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="text-2xl font-semibold min-w-[250px] text-center">
              {format(dateRange[0], 'd', { locale: nl })} - {format(dateRange[dateRange.length - 1], 'd MMM yyyy', { locale: nl })}
            </div>
            <Button variant="ghost" size="icon" onClick={goToNextWeek}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Button variant="link" size="sm" className="text-primary" onClick={goToToday}>
              <Calendar className="h-4 w-4 mr-1" />
              Vandaag
            </Button>
            <Button variant="link" size="sm" onClick={() => window.location.reload()}>
              verversen
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            Bron
          </Button>
          <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Bookmark className="h-4 w-4 mr-1" />
            Bladwijzer/Delen
          </Button>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Zoom control */}
      <div className="px-4 py-2 border-b flex items-center justify-end gap-2">
        <span className="text-sm text-muted-foreground">{weeksToShow} dagen</span>
        <input
          type="range"
          min="1"
          max="8"
          value={weeksToShow}
          onChange={(e) => setWeeksToShow(Number(e.target.value))}
          className="w-32"
        />
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-auto">
        <div className="relative min-w-[1200px]">
          {/* Timeline Header */}
          <div className="sticky top-0 z-10 bg-background border-b">
            {/* Week headers */}
            <div className="flex border-b bg-slate-800">
              <div className="w-64 flex-shrink-0" /> {/* Spacer for team names */}
              {weekGroups.map((week) => (
                <div
                  key={week.weekNumber}
                  className="flex-shrink-0 px-2 py-2 text-xs font-semibold text-white border-r border-slate-700"
                  style={{ width: `${(week.days.length / dateRange.length) * 100}%` }}
                >
                  Week {week.weekNumber}
                </div>
              ))}
            </div>

            {/* Day headers */}
            <div className="flex bg-cyan-800">
              <div className="w-64 flex-shrink-0" /> {/* Spacer for team names */}
              {dateRange.map((date, idx) => {
                const isWeekStart = date.getDay() === 1;
                return (
                  <div
                    key={idx}
                    className={cn(
                      'flex-shrink-0 text-center border-r border-cyan-700',
                      isWeekStart && 'border-l-2 border-l-cyan-600'
                    )}
                    style={{ width: `${dayWidth}%` }}
                  >
                    <div className="text-xs font-medium text-white py-1">
                      {format(date, 'd-MM', { locale: nl })}
                    </div>
                    <div className="text-xs py-1 text-white">
                      {format(date, 'EEEEEE', { locale: nl })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Team rows */}
          <div className="relative">
            {/* Today indicator */}
            {todayPosition !== null && (
              <>
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-red-600 z-10 pointer-events-none"
                  style={{ left: `calc(16rem + ${todayPosition}%)` }}
                />
                <div
                  className="absolute top-0 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-b whitespace-nowrap z-20"
                  style={{ left: `calc(16rem + ${todayPosition}% - 20px)` }}
                >
                  Vandaag
                </div>
              </>
            )}

            {teams.map((team) => {
              const teamOrders = ordersByTeam[team.id] || [];
              const isCollapsed = collapsedTeams.has(team.id);

              return (
                <div key={team.id} className="border-b">
                  {/* Team header */}
                  <div
                    className="flex items-center cursor-pointer hover:bg-muted/30 sticky left-0 z-10 bg-background border-t"
                    onClick={() => toggleTeam(team.id)}
                  >
                    <div className="w-64 flex-shrink-0 px-4 py-2 font-medium flex items-center gap-2 border-r bg-muted/20">
                      <ChevronRight
                        className={cn(
                          'h-4 w-4 transition-transform',
                          !isCollapsed && 'rotate-90'
                        )}
                      />
                      <span className="text-sm font-normal">{team.name}</span>
                    </div>
                    <div className="flex-1" />
                  </div>

                  {/* Team orders */}
                  {!isCollapsed && (
                    <div 
                      className="relative" 
                      style={{ minHeight: `${Math.max(teamOrders.length * 32 + 16, 80)}px` }}
                      onDragOver={handleDragOver}
                    >
                      <div className="flex absolute inset-0">
                        <div className="w-64 flex-shrink-0 border-r bg-amber-50/30" />
                        {/* Day columns */}
                        {dateRange.map((date, idx) => {
                          const isWeekStart = date.getDay() === 1;
                          return (
                            <div
                              key={idx}
                              className={cn(
                                'flex-shrink-0 border-r border-gray-200',
                                idx % 2 === 0 ? 'bg-amber-50/30' : 'bg-white',
                                isWeekStart && 'border-l-2 border-l-gray-300'
                              )}
                              style={{ width: `${dayWidth}%` }}
                              onDrop={(e) => {
                                e.preventDefault();
                                handleDrop(team.id, date);
                              }}
                            />
                          );
                        })}
                      </div>

                      {/* Order bars */}
                      <div className="relative z-10 pl-64 py-2">
                        {teamOrders.map((order, idx) => {
                          const position = getOrderPosition(order);
                          if (!position) return null;

                          const orderLabel = `order ${order.external_order_number} : ${order.project?.client || 'Unknown'} - ${order.project?.name?.split('_')[2] || 'Unknown'}`;

                          return (
                            <div
                              key={order.id}
                              draggable
                              onDragStart={() => handleDragStart(order, team.id)}
                              className="absolute h-6 bg-red-600 text-white text-xs px-2 flex items-center overflow-hidden whitespace-nowrap hover:z-20 hover:shadow-lg transition-shadow cursor-move rounded-sm"
                              style={{
                                left: position.left,
                                width: position.width,
                                top: `${8 + idx * 28}px`,
                              }}
                              title={orderLabel}
                            >
                              <span className="font-medium">{orderLabel}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrdersGanttChart;
