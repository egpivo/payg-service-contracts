'use client';

import { useEffect, useState } from 'react';

interface SettlementSuccessCardProps {
  totalPayment: string;
  netRevenue: string;
  operatorFee: string;
  gasUsed?: bigint;
  gasPrice?: bigint;
  onAnimationComplete?: () => void;
}

export function SettlementSuccessCard({
  totalPayment,
  netRevenue,
  operatorFee,
  gasUsed,
  gasPrice,
  onAnimationComplete,
}: SettlementSuccessCardProps) {
  const [showContent, setShowContent] = useState(false);
  const [rippleComplete, setRippleComplete] = useState(false);

  useEffect(() => {
    // Show content after ripple animation
    const timer1 = setTimeout(() => setShowContent(true), 1500);
    const timer2 = setTimeout(() => {
      setRippleComplete(true);
      onAnimationComplete?.();
    }, 2000);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onAnimationComplete]);

  // Calculate gas saved (estimate)
  const estimatedGasSaved = gasUsed && gasPrice 
    ? (Number(gasUsed) * Number(gasPrice)) / 1e18 
    : null;

  return (
    <div className="relative bg-white/90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border-2 border-green-200 overflow-hidden">
      {/* Ripple Animation */}
      {!rippleComplete && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="absolute w-0 h-0 rounded-full bg-green-500 opacity-30"
            style={{
              animation: 'ripple 2s ease-out forwards',
            }}
          />
          <div
            className="absolute w-0 h-0 rounded-full bg-green-400 opacity-20"
            style={{
              animation: 'ripple 2s ease-out 0.3s forwards',
            }}
          />
          <div
            className="absolute w-0 h-0 rounded-full bg-green-300 opacity-10"
            style={{
              animation: 'ripple 2s ease-out 0.6s forwards',
            }}
          />
        </div>
      )}

      {/* Success Icon */}
      <div className="flex items-center justify-center mb-6">
        <div
          className={`w-20 h-20 rounded-full bg-green-500 flex items-center justify-center transition-all duration-500 ${
            showContent ? 'scale-100' : 'scale-0'
          }`}
        >
          <svg
            className="w-12 h-12 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div
        className={`text-center transition-all duration-500 ${
          showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <h2 className="text-3xl font-bold text-green-600 mb-2">Settlement Complete!</h2>
        <p className="text-[#666666] mb-6">
          Your payment has been successfully distributed to all providers on-chain.
        </p>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-[#667eea]/10 to-[#764ba2]/10 rounded-lg p-4 border border-[#667eea]/20">
            <div className="text-sm text-[#666666] mb-1">Total Payment</div>
            <div className="text-2xl font-bold text-[#667eea]">{totalPayment} ETH</div>
          </div>
          <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg p-4 border border-gray-300">
            <div className="text-sm text-[#666666] mb-1">Operator Fee</div>
            <div className="text-2xl font-bold text-[#1a1a1a]">{operatorFee} ETH</div>
          </div>
          <div className="bg-gradient-to-br from-green-100 to-green-200 rounded-lg p-4 border border-green-300">
            <div className="text-sm text-[#666666] mb-1">Net Revenue</div>
            <div className="text-2xl font-bold text-green-600">{netRevenue} ETH</div>
          </div>
        </div>

        {/* Benefits Tags */}
        <div className="flex flex-wrap gap-2 justify-center">
          <span className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-semibold border border-blue-200">
            ✓ Fully Automated
          </span>
          <span className="px-4 py-2 bg-purple-50 text-purple-700 rounded-full text-sm font-semibold border border-purple-200">
            ✓ Transparent
          </span>
          {estimatedGasSaved && (
            <span className="px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-semibold border border-green-200">
              ⚡ Gas Saved: ~{estimatedGasSaved.toFixed(6)} ETH
            </span>
          )}
          <span className="px-4 py-2 bg-orange-50 text-orange-700 rounded-full text-sm font-semibold border border-orange-200">
            🚀 Instant Settlement
          </span>
        </div>
      </div>

      <style jsx>{`
        @keyframes ripple {
          0% {
            width: 0;
            height: 0;
            opacity: 0.3;
          }
          100% {
            width: 500px;
            height: 500px;
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
