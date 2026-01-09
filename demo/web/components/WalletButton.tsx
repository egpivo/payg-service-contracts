'use client';

import { useEffect, useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { PrimaryButton } from './PrimaryButton';
import { isMockMode } from '@/config/demoMode';

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect, error, isPending, reset } = useConnect();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle connection with error handling
  const handleConnect = (connector: any) => {
    try {
      reset(); // Clear any previous errors
      connect({ connector });
    } catch (err) {
      // Error is handled by wagmi's error state
      console.error('Connection error:', err);
    }
  };

  // Get user-friendly error message
  const getErrorMessage = (error: Error | null): string | null => {
    if (!error) return null;
    
    const message = error.message.toLowerCase();
    if (message.includes('user rejected') || message.includes('user denied')) {
      return 'Connection rejected. Please try again.';
    }
    if (message.includes('metamask') && message.includes('not found')) {
      return 'MetaMask not found. Please install MetaMask extension.';
    }
    if (message.includes('failed to connect')) {
      return 'Failed to connect. Please check MetaMask is unlocked and try again.';
    }
    return error.message || 'Connection failed. Please try again.';
  };

  if (!mounted) {
    return (
      <PrimaryButton disabled>
        Loading...
      </PrimaryButton>
    );
  }

  if (isMockMode) {
    return (
      <PrimaryButton disabled>
        Demo Mode
      </PrimaryButton>
    );
  }

  if (isConnected) {
    return (
      <PrimaryButton variant="secondary" onClick={() => disconnect()}>
        Disconnect
      </PrimaryButton>
    );
  }

  if (!connectors || connectors.length === 0) {
    return (
      <PrimaryButton disabled>
        No wallet available
      </PrimaryButton>
    );
  }

  const errorMessage = getErrorMessage(error);

  return (
    <div className="flex flex-col gap-2">
      {errorMessage && (
        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
          {errorMessage}
        </div>
      )}
      <div className="flex gap-2">
        {connectors.map((connector) => (
          <PrimaryButton
            key={connector.uid}
            onClick={() => handleConnect(connector)}
            disabled={isPending}
          >
            {isPending ? 'Connecting...' : `Connect ${connector.name}`}
          </PrimaryButton>
        ))}
      </div>
    </div>
  );
}
