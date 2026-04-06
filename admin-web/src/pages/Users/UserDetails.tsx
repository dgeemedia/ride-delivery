// admin-web/src/pages/Users/UserDetails.tsx
// FIX: removed unused 'formatDate' import, removed unused 'isAdminAccount' variable
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, Calendar, Shield, User,
  DollarSign, CheckCircle, XCircle, AlertTriangle, Trash2,
} from 'lucide-react';
import { usersAPI } from '@/services/api/users';
import { User as UserType } from '@/types';
import { Card, Button, Badge, Modal, Alert, Spinner } from '@/components/common';
import { formatDateTime } from '@/utils/helpers';
import { USER_ROLES } from '@/utils/constants';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
    <span className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</span>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-0.5 break-words">{value}</p>
    </div>
  </div>
);

const DEPT_LABELS: Record<string, string> = {
  RIDES: 'Rides & Drivers',
  DELIVERIES: 'Deliveries & Partners',
  SUPPORT: 'Support Tickets',
};

const UserDetails: React.FC = () => {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  const [user, setUser]               = useState<UserType | null>(null);
  const [loading, setLoading]         = useState(true);
  const [suspendReason, setSuspendReason] = useState('');
  const [showSuspend, setShowSuspend] = useState(false);
  const [showDelete, setShowDelete]   = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [acting, setActing]           = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await usersAPI.getUserById(id);
      setUser(res.data.user);
    } catch {
      toast.error('Failed to load user');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleSuspend = async () => {
    if (!suspendReason.trim()) { toast.error('Please provide a reason'); return; }
    setActing(true);
    try {
      await usersAPI.suspendUser(id!, suspendReason);
      toast.success('User suspended');
      setShowSuspend(false);
      setSuspendReason('');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to suspend');
    } finally { setActing(false); }
  };

  const handleActivate = async () => {
    setActing(true);
    try {
      await usersAPI.activateUser(id!);
      toast.success('User reactivated');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to activate');
    } finally { setActing(false); }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== 'DELETE') { toast.error('Type DELETE to confirm'); return; }
    setActing(true);
    try {
      await usersAPI.deleteUser(id!);
      toast.success('User deleted');
      navigate('/users');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to delete');
    } finally { setActing(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="xl" showLabel /></div>;
  if (!user)   return <div className="text-center py-20"><p className="text-gray-500">User not found.</p><Button className="mt-4" onClick={() => navigate('/users')}>Back</Button></div>;

  const wallet    = (user as any)?.wallet;
  const adminDept = (user as any)?.adminDepartment as string | null;
  // FIX: removed unused 'isAdminAccount' variable

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/users')}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-lg">
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{user.firstName} {user.lastName}</h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <Badge variant="default">{USER_ROLES[user.role as keyof typeof USER_ROLES] ?? user.role}</Badge>
                {adminDept && <Badge variant="info">{DEPT_LABELS[adminDept] ?? adminDept}</Badge>}
                {user.isSuspended && <Badge variant="error">Suspended</Badge>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {user.isSuspended ? (
            <Button variant="success" loading={acting} onClick={handleActivate}>
              <CheckCircle className="h-4 w-4" />Reactivate
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setShowSuspend(true)}>
              <XCircle className="h-4 w-4" />Suspend
            </Button>
          )}
          {isSuperAdmin && user.role !== 'SUPER_ADMIN' && (
            <Button variant="danger" onClick={() => setShowDelete(true)}>
              <Trash2 className="h-4 w-4" />Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><User className="h-4 w-4 text-primary-500" />Contact Information</h3>
            <InfoRow icon={<Mail className="h-4 w-4" />}     label="Email"   value={user.email} />
            <InfoRow icon={<Phone className="h-4 w-4" />}    label="Phone"   value={user.phone} />
            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Joined"  value={formatDateTime(user.createdAt)} />
            <InfoRow icon={<Shield className="h-4 w-4" />}   label="Role"    value={USER_ROLES[user.role as keyof typeof USER_ROLES] ?? user.role} />
            {adminDept && (
              <InfoRow icon={<Shield className="h-4 w-4" />} label="Department" value={DEPT_LABELS[adminDept] ?? adminDept} />
            )}
            <InfoRow icon={<User className="h-4 w-4" />}     label="User ID" value={<span className="font-mono text-xs">{user.id}</span>} />
          </Card>

          {(user as any)._count && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Activity</h3>
              {(user as any)._count.customerRides > 0     && <InfoRow icon={<User className="h-4 w-4" />} label="Rides taken"      value={(user as any)._count.customerRides} />}
              {(user as any)._count.driverRides > 0       && <InfoRow icon={<User className="h-4 w-4" />} label="Rides driven"     value={(user as any)._count.driverRides} />}
              {(user as any)._count.customerDeliveries > 0 && <InfoRow icon={<User className="h-4 w-4" />} label="Deliveries sent"  value={(user as any)._count.customerDeliveries} />}
              {(user as any)._count.partnerDeliveries > 0  && <InfoRow icon={<User className="h-4 w-4" />} label="Deliveries made"  value={(user as any)._count.partnerDeliveries} />}
              {(user as any)._count.payments > 0           && <InfoRow icon={<DollarSign className="h-4 w-4" />} label="Payments" value={(user as any)._count.payments} />}
            </Card>
          )}

          {user.isSuspended && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />Suspension Details
              </h3>
              <InfoRow icon={<AlertTriangle className="h-4 w-4 text-red-400" />} label="Reason"       value={user.suspensionReason ?? '—'} />
              {user.suspendedAt && <InfoRow icon={<Calendar className="h-4 w-4" />}                  label="Suspended at" value={formatDateTime(user.suspendedAt)} />}
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Account Status</h3>
            <InfoRow icon={<CheckCircle className="h-4 w-4" />} label="Active"    value={<Badge variant={user.isActive ? 'success' : 'error'}>{user.isActive ? 'Active' : 'Inactive'}</Badge>} />
            <InfoRow icon={<CheckCircle className="h-4 w-4" />} label="Verified"  value={<Badge variant={user.isVerified ? 'success' : 'warning'}>{user.isVerified ? 'Verified' : 'Unverified'}</Badge>} />
            <InfoRow icon={<XCircle className="h-4 w-4" />}     label="Suspended" value={<Badge variant={user.isSuspended ? 'error' : 'default'}>{user.isSuspended ? 'Yes' : 'No'}</Badge>} />
          </Card>

          {wallet && (
            <Card>
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><DollarSign className="h-4 w-4 text-green-500" />Wallet</h3>
              <div className="text-center py-3">
                <p className="text-3xl font-bold text-gray-900">₦{wallet.balance?.toLocaleString('en-NG') ?? '0'}</p>
                <p className="text-xs text-gray-500 mt-1">{wallet.currency ?? 'NGN'}</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Modal isOpen={showSuspend} onClose={() => setShowSuspend(false)} title="Suspend User" size="md"
        footer={<>
          <Button variant="outline" onClick={() => setShowSuspend(false)}>Cancel</Button>
          <Button variant="danger" loading={acting} onClick={handleSuspend}>Confirm Suspend</Button>
        </>}
      >
        <div className="space-y-4">
          <Alert variant="warning">The user will be notified and immediately locked out of their account.</Alert>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason <span className="text-red-500">*</span></label>
            <textarea rows={3} value={suspendReason} onChange={e => setSuspendReason(e.target.value)}
              placeholder="e.g. Repeated policy violations, fraudulent activity..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
          </div>
        </div>
      </Modal>

      <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title="Delete User Account" size="md"
        footer={<>
          <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
          <Button variant="danger" loading={acting} onClick={handleDelete}>Permanently Delete</Button>
        </>}
      >
        <div className="space-y-4">
          <Alert variant="error">
            This will soft-delete the account and anonymise all personal data. This cannot be undone. Ride and payment history is preserved for audit purposes.
          </Alert>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type <strong>DELETE</strong> to confirm
            </label>
            <input
              type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default UserDetails;