'use client';

import React from 'react';

interface FlowStepProps {
  number: number;
  title: string;
  description: string;
  showArrow?: boolean;
}

export function FlowStep({
  number,
  title,
  description,
  showArrow = true,
}: FlowStepProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-center min-w-[140px]">
        <div className="w-10 h-10 rounded-full bg-[#667eea] text-white flex items-center justify-center font-semibold text-lg mb-2">
          {number}
        </div>
        <div className="font-semibold text-center mb-1">{title}</div>
        <div className="text-sm text-[#666666] text-center">{description}</div>
      </div>
      {showArrow && (
        <div className="text-[#999999] text-2xl hidden md:block">→</div>
      )}
    </div>
  );
}






