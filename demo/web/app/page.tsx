'use client';

import { useAccount } from 'wagmi';
import { CreatePool } from '@/components/CreatePool';
import { PurchasePool } from '@/components/PurchasePool';
import { InspectPool } from '@/components/InspectPool';
import { WalletButton } from '@/components/WalletButton';

export default function Home() {
  const { isConnected, address } = useAccount();

  return (
    <div className="container">
      <div className="header">
        <h1>PAYG Pool Protocol Demo</h1>
        <p>Create a product → Buy once → Access services → Providers get paid</p>
      </div>

      {/* Product Flow Header */}
      <div className="flow-header">
        <div className="flow-step">
          <div className="flow-icon">🧱</div>
          <div className="flow-label">Create Pool</div>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-step">
          <div className="flow-icon">💳</div>
          <div className="flow-label">Purchase</div>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-step">
          <div className="flow-icon">🔓</div>
          <div className="flow-label">Access</div>
        </div>
        <div className="flow-arrow">→</div>
        <div className="flow-step">
          <div className="flow-icon">💰</div>
          <div className="flow-label">Settlement</div>
        </div>
      </div>

      <div className="wallet-section">
        <div>
          <strong>Wallet Connection</strong>
          <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
            {isConnected ? `Connected: ${address?.slice(0, 6)}...${address?.slice(-4)}` : 'Not connected'}
          </p>
        </div>
        <WalletButton />
      </div>

      {isConnected ? (
        <div className="steps-container">
          <div className="step-card">
            <CreatePool />
          </div>
          <div className="step-card">
            <PurchasePool />
          </div>
          <div className="step-card">
            <InspectPool />
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="status status-info">
            Please connect your wallet to interact with the protocol.
          </div>
        </div>
      )}
    </div>
  );
}

