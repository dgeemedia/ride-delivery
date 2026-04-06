// admin-web/src/pages/Rides/LiveRides.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { Car, RefreshCw, AlertTriangle } from 'lucide-react';
import { ridesAPI } from '@/services/api/rides';
import { Ride } from '@/types';
import { Card, Button, Badge, Spinner } from '@/components/common';
import { formatDateTime } from '@/utils/helpers';
import { useSocket } from '@/hooks/useSocket';
import toast from 'react-hot-toast';

// FIX: removed 'version' property — not in APIOptions for this loader version
setOptions({
  key:       import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
  libraries: ['marker'],
} as any);

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

const LiveRides: React.FC = () => {
  const navigate = useNavigate();
  const { on }   = useSocket();

  const [rides,    setRides]    = useState<Ride[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [mapError, setMapError] = useState('');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<google.maps.Map | null>(null);
  const markersRef      = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());

  const load = async () => {
    setLoading(true);
    try {
      const res = await ridesAPI.getLiveRides();
      setRides(res.data.rides ?? []);
    } catch {
      toast.error('Failed to load live rides');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
          setMapError('VITE_GOOGLE_MAPS_API_KEY is not set in .env'); return;
        }
        const { Map } = await importLibrary('maps') as google.maps.MapsLibrary;
        if (cancelled || !mapContainerRef.current) return;

        mapRef.current = new Map(mapContainerRef.current, {
          center:           { lat: 6.5244, lng: 3.3792 },
          zoom:             12,
          mapId:            'diakite-live-rides',
          mapTypeControl:   false,
          streetViewControl: false,
        });
      } catch (err: any) {
        if (!cancelled) setMapError(err.message ?? 'Map failed to load');
      }
    })();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    (async () => {
      const { AdvancedMarkerElement } = await importLibrary('marker') as google.maps.MarkerLibrary;

      const activeIds = new Set(rides.map(r => r.id));
      markersRef.current.forEach((m, id) => {
        if (!activeIds.has(id)) { m.map = null; markersRef.current.delete(id); }
      });

      rides.forEach(ride => {
        const dp  = (ride.driver as any)?.driverProfile;
        const lat = dp?.currentLat;
        const lng = dp?.currentLng;
        if (!lat || !lng) return;

        if (markersRef.current.has(ride.id)) {
          markersRef.current.get(ride.id)!.position = { lat, lng };
        } else {
          const el = document.createElement('div');
          el.innerHTML = `<div style="background:#3B82F6;border:2px solid #fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.3);font-size:16px;cursor:pointer" title="${ride.driver?.firstName} ${ride.driver?.lastName}">🚗</div>`;
          el.addEventListener('click', () => navigate(`/rides/${ride.id}`));
          const marker = new AdvancedMarkerElement({ map: mapRef.current!, position: { lat, lng }, content: el, zIndex: 1 });
          markersRef.current.set(ride.id, marker);
        }
      });
    })();
  }, [rides]);

  useEffect(() => {
    return on('driver:location:update', async (data: { lat: number; lng: number; driverId?: string }) => {
      if (!data.driverId || !markersRef.current.has(data.driverId)) return;
      const marker = markersRef.current.get(data.driverId);
      if (marker) marker.position = { lat: data.lat, lng: data.lng };
    });
  }, [on]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
            Live Rides
          </h1>
          <p className="text-gray-500 text-sm mt-1">{rides.length} active ride{rides.length !== 1 ? 's' : ''}</p>
        </div>
        <Button variant="outline" onClick={load} loading={loading}>
          <RefreshCw className="h-4 w-4" />Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5" style={{ height: 'calc(100vh - 220px)' }}>
        <div className="lg:col-span-3">
          <Card padding={false} className="h-full">
            {mapError ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
                  <p className="text-sm">{mapError}</p>
                </div>
              </div>
            ) : (
              <div ref={mapContainerRef} className="w-full h-full rounded-xl" />
            )}
          </Card>
        </div>

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