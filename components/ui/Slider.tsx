import React from 'react';

interface SliderProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  displayValue: string | number;
}

const Slider: React.FC<SliderProps> = ({ label, displayValue, ...props }) => {
  return (
    <div>
      <label htmlFor={props.id || label} className="flex justify-between items-center text-sm font-medium text-gray-300 mb-2">
        <span>{label}</span>
        <span className="font-bold text-brand-light bg-base-300 px-2 py-1 rounded-md">{displayValue}</span>
      </label>
      <input
        id={props.id || label}
        type="range"
        className="w-full h-2 bg-base-300 rounded-lg appearance-none cursor-pointer accent-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
        {...props}
      />
    </div>
  );
};

export default Slider;
