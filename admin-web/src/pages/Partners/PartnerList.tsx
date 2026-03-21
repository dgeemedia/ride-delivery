// admin-web/src/pages/Partners/PartnerList.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Badge } from '@/components/common';
import { formatDate } from '@/utils/helpers';

const PartnerList: React.FC = () => {
  const navigate = useNavigate();
  const [partners, setPartners] = useState([]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delivery Partners</h1>
          <p className="text-gray-600 mt-1">Manage all delivery partner accounts</p>
        </div>
        <Button onClick={() => navigate('/partners/pending')}>
          View Pending Approvals
        </Button>
      </div>

      <Card>
        <p className="text-gray-600">Partner list implementation - similar to DriverList</p>
      </Card>
    </div>
  );
};

export default PartnerList;