// admin-web/src/pages/Partners/PartnerDetails.tsx
import React from 'react';
import { useParams } from 'react-router-dom';

const PartnerDetails: React.FC = () => {
  const { id } = useParams();
  return <div>Partner Details {id}</div>;
};

export default PartnerDetails;