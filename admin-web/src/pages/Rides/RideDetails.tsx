import React from 'react';
import { useParams } from 'react-router-dom';

const RideDetails: React.FC = () => {
  const { id } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-bold">Ride Details</h1>
      <p className="text-gray-600">Ride ID: {id}</p>
    </div>
  );
};

export default RideDetails;