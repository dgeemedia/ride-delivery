// ─────────────────────────────────────────────────────────────────────────────
// admin-web/src/pages/Users/CreateAdminUser.tsx
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Eye, EyeOff } from 'lucide-react';
import { usersAPI } from '@/services/api/users';
import { Card, Input, Select, Button, Alert } from '@/components/common';
import toast from 'react-hot-toast';

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

// ─────────────────────────────────────────────────────────────────────────────
// PasswordInput — wraps the shared Input component and adds an eye-toggle.
// Defined at module scope so React never remounts it mid-render (avoids
// losing focus on every keystroke).
// ─────────────────────────────────────────────────────────────────────────────

interface PasswordInputProps {
  label:    string;
  value:    string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  hint?:    string;
  required?: boolean;
}

const PasswordInput: React.FC<PasswordInputProps> = ({ label, value, onChange, hint, required }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        label={label}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        hint={hint}
        required={required}
      />
      {/* Eye button sits inside the input's right edge.
          top-[34px] targets the centre of a standard 36px input
          that sits below a 20px label + 6px gap. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-[34px] -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

const CreateAdminUser: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    password: '', confirmPassword: '',
    role: 'ADMIN' as 'SUPER_ADMIN'|'ADMIN'|'SUPPORT'|'MODERATOR'|'CUSTOMER'|'DRIVER'|'DELIVERY_PARTNER',
    adminDepartment: '' as ''|'RIDES'|'DELIVERIES'|'SUPPORT',
    // Driver fields
    licenseNumber: '', vehicleType: '' as ''|'BIKE'|'CAR'|'MOTORCYCLE'|'VAN'|'TRICYCLE',
    vehicleMake: '', vehicleModel: '', vehicleYear: '',
    vehicleColor: '', vehiclePlate: '',
  });

  const dept = form.role === 'SUPPORT' || !['ADMIN', 'SUPER_ADMIN'].includes(form.role)
    ? (form.role === 'SUPPORT' ? 'SUPPORT' : '')
    : form.adminDepartment;
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
    if (form.role === 'DRIVER') {
      if (!form.licenseNumber || !form.vehicleType || !form.vehicleMake ||
          !form.vehicleModel  || !form.vehicleYear || !form.vehicleColor || !form.vehiclePlate) {
        toast.error('All vehicle fields are required for drivers');
        return;
      }
    }
    if (form.role === 'DELIVERY_PARTNER' && !form.vehicleType) {
      toast.error('Vehicle type is required for delivery partners');
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
          : ['ADMIN','SUPER_ADMIN'].includes(form.role)
          ? (form.adminDepartment || null) as any
          : null,
        // Vehicle fields — backend ignores these for non-driver/partner roles
        ...(form.role === 'DRIVER' && {
          licenseNumber: form.licenseNumber,
          vehicleType:   (form.vehicleType || undefined) as 'BIKE'|'CAR'|'MOTORCYCLE'|'VAN'|'TRICYCLE'|undefined,
          vehicleMake:   form.vehicleMake,
          vehicleModel:  form.vehicleModel,
          vehicleYear:   form.vehicleYear,
          vehicleColor:  form.vehicleColor,
          vehiclePlate:  form.vehiclePlate,
        }),
        ...(form.role === 'DELIVERY_PARTNER' && {
          vehicleType:  (form.vehicleType || undefined) as 'BIKE'|'CAR'|'MOTORCYCLE'|'VAN'|'TRICYCLE'|undefined,
          vehiclePlate: form.vehiclePlate || undefined,
        }),
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

      <div className={`p-4 rounded-xl border ${deptInfo.color}`}>
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <Shield className="h-4 w-4" />{deptInfo.label}
        </p>
        <p className="text-xs mt-1 opacity-80">{deptInfo.description}</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" value={form.firstName} onChange={set('firstName')} required />
            <Input label="Last Name"  value={form.lastName}  onChange={set('lastName')}  required />
          </div>
          <Input label="Email" type="email" value={form.email} onChange={set('email')} required />
          <Input label="Phone" type="tel"   value={form.phone} onChange={set('phone')} required placeholder="+234..." />

          {/* ── Password row with eye toggles ─────────────────────────── */}
          <div className="grid grid-cols-2 gap-4">
            <PasswordInput
              label="Password"
              value={form.password}
              onChange={set('password')}
              hint="Min 8 characters"
              required
            />
            <PasswordInput
              label="Confirm Password"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              required
            />
          </div>

          <Select
            label="Role"
            value={form.role}
            onChange={e => setForm(f => ({
              ...f,
              role: e.target.value as any,
              adminDepartment: e.target.value === 'SUPPORT' ? '' : f.adminDepartment,
            }))}
            options={[
              { value: 'SUPER_ADMIN',      label: 'Super Admin'       },
              { value: 'ADMIN',            label: 'Admin'             },
              { value: 'SUPPORT',          label: 'Support Agent'     },
              { value: 'MODERATOR',        label: 'Moderator'         },
              { value: 'CUSTOMER',         label: 'Customer'          },
              { value: 'DRIVER',           label: 'Driver'            },
              { value: 'DELIVERY_PARTNER', label: 'Delivery Partner'  },
            ]}
          />

          {['ADMIN', 'SUPER_ADMIN'].includes(form.role) && (
            <Select
              label="Department (Access Scope)"
              value={form.adminDepartment}
              onChange={set('adminDepartment')}
              hint="Leave blank for full admin access"
              options={[
                { value: '',           label: 'General Admin (full access)' },
                { value: 'RIDES',      label: 'Rides & Drivers only'        },
                { value: 'DELIVERIES', label: 'Deliveries & Partners only'  },
              ]}
            />
          )}

          {form.role === 'SUPPORT' && (
            <Alert variant="info">
              Support agents can view and respond to tickets and have read-only access to user profiles and order history.
            </Alert>
          )}

          {form.role === 'DRIVER' && (
            <div className="space-y-4 border border-blue-200 bg-blue-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-800">Vehicle & License Details</p>
              <div className="grid grid-cols-2 gap-4">
                <Input label="License Number"       value={form.licenseNumber} onChange={set('licenseNumber')} required />
                <Select label="Vehicle Type"        value={form.vehicleType}   onChange={set('vehicleType')}
                  options={[
                    { value: '',           label: 'Select type' },
                    { value: 'CAR',        label: 'Car'         },
                    { value: 'BIKE',       label: 'Bike'        },
                    { value: 'MOTORCYCLE', label: 'Motorcycle'  },
                    { value: 'VAN',        label: 'Van'         },
                    { value: 'TRICYCLE',   label: 'Tricycle'    },
                  ]}
                />
                <Input label="Make (e.g. Toyota)"   value={form.vehicleMake}  onChange={set('vehicleMake')}  required />
                <Input label="Model (e.g. Corolla)" value={form.vehicleModel} onChange={set('vehicleModel')} required />
                <Input label="Year"   type="number" value={form.vehicleYear}  onChange={set('vehicleYear')}  required />
                <Input label="Color"                value={form.vehicleColor} onChange={set('vehicleColor')} required />
                <Input label="Plate Number" className="col-span-2" value={form.vehiclePlate} onChange={set('vehiclePlate')} required />
              </div>
            </div>
          )}

          {form.role === 'DELIVERY_PARTNER' && (
            <div className="space-y-4 border border-amber-200 bg-amber-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-800">Vehicle Details</p>
              <div className="grid grid-cols-2 gap-4">
                <Select label="Vehicle Type" value={form.vehicleType} onChange={set('vehicleType')}
                  options={[
                    { value: '',           label: 'Select type' },
                    { value: 'BIKE',       label: 'Bike'        },
                    { value: 'MOTORCYCLE', label: 'Motorcycle'  },
                    { value: 'CAR',        label: 'Car'         },
                    { value: 'VAN',        label: 'Van'         },
                    { value: 'TRICYCLE',   label: 'Tricycle'    },
                  ]}
                />
                <Input label="Plate Number (optional)" value={form.vehiclePlate} onChange={set('vehiclePlate')} />
              </div>
            </div>
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