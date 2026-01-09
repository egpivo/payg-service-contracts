'use client';

import { useReadContract } from 'wagmi';
import PoolRegistryABI from '@/abis/PoolRegistryABI.json';
import { CONTRACT_ADDRESSES } from '@/config';
import { formatEther } from 'viem';
import { isMockMode } from '@/config/demoMode';

interface BeforeAfterPanelProps {
  poolId: string;
  showAfter: boolean;
  price?: string;
  duration?: number;
  memberCount?: number;
  totalShares?: number;
}

export function BeforeAfterPanel({ poolId, showAfter, price = '1', duration = 7, memberCount, totalShares }: BeforeAfterPanelProps) {
  const { data: poolData } = useReadContract({
    address: CONTRACT_ADDRESSES.PoolRegistry,
    abi: PoolRegistryABI,
    functionName: 'getPool',
    args: [BigInt(poolId)],
    query: { enabled: showAfter && !isMockMode },
  }) as { data: [bigint, string, bigint, bigint, bigint, number, boolean, bigint, bigint] | undefined };

  const hasAfterData = showAfter && (isMockMode || poolData);

  const kpis = [
    {
      label: 'Pool exists',
      before: 'false',
      after: hasAfterData ? 'true' : null,
      beforeColor: 'text-red-600',
      afterColor: 'text-green-600',
    },
    {
      label: 'Member count',
      before: '0',
      after: showAfter && poolData ? String(poolData[2]) : (hasAfterData ? String(memberCount ?? '—') : null),
      beforeColor: 'text-[#666666]',
      afterColor: 'text-[#1a1a1a]',
    },
    {
      label: 'Total shares',
      before: '0',
      after: showAfter && poolData ? String(poolData[3]) : (hasAfterData ? String(totalShares ?? '—') : null),
      beforeColor: 'text-[#666666]',
      afterColor: 'text-[#1a1a1a]',
    },
    {
      label: 'Price',
      before: '—',
      after: showAfter && poolData ? `${formatEther(poolData[4])} ETH` : (hasAfterData ? `${price} ETH` : null),
      beforeColor: 'text-[#999999]',
      afterColor: 'text-[#1a1a1a]',
    },
    {
      label: 'Duration',
      before: '—',
      after: showAfter && poolData ? `${Math.floor(Number(poolData[7]) / 86400)} days` : (hasAfterData ? `${duration} days` : null),
      beforeColor: 'text-[#999999]',
      afterColor: 'text-[#1a1a1a]',
    },
  ];

  return (
    <div className="bg-white rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
      <h3 className="text-xl font-semibold mb-4">Results</h3>
      
      <div className="space-y-3">
        {kpis.map((kpi, index) => (
          <div key={index} className="flex items-center justify-between py-2 border-b border-[#e0e0e0] last:border-0">
            <span className="text-[#666666] font-medium">{kpi.label}:</span>
            <div className="flex items-center gap-3">
              <span className={`font-semibold ${kpi.beforeColor}`}>{kpi.before}</span>
              <span className="text-[#999999]">→</span>
              <span className={`font-semibold ${kpi.after ? kpi.afterColor : 'text-[#999999]'}`}>
                {kpi.after || '—'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
