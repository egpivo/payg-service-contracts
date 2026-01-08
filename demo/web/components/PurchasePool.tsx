'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseEther } from 'viem';
import PoolRegistryABI from '@/abis/PoolRegistryABI.json';
import { CONTRACT_ADDRESSES } from '@/config';
import { LightBulbIcon } from './Icons';

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

  const { data: poolData } = useReadContract({
    address: CONTRACT_ADDRESSES.PoolRegistry,
    abi: PoolRegistryABI,
    functionName: 'getPool',
    args: poolId ? [BigInt(poolId)] : undefined,
    query: { enabled: !!poolId },
  }) as { data: [bigint, string, bigint, bigint, bigint, number, boolean, bigint, bigint] | undefined };

  const { data: hash, writeContract, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!poolPrice || !poolPrice[1]) {
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

  // Calculate breakdown for display
  const calculateBreakdown = () => {
    if (!poolPrice || !poolPrice[1] || !poolData) return null;
    
    const price = Number(poolPrice[1] as bigint) / 1e18;
    const operatorFeeBps = poolData[5] || 0;
    const operatorFee = price * (operatorFeeBps / 10000);
    const netRevenue = price - operatorFee;
    
    return { price, operatorFee, netRevenue, operatorFeeBps };
  };

  const breakdown = calculateBreakdown();

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Step 2 — Buy the Product</h2>
        <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.95rem', lineHeight: '1.5' }}>
          One payment, atomic settlement.
        </p>
      </div>

      {/* Access Renewal Explanation */}
      {poolData && poolData[7] > 0n && (
        <div style={{ 
          marginBottom: '1.5rem', 
          padding: '1rem', 
          background: '#e8f4f8',
          borderRadius: '6px',
          borderLeft: '4px solid #2196F3'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem', marginRight: '0.5rem' }}>🔄</span>
            <strong style={{ fontSize: '0.95rem' }}>Smart Renewal Logic</strong>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#555', lineHeight: '1.5' }}>
            <strong>If access is active:</strong> Renewal extends from your current expiry date (no time lost).
            <br />
            <strong>If access expired:</strong> Renewal starts from now (fresh start).
            <br />
            <small style={{ fontStyle: 'italic' }}>
              This ensures you never lose time on active subscriptions, while expired access gets a clean slate.
            </small>
          </p>
        </div>
      )}

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

        {poolPrice && poolPrice[1] && breakdown && (
          <div style={{ marginBottom: '1rem' }}>
            <div className="status status-info" style={{ marginBottom: '0.75rem' }}>
              <strong>Price Breakdown:</strong>
            </div>
            <div style={{ 
              padding: '0.75rem', 
              background: '#f8f9fa', 
              borderRadius: '4px',
              fontSize: '0.9rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span>Total Price:</span>
                <strong>{breakdown.price.toFixed(6)} ETH</strong>
              </div>
              {breakdown.operatorFeeBps > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', color: '#666' }}>
                  <span>Operator Fee ({breakdown.operatorFeeBps / 100}%):</span>
                  <span>-{breakdown.operatorFee.toFixed(6)} ETH</span>
                </div>
              )}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginTop: '0.5rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid #ddd',
                fontWeight: 'bold'
              }}>
                <span>Net Revenue (to providers):</span>
                <strong style={{ color: '#2196F3' }}>{breakdown.netRevenue.toFixed(6)} ETH</strong>
              </div>
              <div style={{
                marginTop: '0.5rem',
                fontSize: '0.8rem',
                color: '#666',
                fontStyle: 'italic',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem'
              }}>
                <span style={{ marginTop: '0.1rem', flexShrink: 0 }}>
                  <LightBulbIcon className="w-4 h-4" />
                </span>
                <span>Net revenue is split among providers based on their shares. Any remainder goes to the first provider.</span>
              </div>
            </div>
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
          <small style={{ display: 'block', marginTop: '0.25rem', color: '#666', fontSize: '0.85rem' }}>
            Affiliate address is tracked via events (v1: no fee, future versions may support affiliate fees).
          </small>
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
            <br />
            <small style={{ display: 'block', marginTop: '0.5rem' }}>
              ✅ Access granted • 💰 Revenue split executed atomically • 📊 Check &quot;Inspect Pool&quot; to see details
            </small>
          </div>
        )}
      </form>
    </div>
  );
}
