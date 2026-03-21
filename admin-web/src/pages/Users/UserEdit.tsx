// admin-web/src/pages/Users/UserEdit.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { usersAPI } from '@/services/api/users';
import { User } from '@/types';
import { Card, Input, Button, Spinner, Alert } from '@/components/common';
import toast from 'react-hot-toast';
import api from '@/services/api';

const UserEdit: React.FC = () => {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [user, setUser]     = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' });

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await usersAPI.getUserById(id);
      const u   = res.data.user;
      setUser(u);
      setForm({ firstName: u.firstName, lastName: u.lastName, phone: u.phone });
    } catch {
      toast.error('Failed to load user');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('First and last name are required');
      return;
    }
    setSaving(true);
    try {
      // Admin update uses the user.controller updateProfile route via admin
      // Alternatively hit PUT /admin/users/:id if you add that route
      await api.put(`/admin/users/${id}/profile`, {
        firstName: form.firstName.trim(),
        lastName:  form.lastName.trim(),
        phone:     form.phone.trim(),
      });
      toast.success('User updated');
      navigate(`/users/${id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to update');
    } finally { setSaving(false); }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  if (loading) return <div className="flex justify-center py-20"><Spinner size="xl" showLabel /></div>;
  if (!user)   return <div className="text-center py-20"><p className="text-gray-500">User not found.</p></div>;

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate(`/users/${id}`)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-xl font-bold text-gray-900">Edit User — {user.firstName} {user.lastName}</h1>
      </div>

      <Alert variant="info">
        Only name and phone can be edited here. Email changes require the user to go through the verification flow.
      </Alert>

      <Card>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" value={form.firstName} onChange={set('firstName')} required />
            <Input label="Last Name"  value={form.lastName}  onChange={set('lastName')}  required />
          </div>
          <Input label="Phone" type="tel" value={form.phone} onChange={set('phone')} />
          <div className="pt-1">
            <p className="text-xs text-gray-500">Email: <span className="font-mono">{user.email}</span> (read-only)</p>
            <p className="text-xs text-gray-500 mt-0.5">Role: <span className="font-medium">{user.role}</span> (change via create admin)</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => navigate(`/users/${id}`)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save Changes</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default UserEdit;