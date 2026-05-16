// admin-web/src/pages/Rides/LiveRides.tsx
// Map: Leaflet + OpenStreetMap (free, no API key).
// All other logic — socket, auto-refresh, ride cards — unchanged.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { Car, RefreshCw } from 'lucide-react';
import { ridesAPI }       from '@/services/api/rides';
import { Ride }           from '@/types';
import { Card, Button, Badge, Spinner } from '@/components/common';
import { formatDateTime } from '@/utils/helpers';
import { useSocket }      from '@/hooks/useSocket';
import toast              from 'react-hot-toast';

// ── Leaflet default-icon fix for Vite ────────────────────────────────────────
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon   from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

// ─────────────────────────────────────────────────────────────────────────────
// Ride side-card — unchanged
// ─────────────────────────────────────────────────────────────────────────────
const RideCard: React.FC<{ ride: Ride; onClick: () => void }> = ({ ride, onClick }) => {
  const dp = (ride.driver as any)?.driverProfile;
  return (
    <div
      onClick={onClick}
      className="p-3 border border-gray-100 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors space-y-2"
    >
      <div className="flex items-center justify-between">
        <Badge variant={ride.status === 'IN_PROGRESS' ? 'info' : 'warning'}>
          {ride.status.replace('_', ' ')}
        </Badge>
        <span className="text-xs text-gray-400">{formatDateTime(ride.requestedAt)}</span>
      </div>
      <div className="text-xs space-y-0.5">
        <div className="flex gap-1"><span className="text-green-500 font-bold">↑</span><span className="truncate">{ride.pickupAddress}</span></div>
        <div className="flex gap-1"><span className="text-red-500 font-bold">↓</span><span className="truncate">{ride.dropoffAddress}</span></div>
      </div>
      {ride.driver && (
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <Car className="h-3 w-3 text-gray-400" />
          {ride.driver.firstName} {ride.driver.lastName}
          {dp && <span className="text-gray-400">• {dp.vehiclePlate}</span>}
        </div>
      )}
      <div className="text-xs font-medium text-gray-700">
        ₦{ride.estimatedFare.toLocaleString('en-NG')}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Driver marker icon (blue 🚗)
// ─────────────────────────────────────────────────────────────────────────────
function makeDriverIcon(driverName: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div title="${driverName}" style="background:#3B82F6;border:2px solid #fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.3);font-size:16px;cursor:pointer">🚗</div>`,
    iconSize: [32, 32], iconAnchor: [16, 16],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
const LiveRides: React.FC = () => {
  const navigate = useNavigate();
  const { on }   = useSocket();

  const [rides,   setRides]   = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<L.Map | null>(null);
  const markersRef      = useRef<Map<string, L.Marker>>(new Map());

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ridesAPI.getLiveRides();
      setRides(res.data.rides ?? []);
    } catch {
      toast.error('Failed to load live rides');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30 s
  useEffect(() => {
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  // ── Init Leaflet map (once) ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      center: [6.5244, 3.3792],  // Lagos
      zoom:   12,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Sync markers whenever rides change ────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove stale markers
    const activeIds = new Set(rides.map(r => r.id));
    markersRef.current.forEach((marker, id) => {
      if (!activeIds.has(id)) { marker.remove(); markersRef.current.delete(id); }
    });

    // Add / update markers
    rides.forEach(ride => {
      const dp  = (ride.driver as any)?.driverProfile;
      const lat = dp?.currentLat;
      const lng = dp?.currentLng;
      if (!lat || !lng) return;

      const driverName = `${ride.driver?.firstName ?? ''} ${ride.driver?.lastName ?? ''}`.trim();

      if (markersRef.current.has(ride.id)) {
        markersRef.current.get(ride.id)!.setLatLng([lat, lng]);
      } else {
        const marker = L.marker([lat, lng], { icon: makeDriverIcon(driverName) })
          .addTo(map)
          .bindPopup(`
            <div style="min-width:160px">
              <p style="font-weight:700;margin-bottom:4px">${driverName || 'Driver'}</p>
              <p style="font-size:12px;color:#6b7280;margin-bottom:2px">↑ ${ride.pickupAddress}</p>
              <p style="font-size:12px;color:#6b7280;margin-bottom:6px">↓ ${ride.dropoffAddress}</p>
              <button
                onclick="window.__navigateToRide('${ride.id}')"
                style="font-size:11px;color:#3B82F6;background:none;border:none;cursor:pointer;padding:0"
              >View details →</button>
            </div>
          `);
        markersRef.current.set(ride.id, marker);
      }
    });
  }, [rides]);

  // Global navigate helper for marker popup buttons
  useEffect(() => {
    (window as any).__navigateToRide = (id: string) => navigate(`/rides/${id}`);
    return () => { delete (window as any).__navigateToRide; };
  }, [navigate]);

  // ── Real-time driver location updates ─────────────────────────────────────
  useEffect(() => {
    return on('driver:location:update', (data: { lat: number; lng: number; driverId?: string }) => {
      if (!data.driverId) return;
      const marker = markersRef.current.get(data.driverId);
      if (marker) marker.setLatLng([data.lat, data.lng]);
    });
  }, [on]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
            Live Rides
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {rides.length} active ride{rides.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="outline" onClick={load} loading={loading}>
          <RefreshCw className="h-4 w-4" />Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5" style={{ height: 'calc(100vh - 220px)' }}>
        {/* Map */}
        <div className="lg:col-span-3">
          <Card padding={false} className="h-full">
            <div ref={mapContainerRef} className="w-full h-full rounded-xl" />
          </Card>
        </div>

        {/* Side cards */}
        <div className="overflow-y-auto space-y-3 pr-1">
          {loading && rides.length === 0 ? (
            <div className="flex justify-center py-8"><Spinner size="md" /></div>
          ) : rides.length === 0 ? (
            <Card>
              <div className="py-8 text-center text-gray-400">
                <Car className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">No active rides</p>
              </div>
            </Card>
          ) : rides.map(ride => (
            <RideCard key={ride.id} ride={ride} onClick={() => navigate(`/rides/${ride.id}`)} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default LiveRides;