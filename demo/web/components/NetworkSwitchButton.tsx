'use client';

import { useSwitchChain, useAccount } from 'wagmi';
import { useChainId } from 'wagmi';

interface NetworkSwitchButtonProps {
  targetChainId: number;
  targetChainName?: string;
}

export function NetworkSwitchButton({ targetChainId, targetChainName = 'Localhost 8545' }: NetworkSwitchButtonProps) {
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();
  const { isConnected } = useAccount();

  // Only show if wallet is connected and chainId doesn't match
  // Also allow undefined chainId (not connected) to pass through
  // Allow localhost networks (1337 and 31337 are both valid for local development)
  const isLocalhost = chainId === 1337 || chainId === 31337;
  const isTargetLocalhost = targetChainId === 1337 || targetChainId === 31337;
  
  if (!isConnected || !chainId || chainId === targetChainId || (isLocalhost && isTargetLocalhost)) {
    return null;
  }

  const handleSwitch = async () => {
    try {
      await switchChain({ chainId: targetChainId });
    } catch (error) {
      console.error('Failed to switch chain:', error);
    }
  };

  return (
    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-yellow-800 font-semibold mb-1">
            Network Mismatch
          </p>
          <p className="text-yellow-700 text-sm">
            Please switch to {targetChainName} (Chain ID: {targetChainId}) to continue
          </p>
        </div>
        <button
          onClick={handleSwitch}
          className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold px-6 py-2 rounded-lg transition-colors shadow-md"
        >
          Switch Network
        </button>
      </div>
    </div>
  );
}
