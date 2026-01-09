'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import PoolRegistryABI from '@/abis/PoolRegistryABI.json';
import { CONTRACT_ADDRESSES } from '@/config';
import { LightBulbIcon, CheckIcon } from './Icons';

export function CreatePool() {
  const [poolId, setPoolId] = useState('');
  const [price, setPrice] = useState('');
  const [accessDuration, setAccessDuration] = useState('0');
  const [operatorFeeBps, setOperatorFeeBps] = useState('200'); // 2%
  const [membersInput, setMembersInput] = useState('');
  
  const { data: hash, writeContract, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Parse members input: format "serviceId:registry:shares" per line
    const lines = membersInput.trim().split('\n').filter(line => line.trim());
    const serviceIds: bigint[] = [];
    const registries: `0x${string}`[] = [];
    const shares: bigint[] = [];

    for (const line of lines) {
      const [serviceId, registry, share] = line.split(':').map(s => s.trim());
      if (!serviceId || !registry || !share) {
        alert('Invalid member format. Use: serviceId:registry:shares (one per line)');
        return;
      }
      serviceIds.push(BigInt(serviceId));
      registries.push(registry as `0x${string}`);
      shares.push(BigInt(share));
    }

    if (serviceIds.length === 0) {
      alert('Please add at least one member');
      return;
    }

    writeContract({
      address: CONTRACT_ADDRESSES.PoolRegistry,
      abi: PoolRegistryABI,
      functionName: 'createPool',
      args: [
        BigInt(poolId),
        serviceIds,
        registries,
        shares,
        parseEther(price),
        BigInt(accessDuration),
        parseInt(operatorFeeBps),
      ],
    });
  };

  const loadLibraryExample = () => {
    // Mobile Library Example: Multiple authors (books) in one library pass
    // Pool #42: 1 ETH for 7 days, operator fee 2%
    // Members: Article(101) weight=2, Article(102) weight=1, Article(103) weight=1
    // All from same ArticleRegistry (like different authors in the library)
    setPoolId('42');
    setPrice('1');
    setAccessDuration('604800'); // 7 days = 7 * 24 * 60 * 60
    setOperatorFeeBps('200'); // 2%
    // Format: serviceId:registry:shares
    // Simulating ArticleRegistry at a specific address
    // In real deployment, use actual deployed ArticleRegistry address
    setMembersInput(
      '101:0x1234567890123456789012345678901234567890:2\n' +  // Author A's article (weight 2)
      '102:0x1234567890123456789012345678901234567890:1\n' +  // Author B's article (weight 1)
      '103:0x1234567890123456789012345678901234567890:1'      // Author C's article (weight 1)
    );
  };

  const loadCrossRegistryExample = () => {
    // Cross-Module Example: Art Collections + Hotel Spaces
    // Pool #42: 1 ETH for 7 days, operator fee 2%
    // Members: Rare Art Collection(101) weight=3, Luxury Hotel Space(201) weight=2, Premium Security(202) weight=1
    // Demonstrates cross-registry composition: art collections + hotel spaces rented by service providers
    setPoolId('42');
    setPrice('1');
    setAccessDuration('604800'); // 7 days
    setOperatorFeeBps('200'); // 2%
    // Same serviceId from different registries is allowed!
    setMembersInput(
      '101:0x1111111111111111111111111111111111111111:3\n' + // Rare Art Collection #101 from ArticleRegistry
      '201:0x2222222222222222222222222222222222222222:2\n' + // Luxury Hotel Space #201 from RentalRegistry
      '202:0x2222222222222222222222222222222222222222:1'     // Premium Security #202 from RentalRegistry
    );
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Step 1 — Define the Product</h2>
        <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.95rem', lineHeight: '1.5' }}>
          What users buy, who gets paid, and how revenue is split.
        </p>
      </div>

      {/* Quick Start Callout */}
      <div style={{ 
        marginBottom: '1.5rem', 
        padding: '1rem', 
        background: '#fff3cd',
        borderRadius: '8px',
        borderLeft: '4px solid #ffc107'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem' }}>
          <LightBulbIcon className="w-5 h-5" />
          <strong style={{ fontSize: '0.95rem', color: '#856404' }}>Quick Start</strong>
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#856404', lineHeight: '1.5' }}>
          Click <strong>&quot;📚 Mobile Library Example&quot;</strong> to load a real scenario: 3 authors, 1 library pass, 
          automatic revenue split. This demonstrates the core concept from the hero section above.
        </p>
      </div>

      {/* Cross-Registry Feature Highlight */}
      <div style={{ 
        marginBottom: '1.5rem', 
        padding: '1rem', 
        background: '#e8f4f8',
        borderRadius: '6px',
        borderLeft: '4px solid #2196F3'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.2rem', marginRight: '0.5rem' }}>🌐</span>
          <strong style={{ fontSize: '0.95rem' }}>Cross-Registry Composition</strong>
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#555', lineHeight: '1.5' }}>
          <strong>Key Feature:</strong> The same serviceId can exist in different registries! 
          This enables true cross-module composition (e.g., Article #1 + Rental #1 from different modules).
          Try both examples below.
        </p>
      </div>

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={loadLibraryExample}
          className="button button-secondary"
          style={{ 
            fontSize: '0.9rem', 
            padding: '0.75rem 1.5rem', 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
            color: 'white',
            fontWeight: '600',
            border: 'none',
            boxShadow: '0 2px 4px rgba(102, 126, 234, 0.3)'
          }}
        >
          📚 Mobile Library Example
        </button>
        <button
          type="button"
          onClick={loadCrossRegistryExample}
          className="button button-secondary"
          style={{ fontSize: '0.9rem', padding: '0.75rem 1.5rem' }}
        >
          🌐 Cross-Module Example
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Product ID</label>
          <input
            type="number"
            value={poolId}
            onChange={(e) => setPoolId(e.target.value)}
            required
            placeholder="e.g., 42"
          />
        </div>

        <div className="form-group">
          <label>Product Price (paid once)</label>
          <input
            type="text"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            placeholder="e.g., 1 ETH"
          />
          <small style={{ display: 'block', marginTop: '0.25rem', color: '#666', fontSize: '0.85rem' }}>
            One payment unlocks access to all services in the pool.
          </small>
        </div>

        <div className="form-group">
          <label>Access Duration (seconds, 0 = permanent)</label>
          <input
            type="number"
            value={accessDuration}
            onChange={(e) => setAccessDuration(e.target.value)}
            required
            placeholder="e.g., 604800 (7 days)"
          />
          <small style={{ display: 'flex', alignItems: 'flex-start', marginTop: '0.25rem', color: '#666', fontSize: '0.85rem', gap: '0.5rem' }}>
            <span style={{ marginTop: '0.1rem', flexShrink: 0 }}>
              <LightBulbIcon className="w-4 h-4" />
            </span>
            <span>Renewal behavior: If access is active, renewal extends from current expiry (no time lost). 
            If expired, renewal starts from now.</span>
          </small>
        </div>

        <div className="form-group">
          <label>Operator Fee (basis points, e.g., 200 = 2%)</label>
          <input
            type="number"
            value={operatorFeeBps}
            onChange={(e) => setOperatorFeeBps(e.target.value)}
            required
            placeholder="e.g., 200"
          />
          <small style={{ display: 'block', marginTop: '0.25rem', color: '#666', fontSize: '0.85rem' }}>
            Operator fee is deducted before revenue split. Net revenue = Price - (Price × OperatorFee%)
          </small>
        </div>

        <div className="form-group">
          <label>
            Revenue Recipients (providers/authors)
            <br />
            <small style={{ fontWeight: 'normal', color: '#666' }}>
              One per line: serviceId:registry:shares
              <br />
              <strong>Example:</strong> Same serviceId from different registries is allowed!
              <br />
              <code style={{ fontSize: '0.8rem', background: '#f0f0f0', padding: '0.2rem 0.4rem', borderRadius: '3px', display: 'block', marginTop: '0.25rem' }}>
                101:0x1111...1111:2  ← Article #101 from ArticleRegistry (weight 2)
                <br />
                201:0x2222...2222:1  ← Rental #201 from RentalRegistry (weight 1)
                <br />
                <span style={{ color: '#666' }}>Same serviceId from different registries = cross-registry composition</span>
              </code>
            </small>
          </label>
          <textarea
            value={membersInput}
            onChange={(e) => setMembersInput(e.target.value)}
            required
            rows={6}
            placeholder="101:0x1234...5678:2&#10;102:0x1234...5678:1"
          />
          <small style={{ display: 'block', marginTop: '0.25rem', color: '#666', fontSize: '0.85rem' }}>
            <strong>Shares are weights, not percentages.</strong> Revenue is split proportionally. 
            Remainder goes to the first provider (deterministic tie-breaker).
          </small>
        </div>

        <button
          type="submit"
          className="button"
          disabled={isPending || isConfirming}
        >
          {isPending ? 'Confirming...' : isConfirming ? 'Processing...' : 'Create Product'}
        </button>

        {error && (
          <div className="status status-error" style={{ marginTop: '1rem' }}>
            Error: {error.message}
          </div>
        )}

        {isConfirmed && (
          <div className="status status-success" style={{ marginTop: '1rem' }}>
            Pool created successfully! Transaction: {hash?.slice(0, 10)}...
            <br />
            <small style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CheckIcon className="w-4 h-4" />
                One product created
              </span>
              <span>•</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CheckIcon className="w-4 h-4" />
                Multiple providers configured
              </span>
              <span>•</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <CheckIcon className="w-4 h-4" />
                Revenue split defined
              </span>
            </small>
          </div>
        )}
      </form>
    </div>
  );
}
