'use client';

import React, { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline';
type ButtonSize = 'small' | 'medium' | 'large' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  icon?: string;
  iconAlt?: string;
}

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  type = 'button',
  className = '',
  icon,
  iconAlt = 'icon',
  ...props
}) => {
  const baseClasses = 'font-medium rounded-md transition-colors duration-200 focus:outline-none';
  
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-[#566fe9] text-white hover:bg-[#4a5fd0] disabled:bg-gray-400',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 disabled:bg-gray-100',
    outline: 'border border-[#566fe9] text-[#566fe9] hover:bg-[#566fe90f] disabled:border-gray-200 disabled:text-gray-400',
  };
  
  const sizes: Record<ButtonSize, string> = {
    small: 'px-3 py-1 text-sm',
    medium: 'px-4 py-2 text-base',
    large: 'px-6 py-3 text-lg',
    icon: 'w-12 h-12 flex items-center justify-center',
  };
  
  const buttonClasses = `${baseClasses} ${variants[variant]} ${sizes[size]} ${disabled ? 'cursor-not-allowed' : ''} ${className}`;
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={buttonClasses}
      {...props}
    >
      {icon ? (
        <img src={icon} alt={iconAlt} className="w-6 h-6" />
      ) : (
        children
      )}
    </button>
  );
};

export default Button;