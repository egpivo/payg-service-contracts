'use client';

import React from 'react';

interface PrimaryButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'success';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export function PrimaryButton({
  children,
  onClick,
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
}: PrimaryButtonProps) {
  const baseClasses = 'px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white hover:shadow-lg hover:shadow-[#667eea]/30',
    secondary: 'bg-[#666666] text-white hover:bg-[#555555]',
    success: 'bg-gradient-to-r from-[#10b981] to-[#059669] text-white hover:shadow-lg hover:shadow-[#10b981]/30',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
}






