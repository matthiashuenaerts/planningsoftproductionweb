import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface RouteWaypoint {
  name: string;
  client: string;
  address: string;
  lat: number;
  lng: number;
  order: number;
  serviceHours?: number;
}

interface RouteMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  waypoints: RouteWaypoint[];
  routeGeometry?: [number, number][]; // [lat, lng] pairs
  teamName: string;
  dateLabel: string;
  startPoint?: { lat: number; lng: number; address: string };
}

const RouteMapDialog: React.FC<RouteMapDialogProps> = ({
  open,
  onOpenChange,
  waypoints,
  routeGeometry,
  teamName,
  dateLabel,
  startPoint,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!open || !mapContainerRef.current) return;

    // Small delay to ensure dialog DOM is ready
    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      // Clean up previous map
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(mapContainerRef.current).setView([50.85, 4.35], 9);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      const allPoints: L.LatLngExpression[] = [];

      // Add start point marker
      if (startPoint) {
        const startIcon = L.divIcon({
          html: `<div style="background:#22c55e;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">S</div>`,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        L.marker([startPoint.lat, startPoint.lng], { icon: startIcon })
          .addTo(map)
          .bindPopup(`<strong>Start</strong><br/>${startPoint.address}`);
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
            `<strong>#${wp.order} — ${wp.name}</strong><br/>${wp.client}<br/>${wp.address}${wp.serviceHours ? `<br/><em>${wp.serviceHours}h service</em>` : ''}`
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
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [open, waypoints, routeGeometry, startPoint]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            Route — {teamName} — {dateLabel}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Legend */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center font-bold">S</div>
              <span>Start</span>
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
            className="w-full rounded-lg border border-border"
            style={{ height: '500px' }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RouteMapDialog;
