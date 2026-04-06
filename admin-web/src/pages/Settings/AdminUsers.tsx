// admin-web/src/pages/Settings/AdminUsers.tsx
import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Shield } from 'lucide-react';
import { Card, Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, Modal, Input, Select } from '@/components/common';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'ADMIN' | 'SUPER_ADMIN' | 'MODERATOR' | 'SUPPORT';
  adminDepartment: 'RIDES' | 'DELIVERIES' | 'SUPPORT' | null;
  isActive: boolean;
  createdAt: string;
}

const AdminUsers: React.FC = () => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    role: 'ADMIN',
    adminDepartment: '',
  });

  useEffect(() => { loadAdmins(); }, []);

  const loadAdmins = async () => {
    setLoading(true);
    try {
      // Fetch all non-customer roles
      const res = await api.get('/admin/users', {
        params: { limit: 100, role: 'ADMIN' },
      });
      // Backend returns all users filtered by role param — fetch each role
      const [admins, superAdmins, moderators, supports] = await Promise.all([
        api.get('/admin/users', { params: { limit: 100, role: 'ADMIN'        } }),
        api.get('/admin/users', { params: { limit: 100, role: 'SUPER_ADMIN'  } }),
        api.get('/admin/users', { params: { limit: 100, role: 'MODERATOR'    } }),
        api.get('/admin/users', { params: { limit: 100, role: 'SUPPORT'      } }),
      ]);
      const all = [
        ...admins.data.data.users,
        ...superAdmins.data.data.users,
        ...moderators.data.data.users,
        ...supports.data.data.users,
      ];
      setAdmins(all);
    } catch {
      toast.error('Failed to load admin users');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => setFormData({
    firstName: '', lastName: '', email: '', phone: '',
    password: '', role: 'ADMIN', adminDepartment: '',
  });

  const handleCreate = async () => {
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.password) {
      toast.error('All fields are required'); return;
    }
    setSaving(true);
    try {
      await api.post('/admin/users/create-admin', {
        firstName:       formData.firstName,
        lastName:        formData.lastName,
        email:           formData.email,
        phone:           formData.phone,
        password:        formData.password,
        role:            formData.role,
        adminDepartment: formData.adminDepartment || undefined,
      });
      toast.success('Admin user created successfully');
      setShowCreateModal(false);
      resetForm();
      loadAdmins();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create admin user');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this admin user? This action cannot be undone.')) return;
    try {
      await api.delete(`/admin/users/${id}`);
      toast.success('Admin user deleted');
      setAdmins(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete admin user');
    }
  };

  const handleSuspend = async (admin: AdminUser) => {
    const action = admin.isActive ? 'suspend' : 'activate';
    if (!confirm(`${action === 'suspend' ? 'Suspend' : 'Reactivate'} ${admin.firstName} ${admin.lastName}?`)) return;
    try {
      if (action === 'suspend') {
        await api.put(`/admin/users/${admin.id}/suspend`, { reason: 'Suspended by super admin' });
      } else {
        await api.put(`/admin/users/${admin.id}/activate`);
      }
      toast.success(`User ${action === 'suspend' ? 'suspended' : 'reactivated'}`);
      loadAdmins();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || `Failed to ${action} user`);
    }
  };

  const roleOptions = [
    { value: 'ADMIN',     label: 'Admin'      },
    { value: 'MODERATOR', label: 'Moderator'  },
    { value: 'SUPPORT',   label: 'Support'    },
  ];

  const departmentOptions = [
    { value: '',            label: 'General (all access)' },
    { value: 'RIDES',       label: 'Rides only'           },
    { value: 'DELIVERIES',  label: 'Deliveries only'      },
    { value: 'SUPPORT',     label: 'Support only'         },
  ];

  const roleVariant = (role: string) => {
    if (role === 'SUPER_ADMIN') return 'success';
    if (role === 'MODERATOR')   return 'warning';
    if (role === 'SUPPORT')     return 'info';
    return 'default';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Users</h1>
          <p className="text-gray-600 mt-1">Manage admin access and permissions</p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreateModal(true); }}>
          <Plus className="h-4 w-4 mr-2" />Add Admin User
        </Button>
      </div>

      <Card padding={false}>
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400 animate-pulse">Loading…</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-400 py-8">
                    No admin users found.
                  </TableCell>
                </TableRow>
              )}
              {admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-semibold text-sm">
                        {admin.firstName[0]}{admin.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{admin.firstName} {admin.lastName}</p>
                        <p className="text-xs text-gray-400">{admin.phone}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{admin.email}</TableCell>
                  <TableCell>
                    <Badge variant={roleVariant(admin.role)}>
                      <Shield className="h-3 w-3 mr-1" />
                      {admin.role.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-gray-500">
                      {admin.adminDepartment ?? 'General'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={admin.isActive ? 'success' : 'error'}>
                      {admin.isActive ? 'Active' : 'Suspended'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline"
                        onClick={() => handleSuspend(admin)}
                        title={admin.isActive ? 'Suspend' : 'Reactivate'}>
                        {admin.isActive ? '⏸' : '▶'}
                      </Button>
                      <Button size="sm" variant="danger"
                        onClick={() => handleDelete(admin.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add Admin User"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleCreate}>Create Admin</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" value={formData.firstName}
              onChange={e => setFormData(f => ({ ...f, firstName: e.target.value }))} required />
            <Input label="Last Name" value={formData.lastName}
              onChange={e => setFormData(f => ({ ...f, lastName: e.target.value }))} required />
          </div>
          <Input label="Email" type="email" value={formData.email}
            onChange={e => setFormData(f => ({ ...f, email: e.target.value }))} required />
          <Input label="Phone" value={formData.phone}
            onChange={e => setFormData(f => ({ ...f, phone: e.target.value }))}
            hint="e.g. +2348012345678" required />
          <Input label="Password" type="password" value={formData.password}
            onChange={e => setFormData(f => ({ ...f, password: e.target.value }))}
            hint="Minimum 8 characters" required />
          <Select label="Role" value={formData.role}
            onChange={e => setFormData(f => ({ ...f, role: e.target.value }))}
            options={roleOptions} />
          <Select label="Department Scope" value={formData.adminDepartment}
            onChange={e => setFormData(f => ({ ...f, adminDepartment: e.target.value }))}
            options={departmentOptions} />
          <p className="text-xs text-gray-400">
            General admins can access all sections. Scoped admins only see their department.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default AdminUsers;