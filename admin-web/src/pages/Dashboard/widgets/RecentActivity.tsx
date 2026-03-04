import React from 'react';
import { Card } from '@/components/common';
import { formatRelativeTime } from '@/utils/formatters';

interface Activity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
}

interface RecentActivityProps {
  activities: Activity[];
}

const RecentActivity: React.FC<RecentActivityProps> = ({ activities }) => {
  return (
    <Card>
      <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start">
            <div className="w-2 h-2 bg-primary-500 rounded-full mt-2 mr-3" />
            <div className="flex-1">
              <p className="text-sm text-gray-900">{activity.description}</p>
              <p className="text-xs text-gray-500 mt-1">
                {formatRelativeTime(activity.timestamp)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default RecentActivity;