import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '@/components/common';
import { Users, Car, Package, Settings } from 'lucide-react';

const QuickActions: React.FC = () => {
  const navigate = useNavigate();

  const actions = [
    { label: 'View Users', icon: Users, path: '/users' },
    { label: 'Driver Approvals', icon: Car, path: '/drivers/pending' },
    { label: 'Partner Approvals', icon: Package, path: '/partners/pending' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ];

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <Button
            key={action.path}
            variant="outline"
            onClick={() => navigate(action.path)}
            className="flex items-center justify-center"
          >
            <action.icon className="h-4 w-4 mr-2" />
            {action.label}
          </Button>
        ))}
      </div>
    </Card>
  );
};

export default QuickActions;