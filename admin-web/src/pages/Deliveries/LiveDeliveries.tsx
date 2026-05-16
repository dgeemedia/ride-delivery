// admin-web/src/pages/Deliveries/LiveDeliveries.tsx
// Uses Leaflet + OpenStreetMap — completely free, no API key needed.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate }    from 'react-router-dom';
import L                  from 'leaflet';
import { Package, RefreshCw } from 'lucide-react';
import { deliveriesAPI }  from '@/services/api/deliveries';
import { Delivery }       from '@/types';
import { Card, Button, Badge, Spinner } from '@/components/common';
import { formatDateTime } from '@/utils/helpers';
import { useSocket }      from '@/hooks/useSocket';
import toast              from 'react-hot-toast';

import markerIcon2x   from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon     from 'leaflet/dist/images/marker-icon.png';
import markerShadow   from 'leaflet/dist/images/marker-shadow.png';

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:       markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl:     markerShadow,
});

const STATUS_VARIANT: Record<string, 'info' | 'warning' | 'success'> = {
  PICKED_UP:  'info',
  IN_TRANSIT: 'info',
  ACCEPTED:   'warning',
  ARRIVED:    'warning',
};

const DeliveryCard: React.FC<{ delivery: Delivery; onClick: () => void }> = ({ delivery, onClick }) => {
  const pp = (delivery.partner as any)?.partnerProfile ?? (delivery as any).partnerProfile;

  return (
    <div
      onClick={onClick}
      className="p-3 border border-gray-100 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors space-y-2"
    >
      <div className="flex items-center justify-between">
        <Badge variant={STATUS_VARIANT[delivery.status] ?? 'warning'}>
          {delivery.status.replace(/_/g, ' ')}
        </Badge>
        <span className="text-xs text-gray-400">
          {formatDateTime((delivery as any).requestedAt ?? (delivery as any).createdAt)}
        </span>
      </div>

      <div className="text-xs space-y-0.5">
        <div className="flex gap-1">
          <span className="text-green-500 font-bold">↑</span>
          <span className="truncate">{delivery.pickupAddress}</span>
        </div>
        <div className="flex gap-1">
          <span className="text-red-500 font-bold">↓</span>
          <span className="truncate">{delivery.dropoffAddress}</span>
        </div>
      </div>

      {delivery.partner && (
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <Package className="h-3 w-3 text-gray-400" />
          {(delivery.partner as any).firstName} {(delivery.partner as any).lastName}
          {pp?.vehiclePlate && (
            <span className="text-gray-400">• {pp.vehiclePlate}</span>
          )}
        </div>
      )}

      <div className="text-xs font-medium text-gray-700">
        ₦{Number((delivery as any).estimatedFee ?? (delivery as any).actualFee ?? 0).toLocaleString('en-NG')}
      </div>
    </div>
  );
};

function makeCourierIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:#10B981;
      border:2px solid #fff;
      border-radius:50%;
      width:32px;height:32px;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 8px rgba(0,0,0,.3);
      font-size:16px;cursor:pointer;
    ">📦</div>`,
    iconSize:   [32, 32],
    iconAnchor: [16, 16],
  });
}

const LiveDeliveries: React.FC = () => {
  const navigate = useNavigate();
  const { on }   = useSocket();

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading,    setLoading]    = useState(true);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<L.Map | null>(null);
  const markersRef      = useRef<Map<string, L.Marker>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await deliveriesAPI.getLiveDeliveries();
      setDeliveries(res.data.deliveries ?? []);
    } catch {
      toast.error('Failed to load live deliveries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      center:             [6.5244, 3.3792],
      zoom:               12,
      zoomControl:        true,
      attributionControl: true,
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const activeIds = new Set(deliveries.map(d => d.id));
    markersRef.current.forEach((marker, id) => {
      if (!activeIds.has(id)) { marker.remove(); markersRef.current.delete(id); }
    });

    deliveries.forEach(delivery => {
      const pp  = (delivery.partner as any)?.partnerProfile ?? (delivery as any).partnerProfile;
      const lat = pp?.currentLat  ?? (delivery as any).currentLat;
      const lng = pp?.currentLng  ?? (delivery as any).currentLng;
      if (!lat || !lng) return;

      const partnerName = `${(delivery.partner as any)?.firstName ?? ''} ${(delivery.partner as any)?.lastName ?? ''}`.trim();

      if (markersRef.current.has(delivery.id)) {
        markersRef.current.get(delivery.id)!.setLatLng([lat, lng]);
      } else {
        const marker = L.marker([lat, lng], { icon: makeCourierIcon() })
          .addTo(map)
          .bindPopup(`
            <div style="min-width:180px">
              <p style="font-weight:700;margin-bottom:4px">${partnerName || 'Courier'}</p>
              <p style="font-size:12px;color:#6b7280;margin-bottom:2px">↑ ${delivery.pickupAddress}</p>
              <p style="font-size:12px;color:#6b7280">↓ ${delivery.dropoffAddress}</p>
              <button
                onclick="window.__navigateToDelivery('${delivery.id}')"
                style="margin-top:8px;font-size:11px;color:#3B82F6;background:none;border:none;cursor:pointer;padding:0"
              >View details →</button>
            </div>
          `);
        markersRef.current.set(delivery.id, marker);
      }
    });
  }, [deliveries]);

  useEffect(() => {
    (window as any).__navigateToDelivery = (id: string) => navigate(`/deliveries/${id}`);
    return () => { delete (window as any).__navigateToDelivery; };
  }, [navigate]);

  useEffect(() => {
    return on('partner:location:update' as any, (data: { lat: number; lng: number; partnerId?: string; deliveryId?: string }) => {
      const id = data.deliveryId ?? data.partnerId;
      if (!id) return;
      const marker = markersRef.current.get(id);
      if (marker) marker.setLatLng([data.lat, data.lng]);
    });
  }, [on]);

  // Cast string literals to satisfy SocketEvent union type
  useEffect(() => {
    const events = ['delivery:status_updated', 'delivery:in_transit', 'delivery:completed'] as any[];
    const unsubs = events.map(ev => on(ev, load));
    return () => unsubs.forEach(u => u());
  }, [on, load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
            Live Deliveries
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {deliveries.length} active deliver{deliveries.length !== 1 ? 'ies' : 'y'}
          </p>
        </div>
        <Button variant="outline" onClick={load} loading={loading}>
          <RefreshCw className="h-4 w-4" />Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5" style={{ height: 'calc(100vh - 220px)' }}>
        <div className="lg:col-span-3">
          <Card padding={false} className="h-full">
            <div ref={mapContainerRef} className="w-full h-full rounded-xl" />
          </Card>
        </div>

        <div className="overflow-y-auto space-y-3 pr-1">
          {loading && deliveries.length === 0 ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" />
            </div>
          ) : deliveries.length === 0 ? (
            <Card>
              <div className="py-8 text-center text-gray-400">
                <Package className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">No active deliveries</p>
              </div>
            </Card>
          ) : (
            deliveries.map(delivery => (
              <DeliveryCard
                key={delivery.id}
                delivery={delivery}
                onClick={() => navigate(`/deliveries/${delivery.id}`)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveDeliveries;