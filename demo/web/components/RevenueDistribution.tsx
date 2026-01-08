'use client';

import { useState, useEffect } from 'react';

interface ProviderInfo {
  name: string;
  address: string;
  amount: string;
  percentage: number;
  color: string;
}

interface RevenueDistributionProps {
  totalPayment: string;
  operatorFee: string;
  netRevenue: string;
  providers: ProviderInfo[];
  ethPrice?: number; // USD price per ETH
}

export function RevenueDistribution({
  totalPayment,
  operatorFee,
  netRevenue,
  providers,
  ethPrice,
}: RevenueDistributionProps) {
  const [hoveredProvider, setHoveredProvider] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddress(addr);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const formatUSD = (ethAmount: string) => {
    if (!ethPrice) return null;
    const usd = parseFloat(ethAmount) * ethPrice;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(usd);
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-white/20">
      <h3 className="mb-4 text-xl font-semibold text-[#1a1a1a]">
        Revenue Distribution
      </h3>
      
      {/* Total Payment */}
      <div className="mb-4 p-4 bg-gradient-to-r from-[#667eea]/10 to-[#764ba2]/10 rounded-lg border border-[#667eea]/20">
        <div className="flex items-baseline justify-between">
          <span className="text-[#666666] text-sm">Total Payment:</span>
          <div className="text-right">
            <div className="text-2xl font-bold text-[#667eea]">{totalPayment} ETH</div>
            {ethPrice && (
              <div className="text-sm text-[#666666] mt-1">
                ≈ {formatUSD(totalPayment)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Operator Fee */}
      <div className="mb-4 pb-4 border-b border-[#e0e0e0]">
        <div className="flex items-baseline justify-between">
          <span className="text-[#666666] text-sm">Operator Fee:</span>
          <div className="text-right">
            <span className="text-lg font-semibold text-[#1a1a1a]">{operatorFee} ETH</span>
            {ethPrice && (
              <div className="text-xs text-[#666666] mt-1">
                ≈ {formatUSD(operatorFee)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Net Revenue */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between mb-4">
          <span className="text-[#666666] text-sm font-medium">Net Revenue:</span>
          <div className="text-right">
            <span className="text-xl font-bold text-[#10b981]">{netRevenue} ETH</span>
            {ethPrice && (
              <div className="text-sm text-[#666666] mt-1">
                ≈ {formatUSD(netRevenue)}
              </div>
            )}
          </div>
        </div>

        {/* Providers */}
        <div className="space-y-4">
          {providers.map((provider, index) => {
            const isHovered = hoveredProvider === provider.name;
            
            return (
              <div
                key={index}
                className="p-4 bg-[#f8f9fa] rounded-lg border border-[#e0e0e0] hover:border-[#667eea] transition-all"
                onMouseEnter={() => setHoveredProvider(provider.name)}
                onMouseLeave={() => setHoveredProvider(null)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[#666666]">{provider.name}</span>
                    <div className="relative group">
                      <button
                        onClick={() => copyAddress(provider.address)}
                        className="text-[#667eea] hover:text-[#5568d3] transition-colors"
                        title="Copy provider address"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v2m7 5V9a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2" />
                        </svg>
                      </button>
                      {isHovered && (
                        <div className="absolute left-0 top-6 bg-[#1a1a1a] text-white text-xs px-3 py-2 rounded-lg shadow-lg z-10 whitespace-nowrap">
                          <div className="font-mono">{provider.address}</div>
                          <div className="text-[#999999] text-xs mt-1">
                            {copiedAddress === provider.address ? 'Copied!' : 'Click to copy'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-[#1a1a1a]">
                      {provider.amount} ETH ({provider.percentage}%)
                    </div>
                    {ethPrice && (
                      <div className="text-xs text-[#666666] mt-1">
                        ≈ {formatUSD(provider.amount)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-full bg-[#e5e7eb] rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${provider.color}`}
                    style={{ width: `${provider.percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
