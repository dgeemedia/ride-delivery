import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  change?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon: Icon, color, change }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change && (
            <p className="text-sm text-success-600 mt-1">{change}</p>
          )}
        </div>
        <div className={`${color} w-12 h-12 rounded-lg flex items-center justify-center`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
};

export default StatsCard;