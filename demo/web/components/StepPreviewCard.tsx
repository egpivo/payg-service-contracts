'use client';

import React from 'react';
import { CheckIcon } from './Icons';

type StepStatus = 'done' | 'active' | 'locked';

interface StepPreviewCardProps {
  number: number;
  title: string;
  description: string;
  status?: StepStatus;
}

export function StepPreviewCard({
  number,
  title,
  description,
  status = 'locked',
}: StepPreviewCardProps) {
  const getStyles = () => {
    switch (status) {
      case 'done':
        return {
          border: 'border-[#10b981]',
          bg: 'bg-[#f0fdf4]',
          text: 'text-[#166534]',
          indicator: <CheckIcon className="w-5 h-5" />,
        };
      case 'active':
        return {
          border: 'border-[#3b82f6]',
          bg: 'bg-[#eff6ff]',
          text: 'text-[#1e40af]',
          indicator: '→',
        };
      case 'locked':
      default:
        return {
          border: 'border-[#e5e7eb]',
          bg: 'bg-[#f9fafb]',
          text: 'text-[#6b7280]',
          indicator: '○',
        };
    }
  };

  const styles = getStyles();

  return (
    <div className={`${styles.bg} border-l-4 ${styles.border} rounded-r-lg p-4`}>
      <div className={`font-semibold mb-2 flex items-center gap-2 ${styles.text}`}>
        {typeof styles.indicator === 'string' ? (
          <span className="text-lg">{styles.indicator}</span>
        ) : (
          styles.indicator
        )}
        <span>Step {number}: {title}</span>
      </div>
      <div className="text-sm text-[#666666]">
        {description}
      </div>
    </div>
  );
}


