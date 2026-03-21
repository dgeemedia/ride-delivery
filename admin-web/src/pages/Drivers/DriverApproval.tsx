// admin-web/src/pages/Drivers/DriverApproval.tsx
import React, { useEffect, useState } from 'react';
import { driversAPI } from '@/services/api/drivers';
import { Driver } from '@/types';
import { Card, Button, Badge, Modal, Alert, Spinner } from '@/components/common';
import {
  FileText, Car, Shield, CheckCircle, XCircle, Eye,
  Gift, AlertTriangle, User, Phone, Mail, Calendar
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/utils/helpers';
import toast from 'react-hot-toast';

// ─── Document viewer sub-component ───────────────────────────────────────────
const DocImage: React.FC<{ label: string; url?: string; icon: React.ReactNode }> = ({ label, url, icon }) => (
  <div className="space-y-2">
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
      {icon}{label}
    </p>
    {url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block group">
        <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50 aspect-video hover:border-primary-400 transition-colors">
          {url.toLowerCase().endsWith('.pdf') ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 group-hover:text-primary-600">
              <FileText className="h-10 w-10" />
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
        <AlertTriangle className="h-6 w-6 text-amber-400" />
        <span className="text-xs">Not uploaded yet</span>
      </div>
    )}
  </div>
);

// ─── Approval modal ───────────────────────────────────────────────────────────
interface ApprovalModalProps {
  driver: Driver;
  isSuperAdmin: boolean;
  onClose: () => void;
  onApproved: () => void;
}

const ApprovalModal: React.FC<ApprovalModalProps> = ({ driver, isSuperAdmin, onClose, onApproved }) => {
  const [grantBonus, setGrantBonus]   = useState(false);
  const [bonusAmount, setBonusAmount] = useState('5000');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject]   = useState(false);
  const [loading, setLoading]         = useState(false);

  const docsUploaded = !!(driver.licenseImageUrl && driver.vehicleRegUrl && driver.insuranceUrl);

  const handleApprove = async () => {
    setLoading(true);
    try {
      await driversAPI.approveDriver(driver.id, {
        grantBonus: isSuperAdmin && grantBonus,
        bonusAmount: isSuperAdmin && grantBonus ? parseFloat(bonusAmount) : undefined,
      });
      toast.success(`${driver.user.firstName} approved${grantBonus ? ` + ₦${parseInt(bonusAmount).toLocaleString('en-NG')} bonus sent` : ''}`);
      onApproved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to approve driver');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error('Please provide a rejection reason'); return; }
    setLoading(true);
    try {
      await driversAPI.rejectDriver(driver.id, rejectReason);
      toast.success('Driver rejected');
      onApproved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to reject driver');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Review — ${driver.user.firstName} ${driver.user.lastName}`}
      size="xl"
      footer={
        showReject ? (
          <>
            <Button variant="outline" onClick={() => setShowReject(false)}>Cancel</Button>
            <Button variant="danger" loading={loading} onClick={handleReject}>
              <XCircle className="h-4 w-4" />Confirm Reject
            </Button>
          </>
        ) : (
          <>
            <Button variant="danger" onClick={() => setShowReject(true)}>
              <XCircle className="h-4 w-4" />Reject
            </Button>
            <Button variant="success" loading={loading} onClick={handleApprove}>
              <CheckCircle className="h-4 w-4" />Approve Driver
            </Button>
          </>
        )
      }
    >
      <div className="space-y-6">
        {/* Driver info summary */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-gray-600"><Mail className="h-4 w-4 text-gray-400" />{driver.user.email}</div>
          <div className="flex items-center gap-2 text-gray-600"><Phone className="h-4 w-4 text-gray-400" />{driver.user.phone}</div>
          <div className="flex items-center gap-2 text-gray-600"><Car className="h-4 w-4 text-gray-400" />{driver.vehicleMake} {driver.vehicleModel} ({driver.vehicleYear})</div>
          <div className="flex items-center gap-2 text-gray-600"><Shield className="h-4 w-4 text-gray-400" />{driver.vehicleType} · {driver.vehiclePlate}</div>
          <div className="flex items-center gap-2 text-gray-600"><FileText className="h-4 w-4 text-gray-400" />License: {driver.licenseNumber}</div>
          <div className="flex items-center gap-2 text-gray-600"><Calendar className="h-4 w-4 text-gray-400" />Applied {formatDate(driver.createdAt)}</div>
        </div>

        {/* Documents */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Uploaded Documents</h4>
          {!docsUploaded && (
            <Alert variant="warning" className="mb-3">
              Some documents are missing. You may still approve at your discretion.
            </Alert>
          )}
          <div className="grid grid-cols-3 gap-4">
            <DocImage label="Driver License"        url={driver.licenseImageUrl} icon={<FileText className="h-3 w-3" />} />
            <DocImage label="Vehicle Registration"  url={driver.vehicleRegUrl}   icon={<Car className="h-3 w-3" />} />
            <DocImage label="Insurance Certificate" url={driver.insuranceUrl}    icon={<Shield className="h-3 w-3" />} />
          </div>
        </div>

        {/* Onboarding bonus — SUPER_ADMIN only */}
        {isSuperAdmin && !showReject && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={grantBonus}
                onChange={e => setGrantBonus(e.target.checked)}
                className="h-4 w-4 rounded text-primary-600"
              />
              <div>
                <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                  <Gift className="h-4 w-4" />Grant Onboarding Bonus
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Funds are deposited to wallet but <strong>cannot be withdrawn</strong> — only used to accept rides.
                </p>
              </div>
            </label>
            {grantBonus && (
              <div className="relative ml-7">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">₦</span>
                <input
                  type="number"
                  value={bonusAmount}
                  onChange={e => setBonusAmount(e.target.value)}
                  min="0"
                  className="w-40 pl-8 pr-3 py-2 rounded-lg border border-amber-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                />
              </div>
            )}
          </div>
        )}

        {/* Rejection reason */}
        {showReject && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason <span className="text-red-500">*</span></label>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Explain why this application is being rejected..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
const DriverApproval: React.FC = () => {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [drivers, setDrivers]           = useState<Driver[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  useEffect(() => { loadPendingDrivers(); }, []);

  const loadPendingDrivers = async () => {
    setLoading(true);
    try {
      const res = await driversAPI.getPendingDrivers();
      setDrivers(res.data.drivers);
    } catch {
      toast.error('Failed to load pending drivers');
    } finally {
      setLoading(false);
    }
  };

  const docsCount = (d: Driver) =>
    [d.licenseImageUrl, d.vehicleRegUrl, d.insuranceUrl].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pending Driver Approvals</h1>
          <p className="text-gray-500 text-sm mt-1">{drivers.length} application{drivers.length !== 1 ? 's' : ''} awaiting review</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" showLabel /></div>
      ) : drivers.length === 0 ? (
        <Card>
          <div className="py-12 text-center text-gray-400">
            <CheckCircle className="h-10 w-10 mx-auto mb-3 text-green-400" />
            <p className="font-medium text-gray-600">All caught up!</p>
            <p className="text-sm mt-1">No pending driver applications.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {drivers.map(driver => {
            const docs = docsCount(driver);
            return (
              <Card key={driver.id} className="flex flex-col justify-between gap-4">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                    {driver.user.firstName[0]}{driver.user.lastName[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {driver.user.firstName} {driver.user.lastName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{driver.user.email}</p>
                  </div>
                </div>

                {/* Vehicle */}
                <div className="text-sm space-y-1">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Car className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span>{driver.vehicleMake} {driver.vehicleModel} ({driver.vehicleYear})</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Shield className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span>{driver.vehicleType} · {driver.vehiclePlate}</span>
                  </div>
                </div>

                {/* Docs status */}
                <div className="flex items-center gap-2">
                  <Badge variant={docs === 3 ? 'success' : docs > 0 ? 'warning' : 'error'}>
                    {docs}/3 docs uploaded
                  </Badge>
                  <span className="text-xs text-gray-400">{formatDate(driver.createdAt)}</span>
                </div>

                {/* Actions */}
                <Button
                  size="sm"
                  onClick={() => setSelectedDriver(driver)}
                  className="w-full"
                >
                  <Eye className="h-4 w-4" />Review Application
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {selectedDriver && (
        <ApprovalModal
          driver={selectedDriver}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setSelectedDriver(null)}
          onApproved={() => { setSelectedDriver(null); loadPendingDrivers(); }}
        />
      )}
    </div>
  );
};

export default DriverApproval;