import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Shield } from 'lucide-react';
import { Card, Button, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge, Modal, Input, Select } from '@/components/common';
import toast from 'react-hot-toast';

interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'ADMIN' | 'SUPER_ADMIN' | 'MODERATOR' | 'SUPPORT';
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

const AdminUsers: React.FC = () => {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'ADMIN',
  });

  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    // Mock data - replace with actual API call
    setAdmins([
      {
        id: '1',
        firstName: 'John',
        lastName: 'Admin',
        email: 'admin@duoride.com',
        role: 'SUPER_ADMIN',
        isActive: true,
        lastLoginAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const handleCreate = async () => {
    try {
      // API call to create admin
      toast.success('Admin user created successfully');
      setShowCreateModal(false);
      loadAdmins();
    } catch (error) {
      toast.error('Failed to create admin user');
    }
  };

  const handleUpdate = async () => {
    try {
      // API call to update admin
      toast.success('Admin user updated successfully');
      setShowEditModal(false);
      loadAdmins();
    } catch (error) {
      toast.error('Failed to update admin user');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this admin user?')) {
      try {
        // API call to delete admin
        toast.success('Admin user deleted');
        loadAdmins();
      } catch (error) {
        toast.error('Failed to delete admin user');
      }
    }
  };

  const roleOptions = [
    { value: 'ADMIN', label: 'Admin' },
    { value: 'SUPER_ADMIN', label: 'Super Admin' },
    { value: 'MODERATOR', label: 'Moderator' },
    { value: 'SUPPORT', label: 'Support' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Users</h1>
          <p className="text-gray-600 mt-1">Manage admin access and permissions</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Admin User
        </Button>
      </div>

      <Card padding={false}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((admin) => (
              <TableRow key={admin.id}>
                <TableCell>
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white font-medium">
                      {admin.firstName[0]}{admin.lastName[0]}
                    </div>
                    <div className="ml-3">
                      <div className="font-medium">{admin.firstName} {admin.lastName}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{admin.email}</TableCell>
                <TableCell>
                  <Badge variant={admin.role === 'SUPER_ADMIN' ? 'success' : 'default'}>
                    <Shield className="h-3 w-3 mr-1" />
                    {admin.role.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={admin.isActive ? 'success' : 'error'}>
                    {admin.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {admin.lastLoginAt 
                    ? new Date(admin.lastLoginAt).toLocaleDateString()
                    : 'Never'}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedAdmin(admin);
                        setShowEditModal(true);
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDelete(admin.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add Admin User"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create Admin</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
            />
            <Input
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              required
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          <Input
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />
          <Select
            label="Role"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            options={roleOptions}
          />
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Admin User"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Update Admin</Button>
          </>
        }
      >
        {selectedAdmin && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name"
                defaultValue={selectedAdmin.firstName}
                required
              />
              <Input
                label="Last Name"
                defaultValue={selectedAdmin.lastName}
                required
              />
            </div>
            <Input
              label="Email"
              type="email"
              defaultValue={selectedAdmin.email}
              required
            />
            <Select
              label="Role"
              defaultValue={selectedAdmin.role}
              options={roleOptions}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminUsers;