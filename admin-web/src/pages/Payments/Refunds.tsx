// admin-web/src/pages/Payments/Refunds.tsx
import React, { useState } from 'react';
import { paymentsAPI } from '@/services/api/payments';
import { Card, Table, Button } from '@/components/common';

const Refunds: React.FC = () => {
  const [refunds, setRefunds] = useState([]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Refunds</h1>
      <Card>
        {/* Refunds table */}
      </Card>
    </div>
  );
};

export default Refunds;