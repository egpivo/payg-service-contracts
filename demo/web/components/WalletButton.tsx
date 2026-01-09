'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { isMockMode } from '@/config/demoMode';

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();

  // In mock mode, show a demo indicator instead of wallet connection
  if (isMockMode) {
    return (
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: '#666666' }}>
          Demo Mode
        </span>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <button onClick={() => disconnect()} className="button button-secondary">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div>
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
          className="button"
        >
          Connect {connector.name}
        </button>
      ))}
    </div>
  );
}

