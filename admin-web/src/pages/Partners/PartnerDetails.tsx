// admin-web/src/pages/Partners/PartnerDetails.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Truck, FileText, Star, Phone, Mail,
  User, DollarSign, CheckCircle, XCircle, Clock, AlertTriangle,
  MapPin, Package,
} from 'lucide-react';
import { partnersAPI } from '@/services/api/partners';
import { DeliveryPartner } from '@/types';
import { Card, Button, Badge, Spinner, Alert } from '@/components/common';
import { formatDate, formatDateTime } from '@/utils/helpers';
import toast from 'react-hot-toast';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
    <span className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</span>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-0.5 break-words">{value}</p>
    </div>
  </div>
);

const DocImage: React.FC<{ label: string; url?: string }> = ({ label, url }) => (
  <div className="space-y-2">
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
    {url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block group">
        <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50 aspect-video hover:border-primary-400 transition-colors">
          {url.toLowerCase().endsWith('.pdf') ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 group-hover:text-primary-600">
              <FileText className="h-8 w-8" />
              <span className="text-xs font-medium">View PDF</span>
            </div>
          ) : (
            <img
              src={url}
              alt={label}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 bg-white text-xs font-medium px-2 py-1 rounded shadow transition-opacity">
              Open full size ↗
            </span>
          </div>
        </div>
      </a>
    ) : (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 aspect-video flex flex-col items-center justify-center text-gray-400 gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-400" />
        <span className="text-xs">Not uploaded yet</span>
      </div>
    )}
  </div>
);

// ─── Delivery status badge ────────────────────────────────────────────────────
const deliveryBadgeVariant = (status: string): 'success' | 'warning' | 'error' | 'info' | 'default' => ({
  DELIVERED: 'success', CANCELLED: 'error',
  IN_TRANSIT: 'info', PICKED_UP: 'info', ASSIGNED: 'info', PENDING: 'warning',
} as any)[status] ?? 'default';

