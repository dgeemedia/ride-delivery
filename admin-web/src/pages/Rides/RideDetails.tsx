// admin-web/src/pages/Rides/RideDetails.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import {
  ArrowLeft, User, Phone, Mail, MapPin, Clock,
  CheckCircle, XCircle, DollarSign, Star, Car, AlertTriangle,
  Download, FileText, Shield,
} from 'lucide-react';
import { ridesAPI } from '@/services/api/rides';
import { Ride } from '@/types';
import { Card, Button, Badge, Modal, Alert, Spinner } from '@/components/common';
import { formatDateTime } from '@/utils/helpers';
import { useSocket } from '@/hooks/useSocket';
import toast from 'react-hot-toast';

// FIX: removed unused RIDE_STATUSES import, changed apiKey → key, removed version
setOptions({
  key:       import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
  libraries: ['places', 'geometry', 'routes'],
} as any);

const STATUS_CONFIG: Record<string, {
  label: string;
  variant: 'success' | 'warning' | 'error' | 'info' | 'default';
}> = {
  REQUESTED:   { label: 'Requested',   variant: 'warning' },
  ACCEPTED:    { label: 'Accepted',    variant: 'info'    },
  ARRIVED:     { label: 'Arrived',     variant: 'info'    },
  IN_PROGRESS: { label: 'In Progress', variant: 'info'    },
  COMPLETED:   { label: 'Completed',   variant: 'success' },
  CANCELLED:   { label: 'Cancelled',   variant: 'error'   },
};

const isLive = (status: string) =>
  ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(status);

