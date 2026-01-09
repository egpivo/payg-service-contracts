'use client';

import { useState } from 'react';
import { LightBulbIcon } from './Icons';

interface TransactionProgressProps {
  currentStep: number;
  totalSteps: number;
  steps: {
    label: string;
    status: 'pending' | 'active' | 'completed' | 'error';
    tooltip?: string;
  }[];
}

export function TransactionProgress({ currentStep, totalSteps, steps }: TransactionProgressProps) {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-white/20 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#1a1a1a]">Transaction Progress</h3>
        <span className="text-sm text-[#666666]">
          Step {currentStep} of {totalSteps}
        </span>
      </div>
      
      <div className="relative">
        {/* Progress Bar Background */}
        <div className="absolute top-5 left-0 right-0 h-1 bg-[#e0e0e0] rounded-full" />
        
        {/* Progress Bar Fill */}
        <div
          className="absolute top-5 left-0 h-1 bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-full transition-all duration-500"
          style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
        />
        
        {/* Steps */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const isActive = step.status === 'active';
            const isCompleted = step.status === 'completed';
            const isError = step.status === 'error';
            
            return (
              <div key={index} className="flex flex-col items-center" style={{ flex: 1 }}>
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                    isCompleted
                      ? 'bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white shadow-lg'
                      : isActive
                      ? 'bg-[#667eea] text-white shadow-md animate-pulse'
                      : isError
                      ? 'bg-red-500 text-white'
                      : 'bg-[#e0e0e0] text-[#999999]'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    stepNumber
                  )}
                </div>
                <div className="mt-2 text-center relative">
                  <div
                    className={`text-xs font-medium ${
                      isActive || isCompleted
                        ? 'text-[#667eea]'
                        : isError
                        ? 'text-red-600'
                        : 'text-[#999999]'
                    }`}
                    onMouseEnter={() => step.tooltip && setHoveredStep(index)}
                    onMouseLeave={() => setHoveredStep(null)}
                  >
                    {step.label}
                  </div>
                  {step.tooltip && hoveredStep === index && (
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-64 bg-[#1a1a1a] text-white text-xs rounded-lg p-3 shadow-xl z-10">
                      <div className="flex items-start gap-2">
                        <LightBulbIcon className="w-4 h-4 text-[#667eea] mt-0.5 flex-shrink-0" />
                        <p>{step.tooltip}</p>
                      </div>
                      <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-[#1a1a1a] rotate-45" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
