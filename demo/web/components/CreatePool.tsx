'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import PoolRegistryABI from '@/abis/PoolRegistryABI.json';
import { CONTRACT_ADDRESSES } from '@/config';

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

  const loadExample = () => {
    setPoolId('1');
    setPrice('0.1');
    setAccessDuration('86400'); // 1 day
    setOperatorFeeBps('200');
    // Example: Article + Rental pool
    setMembersInput('1:0x1234567890123456789012345678901234567890:100\n2:0x1234567890123456789012345678901234567890:200');
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Step 1 — Define the Product</h2>
        <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.95rem', lineHeight: '1.5' }}>
          What users buy, who gets paid, and how revenue is split.
        </p>
      </div>
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={loadExample}
          className="button button-secondary"
          style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
        >
          Load Example
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
            placeholder="e.g., 1"
          />
        </div>

        <div className="form-group">
          <label>Product Price (paid once)</label>
          <input
            type="text"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            placeholder="e.g., 0.1 ETH"
          />
        </div>

        <div className="form-group">
          <label>Access Duration (seconds, 0 = permanent)</label>
          <input
            type="number"
            value={accessDuration}
            onChange={(e) => setAccessDuration(e.target.value)}
            required
            placeholder="e.g., 86400 (1 day)"
          />
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
        </div>

        <div className="form-group">
          <label>
            Revenue Recipients (providers)
            <br />
            <small style={{ fontWeight: 'normal', color: '#666' }}>
              One per line: serviceId:registry:shares
            </small>
          </label>
          <textarea
            value={membersInput}
            onChange={(e) => setMembersInput(e.target.value)}
            required
            placeholder="1:0x1234...5678:100&#10;2:0x1234...5678:200"
          />
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
          </div>
        )}
      </form>
    </div>
  );
}