const TimelineStep: React.FC<{
  label: string; at?: string | null; done: boolean; last?: boolean;
}> = ({ label, at, done, last }) => (
  <div className="flex gap-3">
    <div className="flex flex-col items-center">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        done ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
      }`}>
        {done ? <CheckCircle className="h-4 w-4" /> : <div className="w-2 h-2 rounded-full bg-gray-300" />}
      </div>
      {!last && <div className={`w-0.5 flex-1 my-1 ${done ? 'bg-green-200' : 'bg-gray-200'}`} />}
    </div>
    <div className="pb-4">
      <p className={`text-sm font-medium ${done ? 'text-gray-900' : 'text-gray-400'}`}>{label}</p>
      {at && <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(at)}</p>}
    </div>
  </div>
);

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
    <span className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</span>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-0.5 break-words">{value}</p>
    </div>
  </div>
);

function useRideMap(
  containerRef: React.RefObject<HTMLDivElement>,
  ride: Ride | null,
  onDriverLocation: (fn: (lat: number, lng: number) => void) => () => void,
) {
  const mapRef          = useRef<google.maps.Map | null>(null);
  const driverMarkerRef = useRef<any>(null);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    if (!ride || !containerRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
          setMapError('VITE_GOOGLE_MAPS_API_KEY is not set in .env');
          return;
        }

        const { Map }                = await importLibrary('maps') as google.maps.MapsLibrary;
        const { AdvancedMarkerElement } = await importLibrary('marker') as google.maps.MarkerLibrary;
        const { DirectionsService, DirectionsRenderer, TravelMode } =
          await importLibrary('routes') as google.maps.RoutesLibrary;

        if (cancelled || !containerRef.current) return;

        const map = new Map(containerRef.current, {
          center: { lat: ride.pickupLat, lng: ride.pickupLng },
          zoom: 13,
          mapId: 'diakite-ride-map',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        mapRef.current = map;

        const pickupEl = document.createElement('div');
        pickupEl.innerHTML = `<div style="background:#22C55E;color:#fff;font-weight:700;font-size:11px;border:2px solid #fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.3)">P</div>`;
        new AdvancedMarkerElement({ map, position: { lat: ride.pickupLat, lng: ride.pickupLng }, content: pickupEl, title: 'Pickup' });

        const dropoffEl = document.createElement('div');
        dropoffEl.innerHTML = `<div style="background:#EF4444;color:#fff;font-weight:700;font-size:11px;border:2px solid #fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.3)">D</div>`;
        new AdvancedMarkerElement({ map, position: { lat: ride.dropoffLat, lng: ride.dropoffLng }, content: dropoffEl, title: 'Dropoff' });

        const dRenderer = new DirectionsRenderer({
          map,
          suppressMarkers: true,
          polylineOptions: { strokeColor: '#3B82F6', strokeWeight: 4, strokeOpacity: 0.8 },
        });
        new DirectionsService().route(
          { origin: { lat: ride.pickupLat, lng: ride.pickupLng }, destination: { lat: ride.dropoffLat, lng: ride.dropoffLng }, travelMode: TravelMode.DRIVING },
          (result, status) => { if (status === 'OK' && result) dRenderer.setDirections(result); }
        );

        const driverProfile = (ride.driver as any)?.driverProfile;
        const initLat = driverProfile?.currentLat;
        const initLng = driverProfile?.currentLng;
        if (initLat && initLng) {
          const carEl = document.createElement('div');
          carEl.innerHTML = `<div style="background:#3B82F6;border:2px solid #fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.4);font-size:16px">🚗</div>`;
          driverMarkerRef.current = new AdvancedMarkerElement({ map, position: { lat: initLat, lng: initLng }, content: carEl, title: `${ride.driver?.firstName} ${ride.driver?.lastName}`, zIndex: 999 });
        }

        const unsub = onDriverLocation((lat, lng) => {
          if (cancelled) return;
          const pos = { lat, lng };
          if (driverMarkerRef.current) {
            driverMarkerRef.current.position = pos;
          } else {
            const el = document.createElement('div');
            el.innerHTML = `<div style="background:#3B82F6;border:2px solid #fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.4);font-size:16px">🚗</div>`;
            driverMarkerRef.current = new AdvancedMarkerElement({ map, position: pos, content: el, zIndex: 999 });
          }
          map.panTo(pos);
        });
        return () => unsub();

      } catch (err: any) {
        if (!cancelled) setMapError(err.message ?? 'Map failed to load');
      }
    })();

    return () => { cancelled = true; };
  }, [ride?.id]);

  return { mapError };
}

const RideDetails: React.FC = () => {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { on }   = useSocket();

  const [ride, setRide]             = useState<Ride | null>(null);
  const [loading, setLoading]       = useState(true);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling]     = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);

  const onDriverLocation = useCallback(
    (fn: (lat: number, lng: number) => void) => {
      if (!ride || !isLive(ride.status)) return () => {};
      return on('driver:location:update', (data: { lat: number; lng: number }) => fn(data.lat, data.lng));
    },
    [ride?.status, on]
  );

  const { mapError } = useRideMap(mapContainerRef, ride, onDriverLocation);

  const loadRide = useCallback(async () => {
    if (!id) return;
    try {
      const res = await ridesAPI.getRideById(id);
      setRide(res.data.ride);
    } catch {
      toast.error('Failed to load ride');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadRide(); }, [loadRide]);

  const handleCancel = async () => {
    if (!id) return;
    setCancelling(true);
    try {
      await ridesAPI.cancelRide(id, cancelReason);
      toast.success('Ride cancelled');
      setShowCancel(false);
      loadRide();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to cancel');
    } finally { setCancelling(false); }
  };

  const exportReport = () => {
    if (!ride) return;
    const driverProfile = (ride.driver as any)?.driverProfile;
    const lines = [
      `DIAKITE RIDE REPORT`,
      `Generated: ${new Date().toLocaleString()}`,
      ``,
      `RIDE ID:   ${ride.id}`,
      `STATUS:    ${ride.status}`,
      ``,
      `CUSTOMER`,
      `  Name:  ${ride.customer?.firstName} ${ride.customer?.lastName}`,
      `  Email: ${ride.customer?.email}`,
      `  Phone: ${(ride.customer as any)?.phone ?? '—'}`,
      ``,
      `DRIVER`,
      `  Name:    ${ride.driver ? `${ride.driver.firstName} ${ride.driver.lastName}` : 'Unassigned'}`,
      `  Email:   ${ride.driver?.email ?? '—'}`,
      `  Vehicle: ${driverProfile ? `${driverProfile.vehicleType} • ${driverProfile.vehicleMake} ${driverProfile.vehicleModel} (${driverProfile.vehicleYear}) • ${driverProfile.vehiclePlate} • ${driverProfile.vehicleColor}` : '—'}`,
      `  Rating:  ${driverProfile?.rating?.toFixed(2) ?? '—'}`,
      ``,
      `ROUTE`,
      `  Pickup:   ${ride.pickupAddress}`,
      `            (${ride.pickupLat}, ${ride.pickupLng})`,
      `  Dropoff:  ${ride.dropoffAddress}`,
      `            (${ride.dropoffLat}, ${ride.dropoffLng})`,
      `  Distance: ${ride.distance?.toFixed(2) ?? '—'} km`,
      `  Notes:    ${ride.notes ?? '—'}`,
      ``,
      `FINANCIALS`,
      `  Estimated Fare: ₦${ride.estimatedFare.toLocaleString('en-NG')}`,
      `  Actual Fare:    ₦${ride.actualFare?.toLocaleString('en-NG') ?? 'Pending'}`,
      `  Payment Method: ${ride.payment?.method ?? '—'}`,
      `  Payment Status: ${ride.payment?.status ?? '—'}`,
      `  Platform Fee:   ₦${(ride.payment as any)?.platformFee?.toLocaleString('en-NG') ?? '—'}`,
      `  Driver Earned:  ₦${(ride.payment as any)?.driverEarnings?.toLocaleString('en-NG') ?? '—'}`,
      `  Transaction ID: ${ride.payment?.transactionId ?? '—'}`,
      ``,
      `TIMELINE`,
      `  Requested:  ${ride.requestedAt  ? formatDateTime(ride.requestedAt)  : '—'}`,
      `  Accepted:   ${ride.acceptedAt   ? formatDateTime(ride.acceptedAt)   : '—'}`,
      `  Started:    ${ride.startedAt    ? formatDateTime(ride.startedAt)    : '—'}`,
      `  Completed:  ${ride.completedAt  ? formatDateTime(ride.completedAt)  : '—'}`,
      `  Cancelled:  ${ride.cancelledAt  ? formatDateTime(ride.cancelledAt)  : '—'}`,
      ``,
      `CANCELLATION REASON: ${(ride as any).cancellationReason ?? '—'}`,
      `PROMO CODE: ${(ride as any).promoCode ?? '—'}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `ride-${ride.id.slice(0, 8)}-report.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="xl" showLabel /></div>;
  if (!ride)   return <div className="text-center py-20"><p className="text-gray-500">Ride not found.</p><Button className="mt-4" onClick={() => navigate('/rides')}>Back</Button></div>;

  const sc   = STATUS_CONFIG[ride.status] ?? STATUS_CONFIG.REQUESTED;
  const live = isLive(ride.status);
  const driverProfile = (ride.driver as any)?.driverProfile;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/rides')}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">Ride Detail</h1>
              <Badge variant={sc.variant}>{sc.label}</Badge>
              {live && (
                <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />LIVE
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">{ride.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportReport}><Download className="h-4 w-4" />Export Report</Button>
          {!['COMPLETED', 'CANCELLED'].includes(ride.status) && (
            <Button variant="danger" onClick={() => setShowCancel(true)}><XCircle className="h-4 w-4" />Cancel Ride</Button>
          )}
        </div>
      </div>

      <Card padding={false}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary-500" />{live ? 'Live Tracking' : 'Route Map'}
          </p>
          {!import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">Add VITE_GOOGLE_MAPS_API_KEY to .env</span>
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
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" />Pickup</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />Dropoff</span>
          {ride.driver && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />Driver</span>}
          <span className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-blue-400 inline-block" />Route</span>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><User className="h-4 w-4 text-primary-500" />Customer</h3>
            <InfoRow icon={<User className="h-4 w-4" />}  label="Name"  value={`${ride.customer?.firstName} ${ride.customer?.lastName}`} />
            <InfoRow icon={<Mail className="h-4 w-4" />}  label="Email" value={ride.customer?.email} />
            <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={(ride.customer as any)?.phone ?? '—'} />
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Car className="h-4 w-4 text-warning-500" />Driver</h3>
            {ride.driver ? (
              <>
                <InfoRow icon={<User className="h-4 w-4" />}   label="Name"    value={`${ride.driver.firstName} ${ride.driver.lastName}`} />
                <InfoRow icon={<Mail className="h-4 w-4" />}   label="Email"   value={ride.driver.email} />
                <InfoRow icon={<Phone className="h-4 w-4" />}  label="Phone"   value={(ride.driver as any)?.phone ?? '—'} />
                {driverProfile && (
                  <>
                    <InfoRow icon={<Car className="h-4 w-4" />}    label="Vehicle" value={`${driverProfile.vehicleType} • ${driverProfile.vehicleMake} ${driverProfile.vehicleModel} (${driverProfile.vehicleYear})`} />
                    <InfoRow icon={<Shield className="h-4 w-4" />} label="Plate / Color" value={`${driverProfile.vehiclePlate} • ${driverProfile.vehicleColor}`} />
                    {driverProfile.rating > 0 && <InfoRow icon={<Star className="h-4 w-4" />} label="Rating" value={`${driverProfile.rating.toFixed(1)} ★`} />}
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400 italic py-2">No driver assigned yet</p>
            )}
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><MapPin className="h-4 w-4 text-indigo-500" />Route</h3>
            <InfoRow icon={<MapPin className="h-4 w-4 text-green-500" />} label="Pickup"   value={ride.pickupAddress} />
            <InfoRow icon={<MapPin className="h-4 w-4 text-red-500" />}   label="Dropoff"  value={ride.dropoffAddress} />
            <InfoRow icon={<MapPin className="h-4 w-4" />}                label="Distance" value={ride.distance ? `${ride.distance.toFixed(2)} km` : '—'} />
            {ride.notes && <InfoRow icon={<FileText className="h-4 w-4" />} label="Notes" value={ride.notes} />}
            {(ride as any).promoCode && <InfoRow icon={<FileText className="h-4 w-4" />} label="Promo code" value={(ride as any).promoCode} />}
          </Card>

          {ride.payment && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><DollarSign className="h-4 w-4 text-green-500" />Payment</h3>
              <InfoRow icon={<DollarSign className="h-4 w-4" />}  label="Amount"         value={`₦${ride.payment.amount.toLocaleString('en-NG')}`} />
              <InfoRow icon={<DollarSign className="h-4 w-4" />}  label="Method"         value={ride.payment.method} />
              <InfoRow icon={<CheckCircle className="h-4 w-4" />} label="Status"         value={<Badge variant={ride.payment.status === 'COMPLETED' ? 'success' : 'warning'}>{ride.payment.status}</Badge>} />
              <InfoRow icon={<DollarSign className="h-4 w-4" />}  label="Platform fee"  value={`₦${(ride.payment as any).platformFee?.toLocaleString('en-NG') ?? '—'}`} />
              <InfoRow icon={<DollarSign className="h-4 w-4" />}  label="Driver earned" value={`₦${(ride.payment as any).driverEarnings?.toLocaleString('en-NG') ?? '—'}`} />
              <InfoRow icon={<FileText className="h-4 w-4" />}    label="Transaction ID" value={<span className="font-mono text-xs">{ride.payment.transactionId ?? '—'}</span>} />
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Summary</h3>
            <InfoRow icon={<DollarSign className="h-4 w-4" />} label="Estimated fare" value={`₦${ride.estimatedFare.toLocaleString('en-NG')}`} />
            <InfoRow icon={<DollarSign className="h-4 w-4" />} label="Final fare"     value={ride.actualFare ? `₦${ride.actualFare.toLocaleString('en-NG')}` : 'Pending'} />
            <InfoRow icon={<MapPin className="h-4 w-4" />}     label="Distance"       value={ride.distance ? `${ride.distance.toFixed(2)} km` : '—'} />
            {ride.rating && (
              <InfoRow icon={<Star className="h-4 w-4" />} label="Customer rating" value={`${ride.rating.rating} ★${ride.rating.comment ? ` — "${ride.rating.comment}"` : ''}`} />
            )}
            {(ride as any).cancellationReason && (
              <InfoRow icon={<AlertTriangle className="h-4 w-4 text-red-400" />} label="Cancellation reason" value={(ride as any).cancellationReason} />
            )}
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><Clock className="h-4 w-4" />Timeline</h3>
            <div className="pt-1">
              <TimelineStep label="Requested"      at={ride.requestedAt} done={!!ride.requestedAt} />
              <TimelineStep label="Accepted"       at={ride.acceptedAt}  done={!!ride.acceptedAt} />
              <TimelineStep label="Driver Arrived" at={(ride as any).arrivedAt} done={['ARRIVED','IN_PROGRESS','COMPLETED'].includes(ride.status)} />
              <TimelineStep label="In Progress"    at={ride.startedAt}   done={['IN_PROGRESS','COMPLETED'].includes(ride.status)} />
              <TimelineStep label="Completed"      at={ride.completedAt} done={ride.status === 'COMPLETED'} last />
            </div>
            {ride.status === 'CANCELLED' && (
              <div className="mt-2 p-3 bg-red-50 rounded-lg">
                <p className="text-xs font-medium text-red-600 flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  Cancelled {ride.cancelledAt ? formatDateTime(ride.cancelledAt) : ''}
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal
        isOpen={showCancel}
        onClose={() => setShowCancel(false)}
        title="Cancel Ride"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCancel(false)}>Keep Ride</Button>
            <Button variant="danger" loading={cancelling} onClick={handleCancel}>Confirm Cancel</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Alert variant="warning">This will cancel the ride and notify both the customer and driver.</Alert>
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

export default RideDetails;