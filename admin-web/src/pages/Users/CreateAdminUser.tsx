// admin-web/src/pages/Users/CreateAdminUser.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Info } from 'lucide-react';
import { usersAPI } from '@/services/api/users';
import { Card, Input, Select, Button, Alert } from '@/components/common';
import toast from 'react-hot-toast';

// Department descriptions shown in UI
const DEPT_INFO: Record<string, { label: string; description: string; color: string }> = {
  '': {
    label: 'General Admin',
    description: 'Full access to all admin sections — drivers, partners, rides, deliveries, analytics, settings.',
    color: 'bg-primary-50 border-primary-200 text-primary-800',
  },
  RIDES: {
    label: 'Rides & Drivers Admin',
    description: 'Can manage drivers, approve/reject driver applications, view and manage rides. Cannot access partners, deliveries, or financial settings.',
    color: 'bg-blue-50 border-blue-200 text-blue-800',
  },
  DELIVERIES: {
    label: 'Deliveries & Partners Admin',
    description: 'Can manage delivery partners, approve/reject partner applications, view and manage deliveries. Cannot access drivers, rides, or financial settings.',
    color: 'bg-amber-50 border-amber-200 text-amber-800',
  },
  SUPPORT: {
    label: 'Support Agent',
    description: 'Can view and respond to support tickets. Read-only access to user profiles and ride/delivery history for context. Cannot modify user accounts or financial data.',
    color: 'bg-green-50 border-green-200 text-green-800',
  },
};

const CreateAdminUser: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName:       '',
    lastName:        '',
    email:           '',
    phone:           '',
    password:        '',
    confirmPassword: '',
    role:            'ADMIN' as 'ADMIN' | 'SUPPORT' | 'MODERATOR',
    adminDepartment: '' as '' | 'RIDES' | 'DELIVERIES' | 'SUPPORT',
  });

  const dept = form.role === 'SUPPORT' ? 'SUPPORT' : form.adminDepartment;
  const deptInfo = DEPT_INFO[dept] ?? DEPT_INFO[''];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await usersAPI.createAdminUser({
        firstName:       form.firstName,
        lastName:        form.lastName,
        email:           form.email,
        phone:           form.phone,
        password:        form.password,
        role:            form.role,
        adminDepartment: form.role === 'SUPPORT'
          ? 'SUPPORT'
          : (form.adminDepartment || null) as any,
      });
      toast.success(`${form.role} account created successfully`);
      navigate('/users');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate('/users')}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Create Admin / Staff Account</h1>
          <p className="text-sm text-gray-500 mt-0.5">Super admin access required</p>
        </div>
      </div>

      {/* Department preview card */}
      <div className={`p-4 rounded-xl border ${deptInfo.color}`}>
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <Shield className="h-4 w-4" />{deptInfo.label}
        </p>
        <p className="text-xs mt-1 opacity-80">{deptInfo.description}</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" value={form.firstName} onChange={set('firstName')} required />
            <Input label="Last Name"  value={form.lastName}  onChange={set('lastName')  } required />
          </div>

          {/* Contact */}
          <Input label="Email"    type="email" value={form.email} onChange={set('email')} required />
          <Input label="Phone"    type="tel"   value={form.phone} onChange={set('phone')} required placeholder="+234..." />

          {/* Password */}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Password"         type="password" value={form.password}        onChange={set('password')}        required hint="Min 8 characters" />
            <Input label="Confirm Password" type="password" value={form.confirmPassword} onChange={set('confirmPassword')} required />
          </div>

          {/* Role */}
          <Select
            label="Role"
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value as any, adminDepartment: e.target.value === 'SUPPORT' ? '' : f.adminDepartment }))}
            options={[
              { value: 'ADMIN',     label: 'Admin' },
              { value: 'SUPPORT',   label: 'Support Agent' },
              { value: 'MODERATOR', label: 'Moderator' },
            ]}
          />

          {/* Department — only for ADMIN role */}
          {form.role === 'ADMIN' && (
            <Select
              label="Department (Access Scope)"
              value={form.adminDepartment}
              onChange={set('adminDepartment')}
              hint="Leave blank for full admin access"
              options={[
                { value: '',           label: 'General Admin (full access)' },
                { value: 'RIDES',      label: 'Rides & Drivers only' },
                { value: 'DELIVERIES', label: 'Deliveries & Partners only' },
              ]}
            />
          )}

          {form.role === 'SUPPORT' && (
            <Alert variant="info">
              Support agents can view and respond to tickets and have read-only access to user profiles and order history.
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => navigate('/users')}>Cancel</Button>
            <Button type="submit" loading={loading}>Create Account</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default CreateAdminUser;