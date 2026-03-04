import React from 'react';
import { useParams } from 'react-router-dom';

const DeliveryDetails: React.FC = () => {
  const { id } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-bold">Delivery Details</h1>
      <p className="text-gray-600">Delivery ID: {id}</p>
    </div>
  );
};

export default DeliveryDetails;