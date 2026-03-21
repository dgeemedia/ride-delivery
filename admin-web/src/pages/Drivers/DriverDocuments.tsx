// admin-web/src/pages/Drivers/DriverDocuments.tsx
import React from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/common';

const DriverDocuments: React.FC = () => {
  const { id } = useParams();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Driver Documents</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <h3 className="font-semibold mb-4">Driver License</h3>
          <div className="aspect-video bg-gray-100 rounded-lg" />
        </Card>

        <Card>
          <h3 className="font-semibold mb-4">Vehicle Registration</h3>
          <div className="aspect-video bg-gray-100 rounded-lg" />
        </Card>

        <Card>
          <h3 className="font-semibold mb-4">Insurance</h3>
          <div className="aspect-video bg-gray-100 rounded-lg" />
        </Card>
      </div>
    </div>
  );
};

export default DriverDocuments;