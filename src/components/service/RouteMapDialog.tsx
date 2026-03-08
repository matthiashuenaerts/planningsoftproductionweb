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

export interface RouteWaypoint {
  name: string;
  client: string;
  address: string;
  lat: number;
  lng: number;
  order: number;
  serviceHours?: number;
  estimatedArrival?: string;   // HH:MM
  estimatedDeparture?: string; // HH:MM
}

interface RouteMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  waypoints: RouteWaypoint[];
  routeGeometry?: [number, number][]; // [lat, lng] pairs
  teamName: string;
  dateLabel: string;
  startPoint?: { lat: number; lng: number; address: string };
  totalDrivingMinutes?: number;
  unrecognizedAddresses?: string[];
  departureTime?: string;    // HH:MM
  workStartTime?: string;    // HH:MM
  workEndTime?: string;      // HH:MM
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
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const initedRef = useRef(false);

  const totalServiceHours = waypoints.reduce((sum, wp) => sum + (wp.serviceHours || 0), 0);
  const drivingHours = totalDrivingMinutes ? Math.round(totalDrivingMinutes) / 60 : 0;
  const totalHours = totalServiceHours + drivingHours;

  // Initialize map once when dialog opens
  useEffect(() => {
    if (!open) {
      // Cleanup when dialog closes
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      initedRef.current = false;
      return;
    }

    // Don't re-init if already done
    if (initedRef.current) return;

    const timer = setTimeout(() => {
      if (!mapContainerRef.current || initedRef.current) return;

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
      }).setView([50.85, 4.35], 9);
      mapRef.current = map;
      initedRef.current = true;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      const allPoints: L.LatLngExpression[] = [];

      // Add start/end point marker (green)
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

      // Add waypoint markers
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

      // Draw route polyline
      if (routeGeometry && routeGeometry.length > 0) {
        L.polyline(routeGeometry, {
          color: 'hsl(221.2, 83.2%, 53.3%)',
          weight: 4,
          opacity: 0.8,
        }).addTo(map);
      }

      // Fit bounds to show all points
      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, { padding: [40, 40] });
      }

      // Fix tile rendering after dialog animation
      setTimeout(() => map.invalidateSize(), 300);
      setTimeout(() => map.invalidateSize(), 600);
      setTimeout(() => map.invalidateSize(), 1000);
    }, 350);

    return () => {
      clearTimeout(timer);
    };
  }, [open]); // Only depend on open, not on data props

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Route — {teamName} — {dateLabel}
          </DialogTitle>
          <DialogDescription>
            Optimized driving route with return to start
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 flex-1 flex flex-col min-h-0">
          {/* Unrecognized addresses warning */}
          {unrecognizedAddresses && unrecognizedAddresses.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
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
          {/* Time summary */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {departureTime && (
              <Badge variant="default" className="gap-1 font-semibold">
                🚗 Depart: {departureTime}
              </Badge>
            )}
            {workStartTime && (
              <Badge variant="outline" className="gap-1">
                🏁 First stop: {workStartTime}
              </Badge>
            )}
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              Service: {totalServiceHours}h
            </Badge>
            {totalDrivingMinutes != null && (
              <Badge variant="outline" className="gap-1">
                <RouteIcon className="h-3 w-3" />
                Driving: {Math.round(totalDrivingMinutes)}min
              </Badge>
            )}
            {totalDrivingMinutes != null && (
              <Badge variant="secondary" className="gap-1 font-semibold">
                <Clock className="h-3 w-3" />
                Total: {totalHours.toFixed(1)}h
              </Badge>
            )}
            {workEndTime && (
              <Badge variant="outline" className="gap-1">
                🏠 End: {workEndTime}
              </Badge>
            )}
          </div>

          {/* Schedule timeline */}
          {waypoints.some(wp => wp.estimatedArrival) && (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1.5">
              <p className="font-medium text-xs text-muted-foreground uppercase tracking-wide mb-2">Route Schedule</p>
              {departureTime && startPoint && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-mono text-xs w-14">{departureTime}</span>
                  <div className="w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-bold shrink-0">S</div>
                  <span className="truncate">Depart from {startPoint.address}</span>
                </div>
              )}
              {waypoints.map((wp) => (
                <div key={wp.order} className="flex items-center gap-2">
                  <span className="font-mono text-xs w-14">{wp.estimatedArrival || '--:--'}</span>
                  <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold shrink-0">{wp.order}</div>
                  <span className="truncate flex-1">{wp.name} <span className="text-muted-foreground">({wp.client})</span></span>
                  {wp.serviceHours && <span className="text-xs text-muted-foreground shrink-0">{wp.serviceHours}h</span>}
                  {wp.estimatedDeparture && <span className="text-xs text-muted-foreground shrink-0">→ {wp.estimatedDeparture}</span>}
                </div>
              ))}
              {waypoints.length > 0 && waypoints[waypoints.length - 1].estimatedDeparture && startPoint && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-mono text-xs w-14">{waypoints[waypoints.length - 1].estimatedDeparture}</span>
                  <div className="w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-bold shrink-0">S</div>
                  <span className="truncate">Return drive to base</span>
                </div>
              )}
            </div>
          )}

          {/* Legend */}
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
          {/* Map container */}
          <div
            ref={mapContainerRef}
            className="w-full rounded-lg border border-border flex-1 min-h-0"
            style={{ zIndex: 0, position: 'relative' }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RouteMapDialog;
