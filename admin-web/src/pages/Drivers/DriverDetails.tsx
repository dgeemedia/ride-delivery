import React from 'react';
import { useParams } from 'react-router-dom';

const DriverDetails: React.FC = () => {
  const { id } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-bold">Driver Details</h1>
      <p className="text-gray-600">Driver ID: {id}</p>
    </div>
  );
};

export default DriverDetails;