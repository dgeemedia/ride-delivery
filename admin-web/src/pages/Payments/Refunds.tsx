// admin-web/src/pages/Payments/Refunds.tsx
import React from 'react';
import { Card } from '@/components/common';

const Refunds: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Refunds</h1>
      <Card>
        <p className="text-sm text-gray-400 text-center py-8">No refund data available.</p>
      </Card>
    </div>
  );
};

export default Refunds;