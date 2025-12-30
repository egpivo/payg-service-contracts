'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseEther } from 'viem';
import PoolRegistryABI from '@/abis/PoolRegistryABI.json';
import { CONTRACT_ADDRESSES } from '@/config';

export function PurchasePool() {
  const [poolId, setPoolId] = useState('');
  const [affiliate, setAffiliate] = useState('');
  
  const { data: poolPrice } = useReadContract({
    address: CONTRACT_ADDRESSES.PoolRegistry,
    abi: PoolRegistryABI,
    functionName: 'services',
    args: poolId ? [BigInt(poolId)] : undefined,
    query: { enabled: !!poolId },
  }) as { data: [bigint, bigint, string, bigint, boolean] | undefined };

  const { data: hash, writeContract, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!poolPrice || !poolPrice[4]) {
      alert('Pool does not exist');
      return;
    }

    const price = poolPrice[1] as bigint; // price is at index 1

    writeContract({
      address: CONTRACT_ADDRESSES.PoolRegistry,
      abi: PoolRegistryABI,
      functionName: 'purchasePool',
      args: [
        BigInt(poolId),
        affiliate || '0x0000000000000000000000000000000000000000',
      ],
      value: price,
    });
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Step 2 — Buy the Product</h2>
        <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.95rem', lineHeight: '1.5' }}>
          One payment, atomic settlement.
        </p>
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

        {poolPrice && poolPrice[1] && (
          <div className="status status-info" style={{ marginBottom: '1rem' }}>
            Pool Price: {String(Number(poolPrice[1] as bigint) / 1e18)} ETH
          </div>
        )}

        <div className="form-group">
          <label>Affiliate Address (optional)</label>
          <input
            type="text"
            value={affiliate}
            onChange={(e) => setAffiliate(e.target.value)}
            placeholder="0x0000...0000"
          />
        </div>

        <button
          type="submit"
          className="button"
          disabled={isPending || isConfirming || !poolPrice}
        >
          {isPending ? 'Confirming...' : isConfirming ? 'Processing...' : 'Purchase Product'}
        </button>

        {error && (
          <div className="status status-error" style={{ marginTop: '1rem' }}>
            Error: {error.message}
          </div>
        )}

        {isConfirmed && (
          <div className="status status-success" style={{ marginTop: '1rem' }}>
            Pool purchased successfully! Transaction: {hash?.slice(0, 10)}...
          </div>
        )}
      </form>
    </div>
  );
}

