// admin-web/src/pages/Users/CreateAdminUser.tsx
import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Eye, EyeOff, Upload, CheckCircle, X, Loader2 } from 'lucide-react';
import { usersAPI } from '@/services/api/users';
import { Card, Input, Select, Button, Alert } from '@/components/common';
import api from '@/services/api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const VEHICLE_TYPES = ['BIKE', 'CAR', 'MOTORCYCLE', 'VAN', 'TRICYCLE'] as const;
type VehicleType = typeof VEHICLE_TYPES[number];

const VEHICLE_SUB_TYPES: Record<VehicleType, string[]> = {
  CAR:        ['Sedan', 'SUV', 'Hatchback', 'Minivan', 'Coupe'],
  VAN:        ['Panel Van', 'Minibus', 'Pickup Truck', 'Box Truck'],
  MOTORCYCLE: ['Standard', 'Scooter', 'Sport', 'Cruiser'],
  BIKE:       ['Road Bike', 'Mountain Bike', 'Cargo Bike'],
  TRICYCLE:   ['Keke Napep', 'Cargo Tricycle'],
};

const DEPT_INFO: Record<string, { label: string; description: string; color: string }> = {
  '': {
    label: 'General Admin',
    description: 'Full access to all admin sections — drivers, partners, rides, deliveries, analytics, settings.',
    color: 'bg-primary-50 border-primary-200 text-primary-800',
  },
  RIDES: {
    label: 'Rides & Drivers Admin',
    description: 'Can manage drivers, approve/reject driver applications, view and manage rides.',
    color: 'bg-blue-50 border-blue-200 text-blue-800',
  },
  DELIVERIES: {
    label: 'Deliveries & Partners Admin',
    description: 'Can manage delivery partners, approve/reject partner applications, view and manage deliveries.',
    color: 'bg-amber-50 border-amber-200 text-amber-800',
  },
  SUPPORT: {
    label: 'Support Agent',
    description: 'Can view and respond to support tickets. Read-only access to user profiles and ride/delivery history.',
    color: 'bg-green-50 border-green-200 text-green-800',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Document definitions
// vehicleTypes: [] = applies to all vehicle types
// ─────────────────────────────────────────────────────────────────────────────

interface DocDefinition {
  field: string;
  label: string;
  hint?: string;
  vehicleTypes: VehicleType[];
  section: string;
}

const DRIVER_DOCS: DocDefinition[] = [
  // Personal KYC
  { field: 'applicantPhotoUrl',       label: 'Applicant Photo',             hint: 'Clear passport-style photo',                       vehicleTypes: [],                                 section: 'Personal KYC' },
  { field: 'govtIdUrl',               label: 'Government-issued ID',        hint: 'NIN slip, voter card, passport or driver licence',  vehicleTypes: [],                                 section: 'Personal KYC' },
  { field: 'proofOfAddressUrl',       label: 'Proof of Address',            hint: 'Utility bill or bank statement (≤3 months)',        vehicleTypes: [],                                 section: 'Personal KYC' },
  // Licence & Registration
  { field: 'licenseImageUrl',         label: "Driver's Licence (image)",    hint: 'Front of physical licence card',                    vehicleTypes: [],                                 section: 'Licence & Registration' },
  { field: 'vehicleRegUrl',           label: 'Vehicle Registration',        hint: 'Current vehicle registration document',             vehicleTypes: [],                                 section: 'Licence & Registration' },
  { field: 'insuranceUrl',            label: 'Insurance Certificate',       hint: 'Comprehensive or third-party insurance',            vehicleTypes: [],                                 section: 'Licence & Registration' },
  // Vehicle Condition
  { field: 'roadWorthinessUrl',       label: 'Road Worthiness Certificate', hint: 'Issued by authorised inspection centre',            vehicleTypes: [],                                 section: 'Vehicle Condition' },
  { field: 'vehiclePhotoExteriorUrl', label: 'Vehicle Photo (Exterior)',    hint: 'All four sides visible',                            vehicleTypes: [],                                 section: 'Vehicle Condition' },
  { field: 'vehicleInspectionUrl',    label: 'Vehicle Inspection Report',   hint: 'MVAA or authorised workshop report',                vehicleTypes: ['CAR', 'VAN'],                     section: 'Vehicle Condition' },
  { field: 'hackneyCertUrl',          label: 'Hackney / Commercial Permit', hint: 'Required for commercial passenger vehicles',        vehicleTypes: ['CAR', 'VAN'],                     section: 'Vehicle Condition' },
  { field: 'vehiclePhotoInteriorUrl', label: 'Vehicle Photo (Interior)',    hint: 'Dashboard, seats and boot',                         vehicleTypes: ['CAR', 'VAN'],                     section: 'Vehicle Condition' },
  // Rider-Specific
  { field: 'riderCardUrl',            label: "Rider's / Operator Card",     hint: 'NARTO or union membership card',                    vehicleTypes: ['BIKE', 'MOTORCYCLE', 'TRICYCLE'], section: 'Rider-Specific' },
  { field: 'helmetPhotoUrl',          label: 'Helmet Photo',                hint: 'DOT/ECE approved helmet clearly visible',           vehicleTypes: ['BIKE', 'MOTORCYCLE'],             section: 'Rider-Specific' },
  { field: 'dispatchPermitUrl',       label: 'Dispatch / Courier Permit',   hint: 'Permit from local transport authority',             vehicleTypes: ['BIKE', 'MOTORCYCLE', 'TRICYCLE'], section: 'Rider-Specific' },
  { field: 'guarantorLetterUrl',      label: 'Guarantor Letter',            hint: 'Signed letter from guarantor',                      vehicleTypes: ['BIKE', 'MOTORCYCLE', 'TRICYCLE'], section: 'Rider-Specific' },
  { field: 'guarantorIdUrl',          label: "Guarantor's ID",              hint: 'Valid government ID of guarantor',                  vehicleTypes: ['BIKE', 'MOTORCYCLE', 'TRICYCLE'], section: 'Rider-Specific' },
  { field: 'operatorPermitUrl',       label: 'Tricycle Operator Permit',    hint: 'State-issued Keke operator permit',                 vehicleTypes: ['TRICYCLE'],                       section: 'Rider-Specific' },
];

const PARTNER_DOCS: DocDefinition[] = [
  // Personal KYC
  { field: 'applicantPhotoUrl',       label: 'Applicant Photo',             hint: 'Clear passport-style photo',                       vehicleTypes: [],                                 section: 'Personal KYC' },
  { field: 'govtIdUrl',               label: 'Government-issued ID',        hint: 'NIN slip, voter card, passport or licence',         vehicleTypes: [],                                 section: 'Personal KYC' },
  { field: 'proofOfAddressUrl',       label: 'Proof of Address',            hint: 'Utility bill or bank statement (≤3 months)',        vehicleTypes: [],                                 section: 'Personal KYC' },
  // Vehicle & Identity
  { field: 'idImageUrl',              label: 'ID Image',                    hint: 'Clear photo of your ID document',                   vehicleTypes: [],                                 section: 'Vehicle & Identity' },
  { field: 'vehicleImageUrl',         label: 'Vehicle Image',               hint: 'Vehicle with plate number visible',                 vehicleTypes: [],                                 section: 'Vehicle & Identity' },
  { field: 'insuranceUrl',            label: 'Insurance Certificate',       hint: 'Vehicle or goods-in-transit insurance',             vehicleTypes: [],                                 section: 'Vehicle & Identity' },
  { field: 'roadWorthinessUrl',       label: 'Road Worthiness Certificate', hint: 'Issued by authorised inspection centre',            vehicleTypes: [],                                 section: 'Vehicle & Identity' },
  { field: 'vehiclePhotoExteriorUrl', label: 'Vehicle Photo (Exterior)',    hint: 'All sides of the vehicle',                          vehicleTypes: [],                                 section: 'Vehicle & Identity' },
  { field: 'vehiclePhotoInteriorUrl', label: 'Vehicle Photo (Interior)',    hint: 'Cargo area / back seats',                           vehicleTypes: ['CAR', 'VAN'],                     section: 'Vehicle & Identity' },
  // Rider-Specific
  { field: 'riderCardUrl',            label: "Rider's Card / Union Card",   hint: 'NARTO or union membership card',                    vehicleTypes: ['BIKE', 'MOTORCYCLE', 'TRICYCLE'], section: 'Rider-Specific' },
  { field: 'helmetPhotoUrl',          label: 'Helmet Photo',                hint: 'DOT/ECE approved helmet clearly visible',           vehicleTypes: ['BIKE', 'MOTORCYCLE'],             section: 'Rider-Specific' },
  { field: 'dispatchPermitUrl',       label: 'Dispatch / Courier Permit',   hint: 'Permit from local transport authority',             vehicleTypes: ['BIKE', 'MOTORCYCLE', 'TRICYCLE'], section: 'Rider-Specific' },
  { field: 'guarantorLetterUrl',      label: 'Guarantor Letter',            hint: 'Signed letter from guarantor',                      vehicleTypes: ['BIKE', 'MOTORCYCLE', 'TRICYCLE'], section: 'Rider-Specific' },
  { field: 'guarantorIdUrl',          label: "Guarantor's ID",              hint: 'Valid government ID of guarantor',                  vehicleTypes: ['BIKE', 'MOTORCYCLE', 'TRICYCLE'], section: 'Rider-Specific' },
  { field: 'operatorPermitUrl',       label: 'Tricycle Operator Permit',    hint: 'State-issued Keke operator permit',                 vehicleTypes: ['TRICYCLE'],                       section: 'Rider-Specific' },
];

function getApplicableDocs(docs: DocDefinition[], vehicleType: VehicleType | ''): DocDefinition[] {
  if (!vehicleType) return [];
  return docs.filter(d => d.vehicleTypes.length === 0 || d.vehicleTypes.includes(vehicleType));
}

function groupBySection(docs: DocDefinition[]): Record<string, DocDefinition[]> {
  return docs.reduce<Record<string, DocDefinition[]>>((acc, doc) => {
    if (!acc[doc.section]) acc[doc.section] = [];
    acc[doc.section].push(doc);
    return acc;
  }, {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload helper — converts file to base64 then POSTs to /upload/base64
// ─────────────────────────────────────────────────────────────────────────────

async function uploadFileToCloudinary(file: File, folder = 'duoride/documents/admin'): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        const response = await api.post('/upload/base64', { base64Data, folder });
        resolve(response.data.data.url as string);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DocUploadField — file picker that uploads immediately on selection
// ─────────────────────────────────────────────────────────────────────────────

interface DocUploadFieldProps {
  doc: DocDefinition;
  url: string;       // current Cloudinary URL (if already uploaded)
  uploading: boolean;
  onUpload: (field: string, file: File) => void;
  onClear: (field: string) => void;
}

const DocUploadField: React.FC<DocUploadFieldProps> = ({ doc, url, uploading, onUpload, onClear }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasUrl = url.trim().length > 0;

  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-gray-700">{doc.label}</label>
      {doc.hint && <p className="text-xs text-gray-400 leading-tight">{doc.hint}</p>}

      {hasUrl ? (
        // Uploaded state — show thumbnail link + clear button
        <div className="flex items-center gap-2 px-3 py-2 border border-green-300 bg-green-50 rounded-lg">
          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-green-700 underline truncate flex-1"
          >
            View uploaded file
          </a>
          <button
            type="button"
            onClick={() => onClear(doc.field)}
            className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
            aria-label="Remove file"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        // Empty state — upload button
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed rounded-lg text-xs font-medium transition-colors ${
            uploading
              ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
              : 'border-gray-300 text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 cursor-pointer'
          }`}
        >
          {uploading
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Uploading…</>
            : <><Upload className="h-3.5 w-3.5" />Choose file</>
          }
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) onUpload(doc.field, file);
          // Reset so the same file can be re-selected after clearing
          e.target.value = '';
        }}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DocSectionPanel
// ─────────────────────────────────────────────────────────────────────────────

interface DocSectionPanelProps {
  docs: DocDefinition[];
  vehicleType: VehicleType | '';
  docUrls: Record<string, string>;
  uploadingFields: Record<string, boolean>;
  onUpload: (field: string, file: File) => void;
  onClear: (field: string) => void;
  accentColor: string;
  accentText: string;
}

const DocSectionPanel: React.FC<DocSectionPanelProps> = ({
  docs, vehicleType, docUrls, uploadingFields, onUpload, onClear, accentColor, accentText,
}) => {
  const applicable = getApplicableDocs(docs, vehicleType);
  if (applicable.length === 0) return null;

  const grouped = groupBySection(applicable);
  const uploaded = applicable.filter(d => docUrls[d.field]?.trim()).length;

  return (
    <div className={`rounded-xl border ${accentColor} p-4 space-y-5`}>
      <div className="flex items-center justify-between">
        <p className={`text-sm font-semibold ${accentText} flex items-center gap-1.5`}>
          <Upload className="h-4 w-4" />
          Documents <span className="font-normal opacity-70">(all optional)</span>
        </p>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          uploaded > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {uploaded} / {applicable.length} uploaded
        </span>
      </div>

      {Object.entries(grouped).map(([section, sectionDocs]) => (
        <div key={section} className="space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-200 pb-1">
            {section}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sectionDocs.map(doc => (
              <DocUploadField
                key={doc.field}
                doc={doc}
                url={docUrls[doc.field] ?? ''}
                uploading={uploadingFields[doc.field] ?? false}
                onUpload={onUpload}
                onClear={onClear}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PasswordInput
// ─────────────────────────────────────────────────────────────────────────────

interface PasswordInputProps {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  hint?: string;
  required?: boolean;
}

const PasswordInput: React.FC<PasswordInputProps> = ({ label, value, onChange, hint, required }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input label={label} type={show ? 'text' : 'password'} value={value} onChange={onChange} hint={hint} required={required} />
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
// VehicleChips
// ─────────────────────────────────────────────────────────────────────────────

interface VehicleChipsProps {
  selected: VehicleType | '';
  onChange: (vt: VehicleType) => void;
}

const VehicleChips: React.FC<VehicleChipsProps> = ({ selected, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {VEHICLE_TYPES.map(vt => (
      <button
        key={vt}
        type="button"
        onClick={() => onChange(vt)}
        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
          selected === vt
            ? 'bg-primary-100 border-primary-500 text-primary-700 shadow-sm'
            : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
        }`}
      >
        {vt}
      </button>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'MODERATOR' | 'CUSTOMER' | 'DRIVER' | 'DELIVERY_PARTNER';

const CreateAdminUser: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    password: '', confirmPassword: '',
    role: 'ADMIN' as Role,
    adminDepartment: '' as '' | 'RIDES' | 'DELIVERIES' | 'SUPPORT',
  });

  const [driverForm, setDriverForm] = useState({
    licenseNumber: '',
    vehicleType:   '' as VehicleType | '',
    vehicleSubType: '',
    vehicleMake:   '',
    vehicleModel:  '',
    vehicleYear:   '',
    vehicleColor:  '',
    vehiclePlate:  '',
    numberOfSeats: '',
  });

  const [partnerForm, setPartnerForm] = useState({
    vehicleType:  '' as VehicleType | '',
    vehiclePlate: '',
  });

  // Cloudinary URLs keyed by doc field name
  const [driverDocs, setDriverDocs]   = useState<Record<string, string>>({});
  const [partnerDocs, setPartnerDocs] = useState<Record<string, string>>({});

  // Per-field uploading spinners
  const [driverUploading, setDriverUploading]   = useState<Record<string, boolean>>({});
  const [partnerUploading, setPartnerUploading] = useState<Record<string, boolean>>({});

  const dept = form.role === 'SUPPORT' ? 'SUPPORT' : !['ADMIN', 'SUPER_ADMIN'].includes(form.role) ? '' : form.adminDepartment;
  const deptInfo = DEPT_INFO[dept] ?? DEPT_INFO[''];

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleRoleChange = (role: Role) => {
    setForm(f => ({ ...f, role, adminDepartment: role === 'SUPPORT' ? '' : f.adminDepartment }));
    setDriverForm({ licenseNumber: '', vehicleType: '', vehicleSubType: '', vehicleMake: '', vehicleModel: '', vehicleYear: '', vehicleColor: '', vehiclePlate: '', numberOfSeats: '' });
    setPartnerForm({ vehicleType: '', vehiclePlate: '' });
    setDriverDocs({});
    setPartnerDocs({});
    setDriverUploading({});
    setPartnerUploading({});
  };

  const handleDriverVehicleTypeChange = (vt: VehicleType) => {
    setDriverForm(f => ({ ...f, vehicleType: vt, vehicleSubType: '' }));
    setDriverDocs({});
    setDriverUploading({});
  };

  const handlePartnerVehicleTypeChange = (vt: VehicleType) => {
    setPartnerForm(f => ({ ...f, vehicleType: vt }));
    setPartnerDocs({});
    setPartnerUploading({});
  };

  // ── Upload handlers ────────────────────────────────────────────────────────

  const handleDriverUpload = useCallback(async (field: string, file: File) => {
    setDriverUploading(prev => ({ ...prev, [field]: true }));
    try {
      const url = await uploadFileToCloudinary(file);
      setDriverDocs(prev => ({ ...prev, [field]: url }));
    } catch {
      toast.error(`Failed to upload ${field.replace('Url', '')}. Please try again.`);
    } finally {
      setDriverUploading(prev => ({ ...prev, [field]: false }));
    }
  }, []);

  const handleDriverClear = useCallback((field: string) => {
    setDriverDocs(prev => { const next = { ...prev }; delete next[field]; return next; });
  }, []);

  const handlePartnerUpload = useCallback(async (field: string, file: File) => {
    setPartnerUploading(prev => ({ ...prev, [field]: true }));
    try {
      const url = await uploadFileToCloudinary(file);
      setPartnerDocs(prev => ({ ...prev, [field]: url }));
    } catch {
      toast.error(`Failed to upload ${field.replace('Url', '')}. Please try again.`);
    } finally {
      setPartnerUploading(prev => ({ ...prev, [field]: false }));
    }
  }, []);

  const handlePartnerClear = useCallback((field: string) => {
    setPartnerDocs(prev => { const next = { ...prev }; delete next[field]; return next; });
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (form.password.length < 8)               { toast.error('Password must be at least 8 characters'); return; }

    if (form.role === 'DRIVER') {
      if (!driverForm.vehicleType)                              { toast.error('Select a vehicle type for the driver'); return; }
      if (!driverForm.licenseNumber)                            { toast.error('Licence number is required'); return; }
      if (!driverForm.vehicleMake || !driverForm.vehicleModel)  { toast.error('Vehicle make and model are required'); return; }
      const year = parseInt(driverForm.vehicleYear, 10);
      if (!year || year < 1990 || year > new Date().getFullYear() + 1) { toast.error('Enter a valid vehicle year'); return; }
      if (!driverForm.vehicleColor) { toast.error('Vehicle colour is required'); return; }
      if (!driverForm.vehiclePlate) { toast.error('Plate number is required'); return; }
    }

    if (form.role === 'DELIVERY_PARTNER' && !partnerForm.vehicleType) {
      toast.error('Select a vehicle type for the delivery partner');
      return;
    }

    // Block submit if any upload is still in progress
    const anyUploading = Object.values(driverUploading).some(Boolean) || Object.values(partnerUploading).some(Boolean);
    if (anyUploading) { toast.error('Please wait for all uploads to finish'); return; }

    setLoading(true);
    try {
      const payload: any = {
        firstName: form.firstName,
        lastName:  form.lastName,
        email:     form.email,
        phone:     form.phone,
        password:  form.password,
        role:      form.role,
        adminDepartment: form.role === 'SUPPORT'
          ? 'SUPPORT'
          : ['ADMIN', 'SUPER_ADMIN'].includes(form.role)
          ? (form.adminDepartment || null)
          : null,
      };

      if (form.role === 'DRIVER') {
        const year = parseInt(driverForm.vehicleYear, 10);
        Object.assign(payload, {
          licenseNumber: driverForm.licenseNumber.trim().toUpperCase(),
          vehicleType:   driverForm.vehicleType,
          vehicleMake:   driverForm.vehicleMake.trim(),
          vehicleModel:  driverForm.vehicleModel.trim(),
          vehicleYear:   year,
          vehicleColor:  driverForm.vehicleColor.trim(),
          vehiclePlate:  driverForm.vehiclePlate.trim().toUpperCase(),
          ...(driverForm.vehicleSubType && { vehicleSubType: driverForm.vehicleSubType }),
          ...(driverForm.numberOfSeats  && { numberOfSeats: parseInt(driverForm.numberOfSeats, 10) }),
          // Only include fields that have a URL
          ...Object.fromEntries(Object.entries(driverDocs).filter(([, v]) => v)),
        });
      }

      if (form.role === 'DELIVERY_PARTNER') {
        Object.assign(payload, {
          vehicleType: partnerForm.vehicleType,
          ...(partnerForm.vehiclePlate.trim() && { vehiclePlate: partnerForm.vehiclePlate.trim().toUpperCase() }),
          ...Object.fromEntries(Object.entries(partnerDocs).filter(([, v]) => v)),
        });
      }

      await usersAPI.createAdminUser(payload);
      toast.success(`${form.role} account created successfully`);
      navigate('/users');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate('/users')}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Create User Account</h1>
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

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" value={form.firstName} onChange={set('firstName')} required />
            <Input label="Last Name"  value={form.lastName}  onChange={set('lastName')}  required />
          </div>
          <Input label="Email" type="email" value={form.email} onChange={set('email')} required />
          <Input label="Phone" type="tel"   value={form.phone} onChange={set('phone')} required placeholder="+234..." />

          <div className="grid grid-cols-2 gap-4">
            <PasswordInput label="Password"         value={form.password}        onChange={set('password')}        hint="Min 8 characters" required />
            <PasswordInput label="Confirm Password" value={form.confirmPassword} onChange={set('confirmPassword')} required />
          </div>

          {/* Role */}
          <Select
            label="Role"
            value={form.role}
            onChange={e => handleRoleChange(e.target.value as Role)}
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
              Support agents can view and respond to tickets with read-only access to user profiles and order history.
            </Alert>
          )}

          {/* ── DRIVER ─────────────────────────────────────────────────────── */}
          {form.role === 'DRIVER' && (
            <div className="space-y-5 border border-blue-200 bg-blue-50/40 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-800">Vehicle & Licence Details</p>

              <Input
                label="Licence Number"
                value={driverForm.licenseNumber}
                onChange={e => setDriverForm(f => ({ ...f, licenseNumber: e.target.value }))}
                placeholder="e.g. ABC123456"
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Type <span className="text-red-500">*</span>
                </label>
                <VehicleChips selected={driverForm.vehicleType} onChange={handleDriverVehicleTypeChange} />
              </div>

              {driverForm.vehicleType && VEHICLE_SUB_TYPES[driverForm.vehicleType].length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vehicle Sub-type <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {VEHICLE_SUB_TYPES[driverForm.vehicleType].map(st => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setDriverForm(f => ({ ...f, vehicleSubType: f.vehicleSubType === st ? '' : st }))}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                          driverForm.vehicleSubType === st
                            ? 'bg-primary-100 border-primary-500 text-primary-700'
                            : 'border-gray-300 text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {driverForm.vehicleType && (
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Make"   value={driverForm.vehicleMake}  onChange={e => setDriverForm(f => ({ ...f, vehicleMake: e.target.value }))}  placeholder="Toyota"    required />
                  <Input label="Model"  value={driverForm.vehicleModel} onChange={e => setDriverForm(f => ({ ...f, vehicleModel: e.target.value }))} placeholder="Camry"     required />
                  <Input label="Year"   type="number" value={driverForm.vehicleYear}  onChange={e => setDriverForm(f => ({ ...f, vehicleYear: e.target.value }))}  placeholder="2019" required />
                  <Input label="Colour" value={driverForm.vehicleColor} onChange={e => setDriverForm(f => ({ ...f, vehicleColor: e.target.value }))} placeholder="Black"     required />
                  <Input label="Plate Number" value={driverForm.vehiclePlate} onChange={e => setDriverForm(f => ({ ...f, vehiclePlate: e.target.value }))} placeholder="ABC123XY" className="col-span-2" required />
                  {(driverForm.vehicleType === 'CAR' || driverForm.vehicleType === 'VAN') && (
                    <Input label="Number of Seats" type="number" value={driverForm.numberOfSeats} onChange={e => setDriverForm(f => ({ ...f, numberOfSeats: e.target.value }))} placeholder="5" className="col-span-2" />
                  )}
                </div>
              )}

              {driverForm.vehicleType && (
                <DocSectionPanel
                  docs={DRIVER_DOCS}
                  vehicleType={driverForm.vehicleType}
                  docUrls={driverDocs}
                  uploadingFields={driverUploading}
                  onUpload={handleDriverUpload}
                  onClear={handleDriverClear}
                  accentColor="border-blue-200 bg-white"
                  accentText="text-blue-800"
                />
              )}
            </div>
          )}

          {/* ── DELIVERY PARTNER ────────────────────────────────────────────── */}
          {form.role === 'DELIVERY_PARTNER' && (
            <div className="space-y-5 border border-amber-200 bg-amber-50/40 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-800">Partner Vehicle Details</p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Type <span className="text-red-500">*</span>
                </label>
                <VehicleChips selected={partnerForm.vehicleType} onChange={handlePartnerVehicleTypeChange} />
              </div>

              {partnerForm.vehicleType && (
                <Input
                  label="Vehicle Plate (optional)"
                  value={partnerForm.vehiclePlate}
                  onChange={e => setPartnerForm(f => ({ ...f, vehiclePlate: e.target.value }))}
                  placeholder="ABC123XY"
                />
              )}

              {partnerForm.vehicleType && (
                <DocSectionPanel
                  docs={PARTNER_DOCS}
                  vehicleType={partnerForm.vehicleType}
                  docUrls={partnerDocs}
                  uploadingFields={partnerUploading}
                  onUpload={handlePartnerUpload}
                  onClear={handlePartnerClear}
                  accentColor="border-amber-200 bg-white"
                  accentText="text-amber-800"
                />
              )}
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