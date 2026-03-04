import React from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/common';

const PaymentDetails: React.FC = () => {
  const { id } = useParams();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Payment Details</h1>
      <Card>
        <p>Payment ID: {id}</p>
      </Card>
    </div>
  );
};

export default PaymentDetails;