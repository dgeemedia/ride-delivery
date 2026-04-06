// admin-web/src/components/common/Card.tsx
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean | 'false';
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ children, className = '', padding = true, onClick }) => {
  const paddingClass = padding === false || padding === 'false' ? '' : 'p-6';
  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-100 ${paddingClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;