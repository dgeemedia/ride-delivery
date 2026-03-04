import React from 'react';
import { Card, Input, Button } from '@/components/common';

const GeneralSettings: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Platform Settings</h3>
        
        <div className="space-y-4">
          <Input label="Platform Name" defaultValue="DuoRide" />
          <Input label="Support Email" defaultValue="support@duoride.com" />
          <Input label="Support Phone" defaultValue="+1 (555) 000-0000" />
          
          <div className="pt-4">
            <Button>Save Changes</Button>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Pricing Configuration</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <Input label="Base Fare ($)" type="number" defaultValue="5.00" />
          <Input label="Per KM Rate ($)" type="number" defaultValue="2.50" />
          <Input label="Delivery Base Fee ($)" type="number" defaultValue="3.00" />
          <Input label="Platform Commission (%)" type="number" defaultValue="20" />
        </div>

        <div className="pt-4">
          <Button>Update Pricing</Button>
        </div>
      </Card>
    </div>
  );
};

export default GeneralSettings;