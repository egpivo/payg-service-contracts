'use client';

import React from 'react';

interface InfoCardProps {
  children: React.ReactNode;
  variant?: 'default' | 'info' | 'success';
  className?: string;
}

export function InfoCard({
  children,
  variant = 'default',
  className = '',
}: InfoCardProps) {
  const baseClasses = 'rounded-lg p-6';
  
  const variantClasses = {
    default: 'bg-white border border-[#e0e0e0]',
    info: 'bg-[#e8f4f8] border-l-4 border-[#2196F3]',
    success: 'bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7] border-2 border-[#10b981]',
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
}






