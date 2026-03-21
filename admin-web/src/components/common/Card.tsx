// admin-web/src/components/common/Card.tsx
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean | 'false';
}

const Card: React.FC<CardProps> = ({ children, className = '', padding = true }) => {
  const paddingClass = padding === false || padding === 'false' ? '' : 'p-6';
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${paddingClass} ${className}`}>
      {children}
    </div>
  );
};

export default Card;