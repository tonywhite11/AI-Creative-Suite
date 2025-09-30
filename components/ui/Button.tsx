
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ children, className, ...props }) => {
  return (
    <button
      className={`
        px-6 py-3 font-semibold text-white rounded-lg shadow-md
        bg-gradient-to-r from-brand-primary to-brand-secondary
        hover:from-brand-primary hover:to-purple-600
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-base-100 focus:ring-brand-light
        transition-all duration-300 ease-in-out
        disabled:opacity-50 disabled:cursor-not-allowed disabled:saturate-50
        flex items-center justify-center
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
