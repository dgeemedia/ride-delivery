// admin-web/src/pages/Drivers/DriverDocuments.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Car, Shield, AlertTriangle, ExternalLink, CheckCircle } from 'lucide-react';
import { driversAPI } from '@/services/api/drivers';
import { Driver } from '@/types';
import { Card, Button, Badge, Spinner, Alert } from '@/components/common';
import { formatDate } from '@/utils/helpers';
import toast from 'react-hot-toast';

// ─── Full-size document viewer card ──────────────────────────────────────────
const DocumentCard: React.FC<{
  label: string;
  url?: string;
  icon: React.ReactNode;
  description?: string;
}> = ({ label, url, icon, description }) => (
  <Card>
    <div className="flex items-center justify-between mb-4">
      <h3 className="font-semibold text-gray-800 flex items-center gap-2">
        {icon}{label}
      </h3>
      <div className="flex items-center gap-2">
        {url
          ? <Badge variant="success"><CheckCircle className="h-3 w-3" />Uploaded</Badge>
          : <Badge variant="warning"><AlertTriangle className="h-3 w-3" />Missing</Badge>
        }
      </div>
    </div>

    {description && (
      <p className="text-xs text-gray-500 mb-3">{description}</p>
    )}

    {url ? (
      <div className="space-y-3">
        {url.toLowerCase().endsWith('.pdf') ? (
          // PDF — embed inline viewer
          <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50" style={{ height: 420 }}>
            <iframe
              src={url}
              title={label}
              className="w-full h-full"
              style={{ border: 'none' }}
            />
          </div>
        ) : (
          // Image — show full size with zoom on click
          <a href={url} target="_blank" rel="noopener noreferrer" className="block group">
            <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50" style={{ maxHeight: 420 }}>
              <img
                src={url}
                alt={label}
                className="w-full object-contain group-hover:opacity-95 transition-opacity"
                style={{ maxHeight: 420 }}
                onError={e => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="hidden rounded-lg border border-dashed border-gray-300 bg-gray-50 h-48 flex-col items-center justify-center text-gray-400 gap-2">
                <AlertTriangle className="h-6 w-6 text-amber-400" />
                <span className="text-sm">Could not load image</span>
              </div>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-end justify-end p-3">
                <span className="opacity-0 group-hover:opacity-100 bg-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-md transition-opacity flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />Open full size
                </span>
              </div>
            </div>
          </a>
        )}

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open in new tab
        </a>
      </div>
    ) : (
      <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 h-48 flex flex-col items-center justify-center text-gray-400 gap-3">
        <AlertTriangle className="h-8 w-8 text-amber-300" />
        <div className="text-center">
          <p className="text-sm font-medium text-gray-500">Document not uploaded</p>
          <p className="text-xs text-gray-400 mt-1">The driver has not submitted this document yet</p>
        </div>
      </div>
    )}
  </Card>
);

// ─── Main page ────────────────────────────────────────────────────────────────
const DriverDocuments: React.FC = () => {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await driversAPI.getDriverById(id);
      setDriver(res.data.driver);
    } catch {
      toast.error('Failed to load driver documents');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="xl" showLabel /></div>;

  if (!driver) return (
    <div className="text-center py-20">
      <p className="text-gray-500">Driver not found.</p>
      <Button className="mt-4" onClick={() => navigate('/drivers')}>Back to Drivers</Button>
    </div>
  );

  const uploadedCount = [driver.licenseImageUrl, driver.vehicleRegUrl, driver.insuranceUrl].filter(Boolean).length;
  const allUploaded   = uploadedCount === 3;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate(`/drivers/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-lg flex-shrink-0">
              {driver.user.firstName[0]}{driver.user.lastName[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {driver.user.firstName} {driver.user.lastName} — Documents
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {uploadedCount}/3 documents uploaded · Joined {formatDate(driver.createdAt)}
              </p>
            </div>
          </div>
        </div>
        <Badge variant={allUploaded ? 'success' : 'warning'}>
          {allUploaded ? 'All documents submitted' : `${3 - uploadedCount} document${3 - uploadedCount !== 1 ? 's' : ''} missing`}
        </Badge>
      </div>

      {!allUploaded && (
        <Alert variant="warning">
          This driver has not uploaded all required documents. You may still approve at your discretion, but ensure compliance before doing so.
        </Alert>
      )}

      {/* Document grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <DocumentCard
          label="Driver's License"
          url={driver.licenseImageUrl}
          icon={<FileText className="h-4 w-4 text-primary-500" />}
          description={`License No: ${driver.licenseNumber}`}
        />
        <DocumentCard
          label="Vehicle Registration"
          url={driver.vehicleRegUrl}
          icon={<Car className="h-4 w-4 text-warning-500" />}
          description={`${driver.vehicleMake} ${driver.vehicleModel} (${driver.vehicleYear}) · ${driver.vehiclePlate}`}
        />
        <DocumentCard
          label="Insurance Certificate"
          url={driver.insuranceUrl}
          icon={<Shield className="h-4 w-4 text-green-500" />}
          description="Third-party or comprehensive vehicle insurance"
        />
      </div>

      {/* Back link */}
      <div className="pt-2">
        <Button variant="outline" onClick={() => navigate(`/drivers/${id}`)}>
          <ArrowLeft className="h-4 w-4" />Back to Driver Profile
        </Button>
      </div>
    </div>
  );
};

export default DriverDocuments;