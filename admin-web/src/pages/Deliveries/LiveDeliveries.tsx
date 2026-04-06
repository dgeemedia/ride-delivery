// admin-web/src/pages/Deliveries/LiveDeliveries.tsx
import React, { useEffect, useState } from 'react';
import { deliveriesAPI } from '@/services/api/deliveries';
import { Delivery } from '@/types';
import { useSocket } from '@/hooks/useSocket';
import { SOCKET_EVENTS } from '@/services/socket/events';

const LiveDeliveries: React.FC = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const { on } = useSocket();

  useEffect(() => {
    loadLiveDeliveries();

    const unsubscribe = on(SOCKET_EVENTS.DELIVERY_IN_TRANSIT, () => {
      loadLiveDeliveries();
    });

    return () => unsubscribe();
  }, [on]);

  const loadLiveDeliveries = async () => {
    const response = await deliveriesAPI.getLiveDeliveries();
    setDeliveries(response.data.deliveries);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Live Deliveries</h1>
      <p className="text-gray-500 text-sm">
        {deliveries.length} active deliver{deliveries.length !== 1 ? 'ies' : 'y'}
      </p>
      {/* Map and delivery cards */}
    </div>
  );
};

export default LiveDeliveries;