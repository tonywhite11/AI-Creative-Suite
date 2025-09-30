
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ children, className }) => {
  return (
    <div className={`bg-base-200 p-6 rounded-xl shadow-lg border border-base-300 ${className}`}>
      {children}
    </div>
  );
};

export default Card;
