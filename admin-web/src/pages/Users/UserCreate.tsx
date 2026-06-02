// admin-web/src/pages/Users/UserCreate.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Input, Select, Button } from '@/components/common';
import { USER_ROLES } from '@/utils/constants';
import toast from 'react-hot-toast';

// Vehicle types (mirrors mobile & backend)
const VEHICLE_TYPES = ['BIKE', 'CAR', 'MOTORCYCLE', 'VAN', 'TRICYCLE'];

// Sub‑types per vehicle type (same as mobile)
const VEHICLE_SUB_TYPES: Record<string, string[]> = {
  CAR:        ['Sedan', 'SUV', 'Hatchback', 'Minivan', 'Coupe'],
  VAN:        ['Panel Van', 'Minibus', 'Pickup Truck', 'Box Truck'],
  MOTORCYCLE: ['Standard', 'Scooter', 'Sport', 'Cruiser'],
  BIKE:       ['Road Bike', 'Mountain Bike', 'Cargo Bike'],
  TRICYCLE:   ['Keke Napep', 'Cargo Tricycle'],
};

const UserCreate: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    // Base fields
    email: '',
    phone: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'CUSTOMER',

    // Driver fields
    licenseNumber: '',
    vehicleType: 'CAR',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    vehicleColor: '',
    vehiclePlate: '',
    numberOfSeats: '',
    vehicleSubType: '',

    // Partner fields
    partnerVehicleType: 'MOTORCYCLE', // separate to avoid conflict with driver's vehicleType
    partnerVehiclePlate: '',
  });

  const handleRoleChange = (role: string) => {
    // Reset vehicle fields when role changes to avoid leaking data
    setFormData(prev => ({
      ...prev,
      role,
      licenseNumber: '',
      vehicleType: 'CAR',
      vehicleMake: '',
      vehicleModel: '',
      vehicleYear: '',
      vehicleColor: '',
      vehiclePlate: '',
      numberOfSeats: '',
      vehicleSubType: '',
      partnerVehicleType: 'MOTORCYCLE',
      partnerVehiclePlate: '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim() || !formData.phone.trim() || !formData.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    const payload: any = {
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      firstName: formData.firstName,
      lastName: formData.lastName,
      role: formData.role,
    };

    if (formData.role === 'DRIVER') {
      // Validate required driver fields
      if (!formData.licenseNumber.trim()) {
        toast.error('Licence number is required for drivers');
        return;
      }
      if (!formData.vehicleMake.trim() || !formData.vehicleModel.trim()) {
        toast.error('Vehicle make and model are required');
        return;
      }
      const year = parseInt(formData.vehicleYear, 10);
      if (!year || year < 1990 || year > new Date().getFullYear() + 1) {
        toast.error('Enter a valid vehicle year');
        return;
      }
      if (!formData.vehicleColor.trim()) {
        toast.error('Vehicle colour is required');
        return;
      }
      if (!formData.vehiclePlate.trim()) {
        toast.error('Vehicle plate number is required');
        return;
      }

      payload.licenseNumber = formData.licenseNumber.trim().toUpperCase();
      payload.vehicleType   = formData.vehicleType;
      payload.vehicleMake   = formData.vehicleMake.trim();
      payload.vehicleModel  = formData.vehicleModel.trim();
      payload.vehicleYear   = year;
      payload.vehicleColor  = formData.vehicleColor.trim();
      payload.vehiclePlate  = formData.vehiclePlate.trim().toUpperCase();
      if (formData.numberOfSeats) {
        payload.numberOfSeats = parseInt(formData.numberOfSeats, 10);
      }
      if (formData.vehicleSubType) {
        payload.vehicleSubType = formData.vehicleSubType;
      }
    }

    if (formData.role === 'DELIVERY_PARTNER') {
      payload.vehicleType   = formData.partnerVehicleType;
      if (formData.partnerVehiclePlate.trim()) {
        payload.vehiclePlate = formData.partnerVehiclePlate.trim().toUpperCase();
      }
    }

    try {
      // API call – uses the same create-admin endpoint
      // e.g. usersAPI.createAdminUser(payload)
      toast.success('User created successfully');
      navigate('/users');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to create user');
    }
  };

  const set = (field: string) => (e: any) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Create New User</h1>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" value={formData.firstName} onChange={set('firstName')} required />
            <Input label="Last Name"  value={formData.lastName}  onChange={set('lastName')}  required />
          </div>
          <Input label="Email"    type="email"    value={formData.email}    onChange={set('email')}    required />
          <Input label="Phone"    type="tel"      value={formData.phone}    onChange={set('phone')}    required />
          <Input label="Password" type="password" value={formData.password} onChange={set('password')} required />

          <Select
            label="Role"
            value={formData.role}
            onChange={(e) => handleRoleChange(e.target.value)}
            options={Object.entries(USER_ROLES).map(([value, label]) => ({ value, label }))}
          />

          {/* ── Driver fields ── */}
          {formData.role === 'DRIVER' && (
            <>
              <div className="border-t pt-4 mt-2">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Driver & Vehicle Details</h2>
                <Input label="Licence Number" value={formData.licenseNumber} onChange={set('licenseNumber')} placeholder="e.g. ABC123456" required />

                {/* Vehicle Type */}
                <label className="block text-sm font-medium text-gray-700 mt-4 mb-1">Vehicle Type</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {VEHICLE_TYPES.map(vt => (
                    <button
                      key={vt}
                      type="button"
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                        formData.vehicleType === vt
                          ? 'bg-primary-100 border-primary-500 text-primary-700'
                          : 'border-gray-300 text-gray-600 hover:border-gray-400'
                      }`}
                      onClick={() => { setFormData(prev => ({ ...prev, vehicleType: vt, vehicleSubType: '' })); }}
                    >
                      {vt}
                    </button>
                  ))}
                </div>

                {/* Sub‑type */}
                {VEHICLE_SUB_TYPES[formData.vehicleType]?.length > 0 && (
                  <>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Sub‑type (optional)</label>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {VEHICLE_SUB_TYPES[formData.vehicleType].map(st => (
                        <button
                          key={st}
                          type="button"
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                            formData.vehicleSubType === st
                              ? 'bg-primary-100 border-primary-500 text-primary-700'
                              : 'border-gray-300 text-gray-600 hover:border-gray-400'
                          }`}
                          onClick={() => setFormData(prev => ({ ...prev, vehicleSubType: st }))}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <Input label="Make"         value={formData.vehicleMake}  onChange={set('vehicleMake')}  placeholder="Toyota" required />
                  <Input label="Model"        value={formData.vehicleModel} onChange={set('vehicleModel')} placeholder="Camry"  required />
                  <Input label="Year"         value={formData.vehicleYear}  onChange={set('vehicleYear')}  placeholder="2019"  type="number" required />
                  <Input label="Colour"       value={formData.vehicleColor} onChange={set('vehicleColor')} placeholder="Black" required />
                  <Input label="Plate Number" value={formData.vehiclePlate} onChange={set('vehiclePlate')} placeholder="ABC123XY" required />
                  {(formData.vehicleType === 'CAR' || formData.vehicleType === 'VAN') && (
                    <Input label="Number of Seats" value={formData.numberOfSeats} onChange={set('numberOfSeats')} placeholder="5" type="number" />
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── Delivery Partner fields ── */}
          {formData.role === 'DELIVERY_PARTNER' && (
            <>
              <div className="border-t pt-4 mt-2">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Partner Vehicle Details</h2>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
                <div className="flex flex-wrap gap-2 mb-4">
                  {VEHICLE_TYPES.map(vt => (
                    <button
                      key={vt}
                      type="button"
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                        formData.partnerVehicleType === vt
                          ? 'bg-primary-100 border-primary-500 text-primary-700'
                          : 'border-gray-300 text-gray-600 hover:border-gray-400'
                      }`}
                      onClick={() => setFormData(prev => ({ ...prev, partnerVehicleType: vt }))}
                    >
                      {vt}
                    </button>
                  ))}
                </div>
                <Input
                  label="Vehicle Plate (optional)"
                  value={formData.partnerVehiclePlate}
                  onChange={set('partnerVehiclePlate')}
                  placeholder="ABC123XY"
                />
              </div>
            </>
          )}

          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="outline" onClick={() => navigate('/users')}>Cancel</Button>
            <Button type="submit">Create User</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default UserCreate;