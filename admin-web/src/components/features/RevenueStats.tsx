import React from 'react';
import { Card } from '@/components/common';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/utils/helpers';

interface RevenueStatsProps {
  current: number;
  previous: number;
  period: string;
}

const RevenueStats: React.FC<RevenueStatsProps> = ({ current, previous, period }) => {
  const change = ((current - previous) / previous) * 100;
  const isPositive = change >= 0;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{period} Revenue</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {formatCurrency(current)}
          </p>
          <div className="flex items-center mt-2">
            {isPositive ? (
              <TrendingUp className="h-4 w-4 text-success-500 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 text-error-500 mr-1" />
            )}
            <span className={`text-sm font-medium ${isPositive ? 'text-success-600' : 'text-error-600'}`}>
              {Math.abs(change).toFixed(1)}%
            </span>
            <span className="text-sm text-gray-600 ml-1">vs previous {period.toLowerCase()}</span>
          </div>
        </div>
        <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
          <DollarSign className="h-6 w-6 text-primary-600" />
        </div>
      </div>
    </Card>
  );
};

export default RevenueStats;