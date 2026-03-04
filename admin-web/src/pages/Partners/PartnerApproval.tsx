// Similar structure to DriverApproval
import React, { useEffect, useState } from 'react';
import { partnersAPI } from '@/services/api/partners';
import { Card, Button } from '@/components/common';
import toast from 'react-hot-toast';

const PartnerApproval: React.FC = () => {
  const [partners, setPartners] = useState([]);

  useEffect(() => {
    loadPendingPartners();
  }, []);

  const loadPendingPartners = async () => {
    try {
      const response = await partnersAPI.getPendingPartners();
      setPartners(response.data.partners);
    } catch (error) {
      toast.error('Failed to load partners');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await partnersAPI.approvePartner(id);
      toast.success('Partner approved');
      loadPendingPartners();
    } catch (error) {
      toast.error('Failed to approve partner');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Partner Approvals</h1>
      {/* Similar grid layout as DriverApproval */}
    </div>
  );
};

export default PartnerApproval;