import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
// leaflet CSS is imported globally in index.css
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Clock, Route as RouteIcon, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

export interface RouteWaypoint {
  name: string;
  client: string;
  address: string;
  lat: number;
  lng: number;
  order: number;
  serviceHours?: number;
  estimatedArrival?: string;
  estimatedDeparture?: string;
}

interface RouteMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  waypoints: RouteWaypoint[];
  routeGeometry?: [number, number][];
  teamName: string;
  dateLabel: string;
  startPoint?: { lat: number; lng: number; address: string };
  totalDrivingMinutes?: number;
  unrecognizedAddresses?: string[];
  departureTime?: string;
  workStartTime?: string;
  workEndTime?: string;
  returnTime?: string;
}

const RouteMapDialog: React.FC<RouteMapDialogProps> = ({
  open,
  onOpenChange,
  waypoints,
  routeGeometry,
  teamName,
  dateLabel,
  startPoint,
  totalDrivingMinutes,
  unrecognizedAddresses,
  departureTime,
  workStartTime,
  workEndTime,
  returnTime,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const initedRef = useRef(false);
  const isMobile = useIsMobile();

  const totalServiceHours = waypoints.reduce((sum, wp) => sum + (wp.serviceHours || 0), 0);
  const drivingHours = totalDrivingMinutes ? Math.round(totalDrivingMinutes) / 60 : 0;
  const totalHours = totalServiceHours + drivingHours;

  useEffect(() => {
    if (!open) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      initedRef.current = false;
      return;
    }

    if (initedRef.current) return;

    const timer = setTimeout(() => {
      if (!mapContainerRef.current || initedRef.current) return;

      const map = L.map(mapContainerRef.current, { zoomControl: true }).setView([50.85, 4.35], 9);
      mapRef.current = map;
      initedRef.current = true;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      const allPoints: L.LatLngExpression[] = [];

      if (startPoint) {
        const startIcon = L.divIcon({
          html: `<div style="background:#22c55e;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">S</div>`,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        L.marker([startPoint.lat, startPoint.lng], { icon: startIcon })
          .addTo(map)
          .bindPopup(`<strong>Start / Return</strong><br/>${startPoint.address}`);
        allPoints.push([startPoint.lat, startPoint.lng]);
      }

      waypoints.forEach((wp) => {
        const markerIcon = L.divIcon({
          html: `<div style="background:hsl(221.2 83.2% 53.3%);color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${wp.order}</div>`,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        L.marker([wp.lat, wp.lng], { icon: markerIcon })
          .addTo(map)
          .bindPopup(
            `<strong>#${wp.order} — ${wp.name}</strong><br/>${wp.client}<br/>${wp.address}${wp.serviceHours ? `<br/><em>${wp.serviceHours}h service</em>` : ''}${wp.estimatedArrival ? `<br/>🕐 Arrive: ${wp.estimatedArrival}` : ''}${wp.estimatedDeparture ? ` — Leave: ${wp.estimatedDeparture}` : ''}`
          );
        allPoints.push([wp.lat, wp.lng]);
      });

      if (routeGeometry && routeGeometry.length > 0) {
        L.polyline(routeGeometry, {
          color: 'hsl(221.2, 83.2%, 53.3%)',
          weight: 4,
          opacity: 0.8,
        }).addTo(map);
      }

      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, { padding: [40, 40] });
      }

      setTimeout(() => map.invalidateSize(), 300);
      setTimeout(() => map.invalidateSize(), 600);
      setTimeout(() => map.invalidateSize(), 1000);
    }, 350);

    return () => { clearTimeout(timer); };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "flex flex-col",
        isMobile ? "max-w-[98vw] h-[95vh] p-3" : "sm:max-w-4xl h-[85vh]"
      )}>
        <DialogHeader className={isMobile ? "pb-1" : ""}>
          <DialogTitle className={isMobile ? "text-sm leading-tight" : ""}>
            Route — {teamName} — {dateLabel}
          </DialogTitle>
          <DialogDescription className={isMobile ? "text-xs" : ""}>
            Optimized driving route with return to start
          </DialogDescription>
        </DialogHeader>
        <div className={cn("flex-1 flex flex-col min-h-0", isMobile ? "space-y-2" : "space-y-3")}>
          {/* Unrecognized addresses warning */}
          {unrecognizedAddresses && unrecognizedAddresses.length > 0 && (
            <div className={cn("flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 text-sm", isMobile ? "p-2 text-xs" : "p-3")}>
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Unrecognized addresses:</p>
                <ul className="mt-1 list-disc list-inside text-muted-foreground">
                  {unrecognizedAddresses.map((addr, i) => (
                    <li key={i}>{addr}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Time summary badges */}
          <div className={cn("flex flex-wrap items-center", isMobile ? "gap-1.5 text-xs" : "gap-3 text-sm")}>
            {departureTime && (
              <Badge variant="default" className={cn("gap-1 font-semibold", isMobile && "text-[10px] px-1.5 py-0")}>
                🚗 {departureTime}
              </Badge>
            )}
            {workStartTime && (
              <Badge variant="outline" className={cn("gap-1", isMobile && "text-[10px] px-1.5 py-0")}>
                🏁 {workStartTime}
              </Badge>
            )}
            <Badge variant="outline" className={cn("gap-1", isMobile && "text-[10px] px-1.5 py-0")}>
              <Clock className="h-3 w-3" />
              {totalServiceHours}h
            </Badge>
            {totalDrivingMinutes != null && (
              <Badge variant="outline" className={cn("gap-1", isMobile && "text-[10px] px-1.5 py-0")}>
                <RouteIcon className="h-3 w-3" />
                {Math.round(totalDrivingMinutes)}min
              </Badge>
            )}
            {totalDrivingMinutes != null && (
              <Badge variant="secondary" className={cn("gap-1 font-semibold", isMobile && "text-[10px] px-1.5 py-0")}>
                <Clock className="h-3 w-3" />
                {totalHours.toFixed(1)}h
              </Badge>
            )}
            {returnTime && (
              <Badge variant="outline" className={cn("gap-1", isMobile && "text-[10px] px-1.5 py-0")}>
                🏠 {returnTime}
              </Badge>
            )}
            {workEndTime && (
              <Badge variant={returnTime && returnTime > workEndTime ? "destructive" : "outline"} className={cn("gap-1", isMobile && "text-[10px] px-1.5 py-0")}>
                ⏰ {workEndTime}
              </Badge>
            )}
          </div>

          {/* Schedule timeline */}
          {waypoints.some(wp => wp.estimatedArrival) && (
            <div className={cn("rounded-md border border-border bg-muted/30 space-y-1", isMobile ? "p-2 text-xs" : "p-3 text-sm")}>
              <p className={cn("font-medium text-muted-foreground uppercase tracking-wide mb-1.5", isMobile ? "text-[10px]" : "text-xs")}>Route Schedule</p>
              {departureTime && startPoint && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className={cn("font-mono", isMobile ? "text-[10px] w-10" : "text-xs w-14")}>{departureTime}</span>
                  <div className="w-4 h-4 rounded-full bg-green-500 text-white text-[10px] flex items-center justify-center font-bold shrink-0">S</div>
                  <span className="truncate">{isMobile ? 'Depart' : `Depart from ${startPoint.address}`}</span>
                </div>
              )}
              {waypoints.map((wp) => (
                <div key={wp.order} className="flex items-center gap-1.5">
                  <span className={cn("font-mono", isMobile ? "text-[10px] w-10" : "text-xs w-14")}>{wp.estimatedArrival || '--:--'}</span>
                  <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold shrink-0">{wp.order}</div>
                  <span className="truncate flex-1 min-w-0">{isMobile ? wp.name.substring(0, 30) : wp.name} <span className="text-muted-foreground">({wp.client})</span></span>
                  {wp.serviceHours && <span className="text-[10px] text-muted-foreground shrink-0">{wp.serviceHours}h</span>}
                  {wp.estimatedDeparture && <span className="text-[10px] text-muted-foreground shrink-0">→ {wp.estimatedDeparture}</span>}
                </div>
              ))}
              {waypoints.length > 0 && waypoints[waypoints.length - 1].estimatedDeparture && startPoint && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className={cn("font-mono", isMobile ? "text-[10px] w-10" : "text-xs w-14")}>{waypoints[waypoints.length - 1].estimatedDeparture}</span>
                  <div className="w-4 h-4 rounded-full bg-green-500 text-white text-[10px] flex items-center justify-center font-bold shrink-0">S</div>
                  <span className="truncate">Return to base</span>
                </div>
              )}
            </div>
          )}

          {/* Legend — hidden on mobile to save space */}
          {!isMobile && (
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-bold">S</div>
                <span>Start / Return</span>
              </div>
              {waypoints.map((wp) => (
                <div key={wp.order} className="flex items-center gap-1">
                  <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">{wp.order}</div>
                  <span className="truncate max-w-[120px]">{wp.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Map container */}
          <div
            ref={mapContainerRef}
            className={cn("w-full rounded-lg border border-border flex-1 min-h-0", isMobile && "min-h-[200px]")}
            style={{ zIndex: 0, position: 'relative' }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RouteMapDialog;
