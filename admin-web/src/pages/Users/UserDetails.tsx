// admin-web/src/pages/Users/UserDetails.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Calendar, Shield } from 'lucide-react';
import { usersAPI } from '@/services/api/users';
import { User } from '@/types';
import { Card, Button, Badge, Modal } from '@/components/common';
import { formatDateTime } from '@/utils/helpers';
import { USER_ROLES } from '@/utils/constants';
import toast from 'react-hot-toast';

const UserDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');

  useEffect(() => {
    if (id) loadUser();
  }, [id]);

  const loadUser = async () => {
    try {
      const response = await usersAPI.getUserById(id!);
      setUser(response.data.user);
    } catch (error) {
      toast.error('Failed to load user');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (!suspendReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    try {
      await usersAPI.suspendUser(id!, suspendReason);
      toast.success('User suspended');
      setShowSuspendModal(false);
      loadUser();
    } catch (error) {
      toast.error('Failed to suspend user');
    }
  };

  const handleActivate = async () => {
    try {
      await usersAPI.activateUser(id!);
      toast.success('User activated');
      loadUser();
    } catch (error) {
      toast.error('Failed to activate user');
    }
  };

  if (loading || !user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/users')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Details</h1>
            <p className="text-gray-600 mt-1">{user.firstName} {user.lastName}</p>
          </div>
        </div>

        <div className="flex space-x-2">
          {user.isSuspended ? (
            <Button variant="success" onClick={handleActivate}>
              Activate User
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setShowSuspendModal(true)}>
              Suspend User
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Info */}
        <Card className="lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">User Information</h3>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <Mail className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium">{user.email}</p>
              </div>
            </div>

            <div className="flex items-center">
              <Phone className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <p className="font-medium">{user.phone}</p>
              </div>
            </div>

            <div className="flex items-center">
              <Shield className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Role</p>
                <p className="font-medium">{USER_ROLES[user.role]}</p>
              </div>
            </div>

            <div className="flex items-center">
              <Calendar className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Joined</p>
                <p className="font-medium">{formatDateTime(user.createdAt)}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Status Card */}
        <Card>
          <h3 className="text-lg font-semibold mb-4">Status</h3>
          
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600 mb-1">Account Status</p>
              <Badge variant={user.isActive ? 'success' : 'error'}>
                {user.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-1">Verification</p>
              <Badge variant={user.isVerified ? 'success' : 'warning'}>
                {user.isVerified ? 'Verified' : 'Unverified'}
              </Badge>
            </div>

            {user.isSuspended && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Suspension</p>
                <Badge variant="error">Suspended</Badge>
                {user.suspensionReason && (
                  <p className="text-sm text-gray-600 mt-2">
                    Reason: {user.suspensionReason}
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Suspend Modal */}
      <Modal
        isOpen={showSuspendModal}
        onClose={() => setShowSuspendModal(false)}
        title="Suspend User"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowSuspendModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleSuspend}>
              Suspend
            </Button>
          </>
        }
      >
        <div>
          <p className="text-gray-600 mb-4">
            Please provide a reason for suspending this user.
          </p>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            rows={4}
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            placeholder="Enter suspension reason..."
          />
        </div>
      </Modal>
    </div>
  );
};

export default UserDetails;