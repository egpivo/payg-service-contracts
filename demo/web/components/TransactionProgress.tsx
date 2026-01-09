'use client';

interface TransactionProgressProps {
  currentStep: number;
  totalSteps: number;
  steps: {
    label: string;
    status: 'pending' | 'active' | 'completed' | 'error';
  }[];
}

export function TransactionProgress({ currentStep, totalSteps, steps }: TransactionProgressProps) {
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
                <div className="mt-2 text-center">
                  <div
                    className={`text-xs font-medium ${
                      isActive || isCompleted
                        ? 'text-[#667eea]'
                        : isError
                        ? 'text-red-600'
                        : 'text-[#999999]'
                    }`}
                  >
                    {step.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
