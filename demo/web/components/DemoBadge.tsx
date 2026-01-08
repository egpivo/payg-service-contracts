'use client';

interface DemoBadgeProps {
  poolId: string;
  price: string;
  duration: number;
  operatorFeeBps: string;
}

export function DemoBadge({ poolId, price, duration, operatorFeeBps }: DemoBadgeProps) {
  const operatorFeePercent = Number(parseInt(operatorFeeBps) / 100);

  return (
    <div className="bg-white/15 backdrop-blur-sm rounded-lg p-4 mt-6 max-w-2xl mx-auto border border-white/20">
      <div className="space-y-3 text-sm">
        <div className="text-center">
          <span className="text-white/80 text-xs font-medium">Demo scenario:</span>
          <div className="text-white font-semibold mt-0.5">Cross-registry composition</div>
        </div>
        <div className="pt-3 border-t border-white/20 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <span className="text-white/70 text-xs block mb-1">Pool</span>
            <span className="text-white font-mono font-semibold">#{poolId}</span>
          </div>
          <div>
            <span className="text-white/70 text-xs block mb-1">Price</span>
            <span className="text-white font-semibold">{price} ETH</span>
          </div>
          <div>
            <span className="text-white/70 text-xs block mb-1">Duration</span>
            <span className="text-white font-semibold">{duration} days</span>
          </div>
          <div>
            <span className="text-white/70 text-xs block mb-1">Fee</span>
            <span className="text-white font-semibold">{operatorFeePercent}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}