// ─── Main page ────────────────────────────────────────────────────────────────
const PartnerDetails: React.FC = () => {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [partner, setPartner]               = useState<DeliveryPartner | null>(null);
  const [recentDeliveries, setRecentDeliveries] = useState<any[]>([]);
  const [loading, setLoading]               = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await partnersAPI.getPartnerById(id);
      setPartner(res.data.partner);
      setRecentDeliveries((res.data as any).recentDeliveries ?? []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to load partner');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="xl" showLabel /></div>;

  if (!partner) return (
    <div className="text-center py-20">
      <p className="text-gray-500">Delivery partner not found.</p>
      <Button className="mt-4" onClick={() => navigate('/partners')}>Back to Partners</Button>
    </div>
  );

  const user   = partner.user;
  const wallet = (user as any)?.wallet;

  const docsPresent = !!(partner.idImageUrl);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/partners')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-warning-100 text-warning-700 flex items-center justify-center font-bold text-lg flex-shrink-0">
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {user.firstName} {user.lastName}
              </h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <Badge variant={partner.isApproved ? 'success' : 'warning'}>
                  {partner.isApproved ? 'Approved' : 'Pending'}
                </Badge>
                {partner.isOnline && <Badge variant="success">Online</Badge>}
                {user.isSuspended && <Badge variant="error">Suspended</Badge>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left column ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Contact */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-primary-500" />Contact Information
            </h3>
            <InfoRow icon={<Mail className="h-4 w-4" />}  label="Email"  value={user.email} />
            <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone"  value={(user as any).phone ?? '—'} />
            <InfoRow icon={<Clock className="h-4 w-4" />} label="Joined" value={formatDate(partner.createdAt)} />
            <InfoRow icon={<User className="h-4 w-4" />}  label="User ID" value={<span className="font-mono text-xs">{(user as any).id}</span>} />
          </Card>

          {/* Vehicle */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Truck className="h-4 w-4 text-warning-500" />Vehicle
            </h3>
            <InfoRow icon={<Truck className="h-4 w-4" />}   label="Type"   value={partner.vehicleType} />
            {partner.vehiclePlate && (
              <InfoRow icon={<Truck className="h-4 w-4" />} label="Plate"  value={partner.vehiclePlate} />
            )}
            {(partner as any).currentLat && (
              <InfoRow icon={<MapPin className="h-4 w-4" />} label="Last location" value={`${(partner as any).currentLat?.toFixed(4)}, ${(partner as any).currentLng?.toFixed(4)}`} />
            )}
          </Card>

          {/* Documents */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-500" />Documents
            </h3>
            {!docsPresent && (
              <Alert variant="warning" className="mb-4">
                Government ID has not been uploaded yet.
              </Alert>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DocImage label="Government ID"  url={partner.idImageUrl} />
              <DocImage label="Vehicle Image"  url={partner.vehicleImageUrl} />
            </div>
          </Card>

          {/* Recent deliveries */}
          {recentDeliveries.length > 0 && (
            <Card padding={false}>
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Recent Deliveries</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {recentDeliveries.slice(0, 8).map((delivery: any) => (
                  <div
                    key={delivery.id}
                    className="px-5 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/deliveries/${delivery.id}`)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant={deliveryBadgeVariant(delivery.status)}>
                        {delivery.status.replace('_', ' ')}
                      </Badge>
                      <span className="text-xs text-gray-400">{formatDateTime(delivery.requestedAt)}</span>
                    </div>
                    <div className="text-xs text-gray-600 space-y-0.5">
                      <div className="flex gap-1">
                        <span className="text-green-500 font-bold">↑</span>
                        <span className="truncate">{delivery.pickupAddress}</span>
                      </div>
                      <div className="flex gap-1">
                        <span className="text-red-500 font-bold">↓</span>
                        <span className="truncate">{delivery.dropoffAddress}</span>
                      </div>
                    </div>
                    {delivery.packageDescription && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                        <Package className="h-3 w-3" />
                        <span className="truncate">{delivery.packageDescription}</span>
                      </div>
                    )}
                    <div className="mt-1 text-xs font-medium text-gray-700">
                      ₦{(delivery.actualFee ?? delivery.estimatedFee)?.toLocaleString('en-NG') ?? '—'}
                      {delivery.payment?.driverEarnings != null && (
                        <span className="text-green-600 ml-2">
                          (earned: ₦{delivery.payment.driverEarnings.toLocaleString('en-NG')})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {recentDeliveries.length === 0 && !loading && (
            <Card>
              <div className="py-8 text-center text-gray-400">
                <Package className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">No deliveries yet</p>
              </div>
            </Card>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="space-y-5">
          {/* Stats */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Statistics</h3>
            <InfoRow
              icon={<Package className="h-4 w-4" />}
              label="Total deliveries"
              value={partner.totalDeliveries}
            />
            <InfoRow
              icon={<Star className="h-4 w-4" />}
              label="Rating"
              value={`${(partner.rating ?? 0).toFixed(2)} ★`}
            />
            <InfoRow
              icon={<CheckCircle className="h-4 w-4" />}
              label="Approved"
              value={partner.isApproved ? 'Yes' : 'No'}
            />
            <InfoRow
              icon={<Truck className="h-4 w-4" />}
              label="Currently"
              value={partner.isOnline ? 'Online' : 'Offline'}
            />
          </Card>

          {/* Wallet */}
          {wallet && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />Wallet
              </h3>
              <div className="text-center py-3">
                <p className="text-3xl font-bold text-gray-900">
                  ₦{wallet.balance?.toLocaleString('en-NG') ?? '0'}
                </p>
                <p className="text-xs text-gray-500 mt-1">{wallet.currency ?? 'NGN'}</p>
              </div>
            </Card>
          )}

          {/* Account status */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Account</h3>
            <InfoRow
              icon={<CheckCircle className="h-4 w-4" />}
              label="Active"
              value={<Badge variant={user.isActive ? 'success' : 'error'}>{user.isActive ? 'Active' : 'Inactive'}</Badge>}
            />
            <InfoRow
              icon={<CheckCircle className="h-4 w-4" />}
              label="Verified"
              value={<Badge variant={user.isVerified ? 'success' : 'warning'}>{user.isVerified ? 'Verified' : 'Unverified'}</Badge>}
            />
            <InfoRow
              icon={<XCircle className="h-4 w-4" />}
              label="Suspended"
              value={<Badge variant={user.isSuspended ? 'error' : 'default'}>{user.isSuspended ? 'Yes' : 'No'}</Badge>}
            />
            {user.isSuspended && user.suspensionReason && (
              <InfoRow
                icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
                label="Suspension reason"
                value={user.suspensionReason}
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PartnerDetails;