import React, { useEffect, useState } from 'react';
import { Card } from '@/components/common';
import { LineChart, PieChart } from '@/components/charts';
import { TrendingUp, TrendingDown, Clock, Star } from 'lucide-react';

const Performance: React.FC = () => {
  const [metrics, setMetrics] = useState({
    averageRideTime: 24.5,
    averageDeliveryTime: 32.8,
    driverRating: 4.7,
    partnerRating: 4.6,
    completionRate: 94.2,
    cancellationRate: 5.8,
  });

  const performanceData = [
    { name: 'Completed', value: 94.2 },
    { name: 'Cancelled', value: 5.8 },
  ];

  const timeData = [
    { day: 'Mon', rides: 245, deliveries: 182 },
    { day: 'Tue', rides: 268, deliveries: 195 },
    { day: 'Wed', rides: 289, deliveries: 211 },
    { day: 'Thu', rides: 312, deliveries: 234 },
    { day: 'Fri', rides: 356, deliveries: 278 },
    { day: 'Sat', rides: 423, deliveries: 312 },
    { day: 'Sun', rides: 389, deliveries: 289 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Performance Metrics</h1>
        <p className="text-gray-600 mt-1">Monitor platform performance and efficiency</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Ride Time</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {metrics.averageRideTime} min
              </p>
              <div className="flex items-center mt-2">
                <TrendingDown className="h-4 w-4 text-success-500 mr-1" />
                <span className="text-sm text-success-600">-2.3%</span>
              </div>
            </div>
            <Clock className="h-8 w-8 text-primary-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Delivery Time</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {metrics.averageDeliveryTime} min
              </p>
              <div className="flex items-center mt-2">
                <TrendingUp className="h-4 w-4 text-error-500 mr-1" />
                <span className="text-sm text-error-600">+1.2%</span>
              </div>
            </div>
            <Clock className="h-8 w-8 text-warning-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Driver Rating</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {metrics.driverRating}
              </p>
              <div className="flex items-center mt-2">
                <TrendingUp className="h-4 w-4 text-success-500 mr-1" />
                <span className="text-sm text-success-600">+0.1</span>
              </div>
            </div>
            <Star className="h-8 w-8 text-warning-500 fill-warning-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completion Rate</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {metrics.completionRate}%
              </p>
              <div className="flex items-center mt-2">
                <TrendingUp className="h-4 w-4 text-success-500 mr-1" />
                <span className="text-sm text-success-600">+1.5%</span>
              </div>
            </div>
            <TrendingUp className="h-8 w-8 text-success-500" />
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold mb-4">Completion vs Cancellation</h3>
          <PieChart
            data={performanceData}
            nameKey="name"
            valueKey="value"
            colors={['#34C759', '#FF3B30']}
            height={300}
          />
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Weekly Activity</h3>
          <LineChart
            data={timeData}
            xKey="day"
            lines={[
              { key: 'rides', name: 'Rides', color: '#007AFF' },
              { key: 'deliveries', name: 'Deliveries', color: '#FF9500' },
            ]}
            height={300}
          />
        </Card>
      </div>
    </div>
  );
};

export default Performance;