// admin-web/src/pages/Users/UserEdit.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { usersAPI } from '@/services/api/users';
import { User, Driver, DeliveryPartner } from '@/types';
import { Card, Input, Button, Spinner, Alert } from '@/components/common';
import toast from 'react-hot-toast';
import api from '@/services/api';

// Extended user type including optional driver/partner profiles (returned by admin user detail)
interface UserWithProfiles extends User {
  driverProfile?: Driver;
  deliveryPartnerProfile?: DeliveryPartner;
}

const VEHICLE_TYPES = ['BIKE', 'CAR', 'MOTORCYCLE', 'VAN', 'TRICYCLE'];

const VEHICLE_SUB_TYPES: Record<string, string[]> = {
  CAR:        ['Sedan', 'SUV', 'Hatchback', 'Minivan', 'Coupe'],
  VAN:        ['Panel Van', 'Minibus', 'Pickup Truck', 'Box Truck'],
  MOTORCYCLE: ['Standard', 'Scooter', 'Sport', 'Cruiser'],
  BIKE:       ['Road Bike', 'Mountain Bike', 'Cargo Bike'],
  TRICYCLE:   ['Keke Napep', 'Cargo Tricycle'],
};

const UserEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<UserWithProfiles | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Basic fields
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
  });

  // Driver fields (only used if role === DRIVER)
  const [driverForm, setDriverForm] = useState({
    licenseNumber: '',
    vehicleType: 'CAR',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    vehicleColor: '',
    vehiclePlate: '',
    numberOfSeats: '',
    vehicleSubType: '',
  });

  // Partner fields (only used if role === DELIVERY_PARTNER)
  const [partnerForm, setPartnerForm] = useState({
    vehicleType: 'MOTORCYCLE',
    vehiclePlate: '',
  });

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await usersAPI.getUserById(id);
      const u = res.data.user as UserWithProfiles;
      setUser(u);
      setForm({ firstName: u.firstName, lastName: u.lastName, phone: u.phone });

      // Populate driver fields if present
      if (u.driverProfile) {
        const d = u.driverProfile;
        setDriverForm({
          licenseNumber: d.licenseNumber || '',
          vehicleType: d.vehicleType || 'CAR',
          vehicleMake: d.vehicleMake || '',
          vehicleModel: d.vehicleModel || '',
          vehicleYear: d.vehicleYear ? String(d.vehicleYear) : '',
          vehicleColor: d.vehicleColor || '',
          vehiclePlate: d.vehiclePlate || '',
          numberOfSeats: d.numberOfSeats ? String(d.numberOfSeats) : '',
          vehicleSubType: d.vehicleSubType || '',
        });
      }

      // Populate partner fields if present
      if (u.deliveryPartnerProfile) {
        const p = u.deliveryPartnerProfile;
        setPartnerForm({
          vehicleType: p.vehicleType || 'MOTORCYCLE',
          vehiclePlate: p.vehiclePlate || '',
        });
      }
    } catch {
      toast.error('Failed to load user');
    } finally {
      setLoading(false);
    }
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
      // Build payload – the backend admin route should accept these extra fields
      const payload: any = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
      };

      if (user?.role === 'DRIVER') {
        const year = parseInt(driverForm.vehicleYear, 10);
        payload.driverData = {
          licenseNumber: driverForm.licenseNumber.trim().toUpperCase(),
          vehicleType: driverForm.vehicleType,
          vehicleMake: driverForm.vehicleMake.trim(),
          vehicleModel: driverForm.vehicleModel.trim(),
          vehicleYear: isNaN(year) ? undefined : year,
          vehicleColor: driverForm.vehicleColor.trim(),
          vehiclePlate: driverForm.vehiclePlate.trim().toUpperCase(),
          numberOfSeats: driverForm.numberOfSeats ? parseInt(driverForm.numberOfSeats, 10) : undefined,
          vehicleSubType: driverForm.vehicleSubType || undefined,
        };
      }

      if (user?.role === 'DELIVERY_PARTNER') {
        payload.partnerData = {
          vehicleType: partnerForm.vehicleType,
          vehiclePlate: partnerForm.vehiclePlate.trim().toUpperCase() || undefined,
        };
      }

      // Uses the same profile update endpoint – the backend should handle driver/partner data if present
      await api.put(`/admin/users/${id}/profile`, payload);
      toast.success('User updated');
      navigate(`/users/${id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const setBasic = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const setDriver = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDriverForm(f => ({ ...f, [field]: e.target.value }));

  const setPartner = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setPartnerForm(f => ({ ...f, [field]: e.target.value }));

  if (loading) return <div className="flex justify-center py-20"><Spinner size="xl" showLabel /></div>;
  if (!user) return <div className="text-center py-20"><p className="text-gray-500">User not found.</p></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate(`/users/${id}`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-gray-900">
          Edit {user.role === 'DRIVER' ? 'Driver' : user.role === 'DELIVERY_PARTNER' ? 'Partner' : 'User'} — {user.firstName} {user.lastName}
        </h1>
      </div>

      <Alert variant="info">
        Only name, phone, and vehicle details can be edited here. Email and role changes require verification or admin intervention.
      </Alert>

      <Card>
        <form onSubmit={handleSave} className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" value={form.firstName} onChange={setBasic('firstName')} required />
            <Input label="Last Name" value={form.lastName} onChange={setBasic('lastName')} required />
          </div>
          <Input label="Phone" type="tel" value={form.phone} onChange={setBasic('phone')} />

          <div className="pt-1">
            <p className="text-xs text-gray-500">Email: <span className="font-mono">{user.email}</span> (read-only)</p>
            <p className="text-xs text-gray-500 mt-0.5">Role: <span className="font-medium">{user.role}</span></p>
          </div>

          {/* ── Driver fields ── */}
          {user.role === 'DRIVER' && (
            <div className="border-t pt-4 mt-2">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Driver & Vehicle Details</h2>

              <Input
                label="Licence Number"
                value={driverForm.licenseNumber}
                onChange={setDriver('licenseNumber')}
                placeholder="e.g. ABC123456"
                required
              />

              {/* Vehicle Type */}
              <label className="block text-sm font-medium text-gray-700 mt-4 mb-1">Vehicle Type</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {VEHICLE_TYPES.map(vt => (
                  <button
                    key={vt}
                    type="button"
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                      driverForm.vehicleType === vt
                        ? 'bg-primary-100 border-primary-500 text-primary-700'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}
                    onClick={() => setDriverForm(f => ({ ...f, vehicleType: vt, vehicleSubType: '' }))}
                  >
                    {vt}
                  </button>
                ))}
              </div>

              {/* Sub-type */}
              {VEHICLE_SUB_TYPES[driverForm.vehicleType]?.length > 0 && (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Sub‑type (optional)</label>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {VEHICLE_SUB_TYPES[driverForm.vehicleType].map(st => (
                      <button
                        key={st}
                        type="button"
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                          driverForm.vehicleSubType === st
                            ? 'bg-primary-100 border-primary-500 text-primary-700'
                            : 'border-gray-300 text-gray-600 hover:border-gray-400'
                        }`}
                        onClick={() => setDriverForm(f => ({ ...f, vehicleSubType: st }))}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Input label="Make" value={driverForm.vehicleMake} onChange={setDriver('vehicleMake')} placeholder="Toyota" required />
                <Input label="Model" value={driverForm.vehicleModel} onChange={setDriver('vehicleModel')} placeholder="Camry" required />
                <Input label="Year" value={driverForm.vehicleYear} onChange={setDriver('vehicleYear')} placeholder="2019" type="number" required />
                <Input label="Colour" value={driverForm.vehicleColor} onChange={setDriver('vehicleColor')} placeholder="Black" required />
                <Input label="Plate Number" value={driverForm.vehiclePlate} onChange={setDriver('vehiclePlate')} placeholder="ABC123XY" required />
                {(driverForm.vehicleType === 'CAR' || driverForm.vehicleType === 'VAN') && (
                  <Input label="Number of Seats" value={driverForm.numberOfSeats} onChange={setDriver('numberOfSeats')} placeholder="5" type="number" />
                )}
              </div>
            </div>
          )}

          {/* ── Delivery Partner fields ── */}
          {user.role === 'DELIVERY_PARTNER' && (
            <div className="border-t pt-4 mt-2">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Partner Vehicle Details</h2>

              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
              <div className="flex flex-wrap gap-2 mb-4">
                {VEHICLE_TYPES.map(vt => (
                  <button
                    key={vt}
                    type="button"
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                      partnerForm.vehicleType === vt
                        ? 'bg-primary-100 border-primary-500 text-primary-700'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}
                    onClick={() => setPartnerForm(f => ({ ...f, vehicleType: vt }))}
                  >
                    {vt}
                  </button>
                ))}
              </div>

              <Input
                label="Vehicle Plate (optional)"
                value={partnerForm.vehiclePlate}
                onChange={setPartner('vehiclePlate')}
                placeholder="ABC123XY"
              />
            </div>
          )}

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