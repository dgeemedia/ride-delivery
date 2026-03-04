import React from 'react';
import { Card, Input, Button } from '@/components/common';

const PricingSettings: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pricing Settings</h1>
      <Card>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Base Fare" type="number" defaultValue="5.00" />
          <Input label="Per KM" type="number" defaultValue="2.50" />
        </div>
        <Button className="mt-4">Save Changes</Button>
      </Card>
    </div>
  );
};

export default PricingSettings;