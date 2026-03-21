// admin-web/src/pages/Deliveries/DeliveryDetails.tsx
//
// Google Maps uses the v2 functional API:
//   import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
// No `new Loader()` — that class was removed in v2.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import {
  ArrowLeft, Package, User, Phone, Mail, MapPin, Clock,
  CheckCircle, XCircle, DollarSign, Star, Truck, AlertTriangle,
  Download, FileText,
} from 'lucide-react';
import { deliveriesAPI } from '@/services/api/deliveries';
import { Delivery } from '@/types';
import { Card, Button, Badge, Modal, Alert, Spinner } from '@/components/common';
import { formatDateTime } from '@/utils/helpers';
import { useSocket } from '@/hooks/useSocket';
import toast from 'react-hot-toast';

// ─── Configure the loader once (module-level, runs once per app session) ──────
setOptions({
  apiKey:    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
  version:   'weekly',
  libraries: ['places', 'geometry', 'routes'],
});

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, {
  label: string;
  variant: 'success' | 'warning' | 'error' | 'info' | 'default';
}> = {
  PENDING:    { label: 'Pending',    variant: 'warning' },
  ASSIGNED:   { label: 'Assigned',   variant: 'info'    },
  PICKED_UP:  { label: 'Picked Up',  variant: 'info'    },
  IN_TRANSIT: { label: 'In Transit', variant: 'info'    },
  DELIVERED:  { label: 'Delivered',  variant: 'success' },
  CANCELLED:  { label: 'Cancelled',  variant: 'error'   },
};

const isLive = (status: string) =>
  ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(status);

