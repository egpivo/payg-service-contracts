'use client';

import { useReadContract } from 'wagmi';
import PoolRegistryABI from '@/abis/PoolRegistryABI.json';
import { CONTRACT_ADDRESSES } from '@/config';
import { formatEther } from 'viem';
import { isMockMode } from '@/config/demoMode';

interface ProtocolStatePanelProps {
  poolId: string;
  enabled?: boolean;
  mockData?: {
    price: string;
    accessDuration: number;
    operatorFeeBps: string;
    members: { serviceId: string; shares: string }[];
  };
}

export function ProtocolStatePanel({ poolId, enabled = true, mockData }: ProtocolStatePanelProps) {
  const { data: poolData } = useReadContract({
    address: CONTRACT_ADDRESSES.PoolRegistry,
    abi: PoolRegistryABI,
    functionName: 'getPool',
    args: [BigInt(poolId)],
    query: { enabled: enabled && !!poolId && !isMockMode },
  }) as { data: [bigint, string, bigint, bigint, bigint, number, boolean, bigint, bigint] | undefined };

  const { data: poolMembers } = useReadContract({
    address: CONTRACT_ADDRESSES.PoolRegistry,
    abi: PoolRegistryABI,
    functionName: 'getPoolMembersDetailed',
    args: poolId ? [BigInt(poolId)] : undefined,
    query: { enabled: enabled && !!poolId && !!poolData && !isMockMode },
  }) as { data: [bigint[], string[], bigint[]] | undefined };

  if (isMockMode && mockData) {
    const totalShares = mockData.members.reduce((sum, member) => sum + parseInt(member.shares, 10), 0);
    return (
      <div className="bg-white rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.1)] border-2 border-[#667eea]">
        <h3 className="text-xl font-semibold mb-4">Protocol State (Demo)</h3>
        <div className="space-y-3 font-mono text-sm">
          <div className="border-b border-[#e0e0e0] pb-2">
            <div className="text-[#666666] mb-1">Pool #{poolId}</div>
            <div className="text-2xl font-bold text-[#667eea]">────────────────────────</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-[#666666]">exists:</div>
            <div className="text-green-600 font-semibold">true</div>
            <div className="text-[#666666]">price:</div>
            <div className="text-[#1a1a1a] font-semibold">{mockData.price} ETH</div>
            <div className="text-[#666666]">accessDuration:</div>
            <div className="text-[#1a1a1a] font-semibold">{String(mockData.accessDuration)}</div>
            <div className="text-[#666666]">operatorFeeBps:</div>
            <div className="text-[#1a1a1a] font-semibold">{mockData.operatorFeeBps}</div>
            <div className="text-[#666666]">totalShares:</div>
            <div className="text-[#1a1a1a] font-semibold">{String(totalShares)}</div>
            <div className="text-[#666666]">usageCount:</div>
            <div className="text-[#1a1a1a] font-semibold">1</div>
            <div className="text-[#666666]">paused:</div>
            <div className="text-green-600 font-semibold">false</div>
          </div>
          {mockData.members.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#e0e0e0]">
              <div className="text-[#666666] mb-2 font-semibold">Members:</div>
              <div className="space-y-1">
                {mockData.members.map((member, index) => (
                  <div key={index} className="text-xs text-[#666666]">
                    - Service #{member.serviceId}  shares={member.shares}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!poolData) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.1)] border-2 border-dashed border-[#e0e0e0]">
        <h3 className="text-xl font-semibold mb-4 text-[#666666]">Protocol State (Live)</h3>
        <div className="text-[#999999] text-sm font-mono">
          Pool #{poolId}
          <div className="mt-2">exists: <span className="text-red-600">false</span></div>
        </div>
      </div>
    );
  }

  const [
    poolIdFromChain,
    operator,
    memberCount,
    totalShares,
    price,
    operatorFeeBps,
    paused,
    accessDuration,
    usageCount,
  ] = poolData;

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Map service IDs to names (for demo)
  const serviceNames: Record<string, string> = {
    '101': 'Rare Art Collection #101',
    '102': 'Historical Documents #102',
    '201': 'Luxury Hotel Space #201',
    '202': 'Premium Security #202',
    '203': 'Presentation Services #203',
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.1)] border-2 border-[#667eea]">
      <h3 className="text-xl font-semibold mb-4">Protocol State (Live)</h3>
      
      <div className="space-y-3 font-mono text-sm">
        <div className="border-b border-[#e0e0e0] pb-2">
          <div className="text-[#666666] mb-1">Pool #{String(poolIdFromChain)}</div>
          <div className="text-2xl font-bold text-[#667eea]">────────────────────────</div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="text-[#666666]">exists:</div>
          <div className="text-green-600 font-semibold">true</div>

          <div className="text-[#666666]">price:</div>
          <div className="text-[#1a1a1a] font-semibold">{formatEther(price)} ETH</div>

          <div className="text-[#666666]">accessDuration:</div>
          <div className="text-[#1a1a1a] font-semibold">{String(accessDuration)}</div>

          <div className="text-[#666666]">operatorFeeBps:</div>
          <div className="text-[#1a1a1a] font-semibold">{String(operatorFeeBps)}</div>

          <div className="text-[#666666]">totalShares:</div>
          <div className="text-[#1a1a1a] font-semibold">{String(totalShares)}</div>

          <div className="text-[#666666]">usageCount:</div>
          <div className="text-[#1a1a1a] font-semibold">{String(usageCount)}</div>

          <div className="text-[#666666]">paused:</div>
          <div className={paused ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
            {paused ? 'true' : 'false'}
          </div>
        </div>

        {poolMembers && poolMembers[0].length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#e0e0e0]">
            <div className="text-[#666666] mb-2 font-semibold">Members:</div>
            <div className="space-y-1">
              {poolMembers[0].map((serviceId, index) => {
                const serviceIdStr = String(serviceId);
                const shares = poolMembers[2][index];
                const registry = poolMembers[1][index];
                const serviceName = serviceNames[serviceIdStr] || `Service #${serviceIdStr}`;
                
                return (
                  <div key={index} className="text-xs text-[#666666]">
                    - {serviceName}  shares={String(shares)}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
