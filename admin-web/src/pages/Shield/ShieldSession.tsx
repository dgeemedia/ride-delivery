// admin-web/src/pages/Shield/ShieldSession.tsx
//
// Admin detail view for a single SHIELD session.
// Shows customer, guardian, driver/partner, trip details and timeline.

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Shield, AlertTriangle, CheckCircle, Zap, Eye,
  ArrowLeft, Phone, MapPin, User, Truck,
} from 'lucide-react';
import { Card } from '@/components/common';
import api from '@/services/api';
import toast from 'react-hot-toast';

const ShieldSession: React.FC = () => {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/admin/shield/sessions/${id}`)
      .then(res => setSession(res.data.data.session))
      .catch(() => toast.error('Could not load session'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleClose = async () => {
    if (!confirm('Force-close this SHIELD session?')) return;
    try {
      await api.put(`/admin/shield/sessions/${id}/close`);
      toast.success('Session closed');
      setSession((s: any) => ({ ...s, isActive: false }));
    } catch {
      toast.error('Could not close session');
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
    </div>
  );

  if (!session) return (
    <div className="text-center py-20 text-gray-500">Session not found.</div>
  );

  const trip    = session.ride ?? session.delivery;
  const contact = session.ride?.driver ?? session.delivery?.partner;
  const type    = session.ride ? 'Ride' : 'Delivery';

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Back + header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/shield')} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            <h1 className="text-xl font-bold text-gray-900">SHIELD Session</h1>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
            session.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {session.isActive ? '🟢 Live' : 'Ended'}
          </span>
        </div>
        {session.isActive && (
          <button
            onClick={handleClose}
            className="px-3 py-1.5 text-sm bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100"
          >
            Force Close
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Customer */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <User className="h-4 w-4" /> Customer
          </h3>
          <p className="text-base font-semibold text-gray-900">
            {session.user.firstName} {session.user.lastName}
          </p>
          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
            <Phone className="h-3.5 w-3.5" /> {session.user.phone}
          </p>
          <Link
            to={`/users/${session.userId}`}
            className="text-xs text-blue-600 hover:underline mt-2 inline-block"
          >
            View user profile →
          </Link>
        </Card>

        {/* Guardian */}
        <Card>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4" /> Guardian
          </h3>
          <p className="text-base font-semibold text-gray-900">{session.beneficiaryName ?? '—'}</p>
          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
            <Phone className="h-3.5 w-3.5" /> {session.beneficiaryPhone ?? '—'}
          </p>
          {session.beneficiaryEmail && (
            <p className="text-sm text-gray-500 mt-1">{session.beneficiaryEmail}</p>
          )}
        </Card>

        {/* Trip info */}
        {trip && (
          <Card>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Truck className="h-4 w-4" /> {type} Details
            </h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Pickup</p>
                  <p className="text-sm text-gray-700">{trip.pickupAddress}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Dropoff</p>
                  <p className="text-sm text-gray-700">{trip.dropoffAddress}</p>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                trip.status === 'COMPLETED' || trip.status === 'DELIVERED'
                  ? 'bg-green-100 text-green-700'
                  : trip.status === 'CANCELLED'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {trip.status}
              </span>
              <Link
                to={session.ride ? `/rides/${trip.id}` : `/deliveries/${trip.id}`}
                className="text-xs text-blue-600 hover:underline ml-3"
              >
                View {type.toLowerCase()} →
              </Link>
            </div>
          </Card>
        )}

        {/* Driver / Partner */}
        {contact && (
          <Card>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <User className="h-4 w-4" /> {session.ride ? 'Driver' : 'Delivery Partner'}
            </h3>
            <p className="text-base font-semibold text-gray-900">
              {contact.firstName} {contact.lastName}
            </p>
            {(contact.driverProfile ?? contact.deliveryProfile) && (
              <p className="text-sm text-gray-500 mt-1">
                {(contact.driverProfile ?? contact.deliveryProfile).vehiclePlate ?? '—'}
              </p>
            )}
          </Card>
        )}
      </div>

      {/* Session metadata */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Session Details</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Views</p>
            <p className="text-lg font-bold text-gray-900 flex items-center gap-1">
              <Eye className="h-4 w-4 text-gray-400" /> {session.viewCount}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Auto-Triggered</p>
            <p className="text-sm font-semibold flex items-center gap-1">
              {session.autoTriggered
                ? <><Zap className="h-4 w-4 text-amber-500" /> Yes (Night Ride)</>
                : <span className="text-gray-400">No</span>
              }
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Alert Sent</p>
            <p className="text-sm font-semibold flex items-center gap-1">
              {session.driverAlerted
                ? <><AlertTriangle className="h-4 w-4 text-red-500" /> Yes</>
                : <span className="text-gray-400">No</span>
              }
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Arrived Safe</p>
            <p className="text-sm font-semibold flex items-center gap-1">
              {session.arrivedSafe
                ? <><CheckCircle className="h-4 w-4 text-green-500" /> Confirmed</>
                : <span className="text-gray-400">Not yet</span>
              }
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Created</p>
            <p className="text-sm text-gray-700">{new Date(session.createdAt).toLocaleString('en-NG')}</p>
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Expires</p>
            <p className="text-sm text-gray-700">{new Date(session.expiresAt).toLocaleString('en-NG')}</p>
          </div>

          {session.lastPingAt && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Last Guardian Ping</p>
              <p className="text-sm text-gray-700">{new Date(session.lastPingAt).toLocaleString('en-NG')}</p>
            </div>
          )}

        </div>
      </Card>

    </div>
  );
};

export default ShieldSession;