// ─── Small presentational helpers ────────────────────────────────────────────
const TimelineStep: React.FC<{
  label: string;
  at?: string | null;
  done: boolean;
  last?: boolean;
}> = ({ label, at, done, last }) => (
  <div className="flex gap-3">
    <div className="flex flex-col items-center">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        done ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
      }`}>
        {done
          ? <CheckCircle className="h-4 w-4" />
          : <div className="w-2 h-2 rounded-full bg-gray-300" />}
      </div>
      {!last && <div className={`w-0.5 flex-1 my-1 ${done ? 'bg-green-200' : 'bg-gray-200'}`} />}
    </div>
    <div className="pb-4">
      <p className={`text-sm font-medium ${done ? 'text-gray-900' : 'text-gray-400'}`}>{label}</p>
      {at && <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(at)}</p>}
    </div>
  </div>
);

const InfoRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
    <span className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</span>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-0.5 break-words">{value}</p>
    </div>
  </div>
);

// ─── Map hook — handles init + live updates ───────────────────────────────────
function useDeliveryMap(
  containerRef: React.RefObject<HTMLDivElement>,
  delivery: Delivery | null,
  onLocationUpdate: (fn: (lat: number, lng: number) => void) => () => void,
) {
  const mapRef           = useRef<google.maps.Map | null>(null);
  const partnerMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    if (!delivery || !containerRef.current) return;

    let cancelled = false;

    (async () => {
      try {
        if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
          setMapError('VITE_GOOGLE_MAPS_API_KEY is not set in .env');
          return;
        }

        // v2: import each library on demand
        const { Map }                       = await importLibrary('maps') as google.maps.MapsLibrary;
        const { AdvancedMarkerElement }      = await importLibrary('marker') as google.maps.MarkerLibrary;
        const { DirectionsService, DirectionsRenderer, TravelMode } =
          await importLibrary('routes') as google.maps.RoutesLibrary;

        if (cancelled || !containerRef.current) return;

        // Init map
        const map = new Map(containerRef.current, {
          center: { lat: delivery.pickupLat, lng: delivery.pickupLng },
          zoom: 13,
          mapId: 'diakite-delivery-map',   // required by AdvancedMarkerElement
          mapTypeControl:   false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        mapRef.current = map;

        // Pickup pin (green)
        const pickupPin = document.createElement('div');
        pickupPin.innerHTML = `
          <div style="background:#22C55E;color:#fff;font-weight:700;font-size:11px;
            border:2px solid #fff;border-radius:50%;width:28px;height:28px;
            display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.3)">
            P
          </div>`;
        new AdvancedMarkerElement({ map, position: { lat: delivery.pickupLat, lng: delivery.pickupLng }, content: pickupPin, title: 'Pickup' });

        // Dropoff pin (red)
        const dropoffPin = document.createElement('div');
        dropoffPin.innerHTML = `
          <div style="background:#EF4444;color:#fff;font-weight:700;font-size:11px;
            border:2px solid #fff;border-radius:50%;width:28px;height:28px;
            display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.3)">
            D
          </div>`;
        new AdvancedMarkerElement({ map, position: { lat: delivery.dropoffLat, lng: delivery.dropoffLng }, content: dropoffPin, title: 'Dropoff' });

        // Route polyline
        const dsvc = new DirectionsService();
        const dRenderer = new DirectionsRenderer({
          map,
          suppressMarkers: true,
          polylineOptions: { strokeColor: '#3B82F6', strokeWeight: 4, strokeOpacity: 0.8 },
        });
        dsvc.route(
          {
            origin:      { lat: delivery.pickupLat,  lng: delivery.pickupLng  },
            destination: { lat: delivery.dropoffLat, lng: delivery.dropoffLng },
            travelMode: TravelMode.DRIVING,
          },
          (result, status) => {
            if (status === 'OK' && result) dRenderer.setDirections(result);
          }
        );

        // Partner live location marker
        const profile = (delivery.partner as any)?.deliveryProfile;
        const initLat  = profile?.currentLat;
        const initLng  = profile?.currentLng;

        if (initLat && initLng) {
          const vehicleDiv = document.createElement('div');
          vehicleDiv.innerHTML = `
            <div style="background:#3B82F6;border:2px solid #fff;border-radius:50%;
              width:32px;height:32px;display:flex;align-items:center;justify-content:center;
              box-shadow:0 2px 8px rgba(0,0,0,.4)">
              🛵
            </div>`;
          partnerMarkerRef.current = new AdvancedMarkerElement({
            map,
            position: { lat: initLat, lng: initLng },
            content: vehicleDiv,
            title: `${delivery.partner?.firstName} ${delivery.partner?.lastName}`,
            zIndex: 999,
          });
        }

        // Subscribe to live socket updates
        const unsub = onLocationUpdate((lat, lng) => {
          if (cancelled) return;
          const pos = { lat, lng };
          if (partnerMarkerRef.current) {
            partnerMarkerRef.current.position = pos;
          } else {
            const vDiv = document.createElement('div');
            vDiv.innerHTML = `<div style="background:#3B82F6;border:2px solid #fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.4)">🛵</div>`;
            partnerMarkerRef.current = new AdvancedMarkerElement({ map, position: pos, content: vDiv, zIndex: 999 });
          }
          map.panTo(pos);
        });

        return () => unsub();

      } catch (err: any) {
        if (!cancelled) setMapError(err.message ?? 'Map failed to load');
      }
    })();

    return () => { cancelled = true; };
  }, [delivery?.id]);

  return { mapError };
}

// ─── Main page ────────────────────────────────────────────────────────────────
const DeliveryDetails: React.FC = () => {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { on }   = useSocket();

  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading]   = useState(true);
  const [showCancel, setShowCancel]   = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling]     = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Subscribe to partner location and forward to map hook
  const onLocationUpdate = useCallback(
    (fn: (lat: number, lng: number) => void) => {
      if (!delivery || !isLive(delivery.status)) return () => {};
      return on('partner:location:update', (data: { lat: number; lng: number }) => {
        fn(data.lat, data.lng);
      });
    },
    [delivery?.status, on]
  );

  const { mapError } = useDeliveryMap(mapContainerRef, delivery, onLocationUpdate);

  const loadDelivery = useCallback(async () => {
    if (!id) return;
    try {
      const res = await deliveriesAPI.getDeliveryById(id);
      setDelivery(res.data.delivery);
    } catch {
      toast.error('Failed to load delivery');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadDelivery(); }, [loadDelivery]);

  const handleCancel = async () => {
    if (!id) return;
    setCancelling(true);
    try {
      await deliveriesAPI.cancelDelivery(id, cancelReason);
      toast.success('Delivery cancelled');
      setShowCancel(false);
      loadDelivery();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to cancel');
    } finally { setCancelling(false); }
  };

  const exportReport = () => {
    if (!delivery) return;
    const lines = [
      `DIAKITE DELIVERY REPORT`,
      `Generated: ${new Date().toLocaleString()}`,
      ``,
      `DELIVERY ID:   ${delivery.id}`,
      `STATUS:        ${delivery.status}`,
      ``,
      `CUSTOMER`,
      `  Name:  ${delivery.customer?.firstName} ${delivery.customer?.lastName}`,
      `  Email: ${delivery.customer?.email}`,
      `  Phone: ${(delivery.customer as any)?.phone ?? '—'}`,
      `  Pickup contact:  ${delivery.pickupContact}`,
      `  Dropoff contact: ${delivery.dropoffContact}`,
      ``,
      `DELIVERY PARTNER`,
      `  Name:  ${delivery.partner ? `${delivery.partner.firstName} ${delivery.partner.lastName}` : 'Unassigned'}`,
      `  Email: ${delivery.partner?.email ?? '—'}`,
      `  Vehicle: ${(delivery.partner as any)?.deliveryProfile?.vehicleType ?? '—'} · ${(delivery.partner as any)?.deliveryProfile?.vehiclePlate ?? '—'}`,
      ``,
      `PACKAGE`,
      `  Description: ${delivery.packageDescription}`,
      `  Weight:      ${delivery.packageWeight ?? '—'} kg`,
      `  Value:       ₦${delivery.packageValue?.toLocaleString('en-NG') ?? '—'}`,
      `  Notes:       ${delivery.notes ?? '—'}`,
      ``,
      `ROUTE`,
      `  Pickup:   ${delivery.pickupAddress}`,
      `            (${delivery.pickupLat}, ${delivery.pickupLng})`,
      `  Dropoff:  ${delivery.dropoffAddress}`,
      `            (${delivery.dropoffLat}, ${delivery.dropoffLng})`,
      `  Distance: ${delivery.distance?.toFixed(2) ?? '—'} km`,
      ``,
      `FINANCIALS`,
      `  Estimated Fee:  ₦${delivery.estimatedFee.toLocaleString('en-NG')}`,
      `  Actual Fee:     ₦${delivery.actualFee?.toLocaleString('en-NG') ?? 'Pending'}`,
      `  Payment Method: ${delivery.payment?.method ?? '—'}`,
      `  Payment Status: ${delivery.payment?.status ?? '—'}`,
      `  Platform Fee:   ₦${delivery.payment?.platformFee?.toLocaleString('en-NG') ?? '—'}`,
      `  Partner Earned: ₦${delivery.payment?.driverEarnings?.toLocaleString('en-NG') ?? '—'}`,
      `  Transaction ID: ${delivery.payment?.transactionId ?? '—'}`,
      ``,
      `TIMELINE`,
      `  Requested:  ${delivery.requestedAt ? formatDateTime(delivery.requestedAt) : '—'}`,
      `  Assigned:   ${delivery.assignedAt  ? formatDateTime(delivery.assignedAt)  : '—'}`,
      `  Picked Up:  ${delivery.pickedUpAt  ? formatDateTime(delivery.pickedUpAt)  : '—'}`,
      `  Delivered:  ${delivery.deliveredAt ? formatDateTime(delivery.deliveredAt) : '—'}`,
      `  Cancelled:  ${delivery.cancelledAt ? formatDateTime(delivery.cancelledAt) : '—'}`,
      ``,
      `CANCELLATION REASON: ${(delivery as any).cancellationReason ?? '—'}`,
      `RECIPIENT NAME:      ${delivery.recipientName ?? '—'}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `delivery-${delivery.id.slice(0, 8)}-report.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) return <div className="flex justify-center py-20"><Spinner size="xl" showLabel /></div>;

  if (!delivery) return (
    <div className="text-center py-20">
      <p className="text-gray-500">Delivery not found.</p>
      <Button className="mt-4" onClick={() => navigate('/deliveries')}>Back</Button>
    </div>
  );

  const sc   = STATUS_CONFIG[delivery.status] ?? STATUS_CONFIG.PENDING;
  const live = isLive(delivery.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/deliveries')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">Delivery Detail</h1>
              <Badge variant={sc.variant}>{sc.label}</Badge>
              {live && (
                <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                  LIVE
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">{delivery.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportReport}>
            <Download className="h-4 w-4" />Export Report
          </Button>
          {!['DELIVERED', 'CANCELLED'].includes(delivery.status) && (
            <Button variant="danger" onClick={() => setShowCancel(true)}>
              <XCircle className="h-4 w-4" />Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Map */}
      <Card padding={false}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary-500" />
            {live ? 'Live Tracking' : 'Route Map'}
          </p>
          {!import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
              Add VITE_GOOGLE_MAPS_API_KEY to .env
            </span>
          )}
        </div>

        {mapError ? (
          <div className="h-64 flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-400">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
              <p className="text-sm">{mapError}</p>
            </div>
          </div>
        ) : (
          <div ref={mapContainerRef} className="w-full h-96 bg-gray-100" />
        )}

        <div className="flex items-center gap-6 px-5 py-3 text-xs text-gray-500 border-t border-gray-50">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />Pickup
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />Dropoff
          </span>
          {delivery.partner && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />Partner
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="w-6 h-0.5 bg-blue-400 inline-block" />Route
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Customer */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-primary-500" />Customer
            </h3>
            <InfoRow icon={<User className="h-4 w-4" />}   label="Name"            value={`${delivery.customer?.firstName} ${delivery.customer?.lastName}`} />
            <InfoRow icon={<Mail className="h-4 w-4" />}   label="Email"           value={delivery.customer?.email} />
            <InfoRow icon={<Phone className="h-4 w-4" />}  label="Phone"           value={(delivery.customer as any)?.phone ?? '—'} />
            <InfoRow icon={<MapPin className="h-4 w-4" />} label="Pickup contact"  value={delivery.pickupContact} />
            <InfoRow icon={<MapPin className="h-4 w-4" />} label="Dropoff contact" value={delivery.dropoffContact} />
          </Card>

          {/* Partner */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Truck className="h-4 w-4 text-warning-500" />Delivery Partner
            </h3>
            {delivery.partner ? (
              <>
                <InfoRow icon={<User className="h-4 w-4" />}  label="Name"    value={`${delivery.partner.firstName} ${delivery.partner.lastName}`} />
                <InfoRow icon={<Mail className="h-4 w-4" />}  label="Email"   value={delivery.partner.email} />
                <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone"   value={(delivery.partner as any)?.phone ?? '—'} />
                <InfoRow icon={<Truck className="h-4 w-4" />} label="Vehicle" value={`${(delivery.partner as any)?.deliveryProfile?.vehicleType ?? '—'} · ${(delivery.partner as any)?.deliveryProfile?.vehiclePlate ?? '—'}`} />
                {!!((delivery.partner as any)?.deliveryProfile?.rating) && (
                  <InfoRow icon={<Star className="h-4 w-4" />} label="Rating" value={`${(delivery.partner as any).deliveryProfile.rating.toFixed(1)} ★`} />
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400 italic py-2">No partner assigned yet</p>
            )}
          </Card>

          {/* Package */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-indigo-500" />Package
            </h3>
            <InfoRow icon={<Package className="h-4 w-4" />}    label="Description"    value={delivery.packageDescription} />
            <InfoRow icon={<Package className="h-4 w-4" />}    label="Weight"         value={delivery.packageWeight ? `${delivery.packageWeight} kg` : '—'} />
            <InfoRow icon={<DollarSign className="h-4 w-4" />} label="Declared value" value={delivery.packageValue ? `₦${delivery.packageValue.toLocaleString('en-NG')}` : '—'} />
            {delivery.notes && <InfoRow icon={<FileText className="h-4 w-4" />} label="Notes" value={delivery.notes} />}
            {delivery.recipientName && <InfoRow icon={<User className="h-4 w-4" />} label="Received by" value={delivery.recipientName} />}
            {delivery.deliveryImageUrl && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-2">Delivery Proof Photo</p>
                <a href={delivery.deliveryImageUrl} target="_blank" rel="noopener noreferrer">
                  <img
                    src={delivery.deliveryImageUrl}
                    alt="Delivery proof"
                    className="rounded-lg border border-gray-200 max-h-40 object-cover hover:opacity-90 transition-opacity"
                  />
                </a>
              </div>
            )}
          </Card>

          {/* Payment */}
          {delivery.payment && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />Payment
              </h3>
              <InfoRow icon={<DollarSign className="h-4 w-4" />}  label="Amount"          value={`₦${delivery.payment.amount.toLocaleString('en-NG')}`} />
              <InfoRow icon={<DollarSign className="h-4 w-4" />}  label="Method"          value={delivery.payment.method} />
              <InfoRow icon={<CheckCircle className="h-4 w-4" />} label="Status"          value={<Badge variant={delivery.payment.status === 'COMPLETED' ? 'success' : 'warning'}>{delivery.payment.status}</Badge>} />
              <InfoRow icon={<DollarSign className="h-4 w-4" />}  label="Platform fee"   value={`₦${(delivery.payment as any).platformFee?.toLocaleString('en-NG') ?? '—'}`} />
              <InfoRow icon={<DollarSign className="h-4 w-4" />}  label="Partner earned" value={`₦${(delivery.payment as any).driverEarnings?.toLocaleString('en-NG') ?? '—'}`} />
              <InfoRow icon={<FileText className="h-4 w-4" />}    label="Transaction ID"  value={<span className="font-mono text-xs">{delivery.payment.transactionId ?? '—'}</span>} />
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Summary */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Summary</h3>
            <InfoRow icon={<DollarSign className="h-4 w-4" />} label="Estimated fee" value={`₦${delivery.estimatedFee.toLocaleString('en-NG')}`} />
            <InfoRow icon={<DollarSign className="h-4 w-4" />} label="Final fee"     value={delivery.actualFee ? `₦${delivery.actualFee.toLocaleString('en-NG')}` : 'Pending'} />
            <InfoRow icon={<MapPin className="h-4 w-4" />}     label="Distance"      value={delivery.distance ? `${delivery.distance.toFixed(2)} km` : '—'} />
            {delivery.rating && (
              <InfoRow
                icon={<Star className="h-4 w-4" />}
                label="Customer rating"
                value={`${delivery.rating.rating} ★${delivery.rating.comment ? ` — "${delivery.rating.comment}"` : ''}`}
              />
            )}
            {(delivery as any).cancellationReason && (
              <InfoRow
                icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
                label="Cancellation reason"
                value={(delivery as any).cancellationReason}
              />
            )}
          </Card>

          {/* Timeline */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4" />Timeline
            </h3>
            <div className="pt-1">
              <TimelineStep label="Requested"  at={delivery.requestedAt} done={!!delivery.requestedAt} />
              <TimelineStep label="Assigned"   at={delivery.assignedAt}  done={!!delivery.assignedAt} />
              <TimelineStep label="Picked Up"  at={delivery.pickedUpAt}  done={!!delivery.pickedUpAt} />
              <TimelineStep
                label="In Transit"
                at={(delivery as any).inTransitAt}
                done={['IN_TRANSIT','DELIVERED'].includes(delivery.status)}
              />
              <TimelineStep
                label="Delivered"
                at={delivery.deliveredAt}
                done={delivery.status === 'DELIVERED'}
                last
              />
            </div>
            {delivery.status === 'CANCELLED' && (
              <div className="mt-2 p-3 bg-red-50 rounded-lg">
                <p className="text-xs font-medium text-red-600 flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  Cancelled {delivery.cancelledAt ? formatDateTime(delivery.cancelledAt) : ''}
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Cancel modal */}
      <Modal
        isOpen={showCancel}
        onClose={() => setShowCancel(false)}
        title="Cancel Delivery"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCancel(false)}>Keep Delivery</Button>
            <Button variant="danger" loading={cancelling} onClick={handleCancel}>Confirm Cancel</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Alert variant="warning">
            This will cancel the delivery and notify both the customer and partner.
          </Alert>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Enter reason for cancellation..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DeliveryDetails;