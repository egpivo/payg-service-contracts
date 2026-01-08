'use client';

import { useSwitchChain } from 'wagmi';
import { useChainId } from 'wagmi';

interface NetworkSwitchButtonProps {
  targetChainId: number;
  targetChainName?: string;
}

export function NetworkSwitchButton({ targetChainId, targetChainName = 'Localhost 8545' }: NetworkSwitchButtonProps) {
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();

  if (chainId === targetChainId) {
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
