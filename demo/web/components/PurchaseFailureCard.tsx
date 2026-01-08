'use client';

import { XIcon, LightBulbIcon } from './Icons';

interface PurchaseFailureCardProps {
  txHash?: string;
  errorMessage?: string;
  onRetry?: () => void;
  onBack?: () => void;
}

export function PurchaseFailureCard({
  txHash,
  errorMessage,
  onRetry,
  onBack,
}: PurchaseFailureCardProps) {
  const getErrorMessage = () => {
    if (errorMessage) {
      const msg = errorMessage.toLowerCase();
      if (msg.includes('user rejected') || msg.includes('user denied')) {
        return 'Transaction was rejected in your wallet.';
      }
      if (msg.includes('insufficient funds') || msg.includes('balance')) {
        return 'Insufficient balance. Please check your wallet balance.';
      }
      if (msg.includes('revert') || msg.includes('execution reverted')) {
        return 'Transaction was reverted. The purchase may have failed due to contract conditions.';
      }
      return errorMessage;
    }
    return 'The purchase transaction failed. Please try again.';
  };

  return (
    <div className="relative bg-white/90 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border-2 border-red-200 overflow-hidden">
      {/* Error Icon */}
      <div className="flex items-center justify-center mb-6">
        <div className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center">
          <XIcon className="w-12 h-12 text-white" />
        </div>
      </div>

      {/* Content */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-red-600 mb-2">Purchase Failed</h2>
        <p className="text-[#666666] mb-6">
          {getErrorMessage()}
        </p>

        {/* Error Details */}
        {txHash && (
          <div className="bg-red-50 rounded-lg p-4 mb-6 border border-red-200">
            <div className="text-sm text-[#666666] mb-2">Transaction Hash:</div>
            <div className="font-mono text-sm text-red-700 break-all">{txHash}</div>
          </div>
        )}

        {/* Helpful Tips */}
        <div className="bg-yellow-50 rounded-lg p-4 mb-6 border border-yellow-200">
          <div className="flex items-start gap-2">
            <LightBulbIcon className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-left text-sm text-[#666666]">
              <div className="font-semibold text-yellow-800 mb-1">Common causes:</div>
              <ul className="list-disc list-inside space-y-1 text-yellow-700">
                <li>Insufficient balance in your wallet</li>
                <li>Network congestion or high gas prices</li>
                <li>Transaction rejected in MetaMask</li>
                <li>Contract conditions not met</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="px-6 py-3 text-sm text-[#666666] hover:text-[#333333] border border-[#e0e0e0] rounded-lg hover:bg-[#f5f5f5] transition-colors"
            >
              ← Back to Package
            </button>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-6 py-3 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-lg hover:from-[#5568d3] hover:to-[#6a3f8f] transition-all font-semibold"
            >
              Try Again →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
