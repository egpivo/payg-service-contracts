'use client';

import { useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import PoolRegistryABI from '@/abis/PoolRegistryABI.json';
import { CONTRACT_ADDRESSES } from '@/config';
import { LockIcon, LightBulbIcon, UnlockIcon, MoneyIcon, CheckIcon, XIcon, PauseIcon } from './Icons';

export function InspectPool() {
  const { address } = useAccount();
  const [poolId, setPoolId] = useState('');
  const [userAddress, setUserAddress] = useState(address || '');

  // Map service IDs to names (for demo)
  const serviceNames: Record<string, string> = {
    '101': 'Rare Art Collection #101',
    '201': 'Luxury Hotel Space #201',
    '202': 'Premium Security #202',
  };

  const { data: poolData } = useReadContract({
    address: CONTRACT_ADDRESSES.PoolRegistry,
    abi: PoolRegistryABI,
    functionName: 'getPool',
    args: poolId ? [BigInt(poolId)] : undefined,
    query: { enabled: !!poolId },
  }) as { data: [bigint, string, bigint, bigint, bigint, number, boolean, bigint, bigint] | undefined };

  const { data: accessExpiry } = useReadContract({
    address: CONTRACT_ADDRESSES.PoolRegistry,
    abi: PoolRegistryABI,
    functionName: 'poolAccessExpiry',
    args: userAddress && poolId ? [userAddress as `0x${string}`, BigInt(poolId)] : undefined,
    query: { enabled: !!poolId && !!userAddress },
  });

  const { data: earnings } = useReadContract({
    address: CONTRACT_ADDRESSES.PoolRegistry,
    abi: PoolRegistryABI,
    functionName: 'earnings',
    args: userAddress ? [userAddress as `0x${string}`] : undefined,
    query: { enabled: !!userAddress },
  });

  const { data: poolMembers } = useReadContract({
    address: CONTRACT_ADDRESSES.PoolRegistry,
    abi: PoolRegistryABI,
    functionName: 'getPoolMembersDetailed',
    args: poolId ? [BigInt(poolId)] : undefined,
    query: { enabled: !!poolId },
  }) as { data: [bigint[], string[], bigint[]] | undefined };

  // Get provider addresses for each member (would need additional calls in production)
  // For demo, we'll show registry addresses

  const formatAccessStatus = (expiry: bigint | undefined) => {
    if (!expiry) return { status: 'No access', active: false, timeLeft: null };
    if (expiry === BigInt('2') ** BigInt('256') - BigInt('1')) {
      return { status: 'Permanent', active: true, timeLeft: null };
    }
    const expiryTime = Number(expiry) * 1000;
    const now = Date.now();
    const timeLeft = expiryTime - now;
    if (timeLeft <= 0) {
      return { status: 'Expired', active: false, timeLeft: null };
    }
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    return {
      status: 'Active',
      active: true,
      timeLeft: days > 0 ? `${days} days ${hours} hours` : hours > 0 ? `${hours} hours ${minutes} minutes` : `${minutes} minutes`
    };
  };

  const accessStatus = formatAccessStatus(accessExpiry as bigint | undefined);

  // Calculate protocol invariants for display
  const calculateInvariants = () => {
    if (!poolData || !poolMembers || !poolMembers[0]) return null;
    
    const totalShares = poolData[3];
    const calculatedShares = poolMembers[2]?.reduce((sum, share) => sum + share, 0n) || 0n;
    const sharesMatch = totalShares === calculatedShares;
    
    return { totalShares, calculatedShares, sharesMatch };
  };

  const invariants = calculateInvariants();

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Step 3 — Observe the System</h2>
        <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.95rem', lineHeight: '1.5' }}>
          View product details, revenue splits, and user access.
        </p>
      </div>
      
      <div className="form-group">
        <label>Product ID</label>
        <input
          type="number"
          value={poolId}
          onChange={(e) => setPoolId(e.target.value)}
          placeholder="e.g., 1"
        />
      </div>

      <div className="form-group">
        <label>User Address (for access/earnings)</label>
        <input
          type="text"
          value={userAddress}
          onChange={(e) => setUserAddress(e.target.value)}
          placeholder={address || '0x0000...0000'}
        />
      </div>

      {poolData && (
        <>
          {/* Protocol Invariants Display */}
          {invariants && (
            <div style={{ 
              marginTop: '1.5rem', 
              padding: '1rem', 
              background: '#f0f9ff',
              borderRadius: '6px',
              borderLeft: '4px solid #0ea5e9'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem' }}>
                <LockIcon className="w-5 h-5" />
                <strong style={{ fontSize: '0.95rem' }}>Protocol Invariants</strong>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#555' }}>
                <div style={{ marginBottom: '0.25rem' }}>
                  <strong>Total Shares:</strong> {String(invariants.totalShares)} 
                  {invariants.sharesMatch ? (
                    <span style={{ color: '#10b981', marginLeft: '0.5rem', display: 'inline-flex', alignItems: 'center' }}>
                      <CheckIcon className="w-4 h-4" />
                    </span>
                  ) : (
                    <span style={{ color: '#ef4444', marginLeft: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <XIcon className="w-4 h-4" />
                      Mismatch!
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#666', fontStyle: 'italic' }}>
                  Protocol guarantee: totalShares always equals sum of member shares (verified by invariant tests).
                </div>
              </div>
            </div>
          )}

          {/* Product Info */}
          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>🧾 Product Info</h3>
            <ul className="item-list">
              <li>
                <strong>Product ID:</strong>
                <span>{poolId}</span>
              </li>
              <li>
                <strong>Price:</strong>
                <span>{poolData[4] ? `${String(Number(poolData[4]) / 1e18)} ETH` : 'N/A'}</span>
              </li>
              <li>
                <strong>Access Duration:</strong>
                <span>
                  {poolData[7] === 0n ? 'Permanent' : `${String(Number(poolData[7]) / 86400)} days`}
                </span>
              </li>
              <li>
                <strong>Operator Fee:</strong>
                <span>{Number(poolData[5] || 0) / 100}%</span>
              </li>
              <li>
                <strong>Status:</strong>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  {poolData[6] ? (
                    <>
                      <PauseIcon className="w-4 h-4" />
                      Paused
                    </>
                  ) : (
                    <>
                      <CheckIcon className="w-4 h-4" />
                      Active
                    </>
                  )}
                </span>
              </li>
              <li>
                <strong>Purchases:</strong>
                <span>{String(poolData[8] || 0)}</span>
              </li>
              <li>
                <strong>Members:</strong>
                <span>{String(poolData[2] || 0)}</span>
              </li>
            </ul>
          </div>

          {/* Revenue Split Visualization */}
          {poolMembers && poolMembers[0] && poolMembers[0].length > 0 && poolData[3] && (
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>👥 Providers & Revenue Split</h3>
              
              {/* Cross-Registry Indicator */}
              {poolMembers[1] && new Set(poolMembers[1]).size > 1 && (
                <div style={{ 
                  marginBottom: '0.75rem', 
                  padding: '0.5rem', 
                  background: '#fef3c7',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  color: '#92400e'
                }}>
                  🌐 <strong>Cross-Registry Pool:</strong> This pool contains services from {new Set(poolMembers[1]).size} different registries!
                </div>
              )}

              <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: '#666', fontWeight: '500' }}>
                Revenue Split (net)
              </div>
              <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '4px' }}>
                {poolData[4] && (
                  <>
                    <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                      Total net revenue (after {Number(poolData[5] || 0) / 100}% operator fee):{' '}
                      <strong style={{ color: '#333' }}>
                        {String((Number(poolData[4]) / 1e18) * (1 - (Number(poolData[5]) || 0) / 10000))} ETH
                      </strong>
                    </div>
                    {poolMembers[0].map((serviceId, index) => {
                      const shares = poolMembers[2]?.[index] || 0n;
                      const totalShares = poolData[3];
                      const percentage = totalShares > 0n ? Number((shares * 10000n) / totalShares) / 100 : 0;
                      const netRevenue = (Number(poolData[4]) / 1e18) * (1 - (Number(poolData[5]) || 0) / 10000);
                      const amount = netRevenue * percentage / 100;
                      const registry = poolMembers[1]?.[index] || 'N/A';
                      const isFirstMember = index === 0;
                      const serviceIdStr = String(serviceId);
                      const serviceName = serviceNames[serviceIdStr] || `Service #${serviceIdStr}`;
                      
                      return (
                        <div key={index} style={{ marginBottom: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                            <span>
                              <strong>{serviceName}</strong>
                              {isFirstMember && (
                                <span style={{ 
                                  marginLeft: '0.5rem', 
                                  fontSize: '0.75rem', 
                                  background: '#fef3c7',
                                  padding: '0.1rem 0.3rem',
                                  borderRadius: '3px',
                                  color: '#92400e'
                                }}>
                                  (gets remainder)
                                </span>
                              )}
                              <span style={{ color: '#666', marginLeft: '0.5rem' }}>
                                ({String(shares)} shares)
                              </span>
                            </span>
                            <span>
                              <strong>{percentage.toFixed(1)}%</strong>
                              <span style={{ color: '#666', marginLeft: '0.5rem' }}>
                                ({amount.toFixed(6)} ETH)
                              </span>
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '24px', background: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${percentage}%`,
                                height: '100%',
                                background: `hsl(${220 + index * 40}, 70%, 60%)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                              }}
                            >
                              {percentage > 5 ? `${percentage.toFixed(1)}%` : ''}
                            </div>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
                            Registry: {String(registry).slice(0, 10)}...{String(registry).slice(-8)}
                            {poolMembers[1] && index > 0 && poolMembers[1][index] === poolMembers[1][0] && (
                              <span style={{ marginLeft: '0.5rem', color: '#667eea', fontWeight: 'bold' }}>
                                (same registry as first)
                              </span>
                            )}
                            {poolMembers[1] && index > 0 && poolMembers[1][index] !== poolMembers[1][0] && (
                              <span style={{ marginLeft: '0.5rem', color: '#10b981', fontWeight: 'bold' }}>
                                (different registry - cross-registry!)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ 
                      marginTop: '0.75rem', 
                      paddingTop: '0.75rem', 
                      borderTop: '1px solid #ddd',
                      fontSize: '0.8rem',
                      color: '#666',
                      fontStyle: 'italic'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <span style={{ marginTop: '0.2rem', flexShrink: 0 }}>
                          <LightBulbIcon className="w-4 h-4" />
                        </span>
                        <span><strong>Remainder handling:</strong> Any rounding remainder from the split calculation goes to the first provider (deterministic tie-breaker). This ensures 100% of net revenue is distributed.</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* User Access & Earnings */}
      {userAddress && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {poolId ? (
                <>
                  <UnlockIcon className="w-5 h-5" />
                  User Access
                </>
              ) : (
                <>
                  <MoneyIcon className="w-5 h-5" />
                  Earnings
                </>
              )}
            </span>
          </h3>
          <ul className="item-list">
            {poolId && accessExpiry !== undefined && accessExpiry !== null && (
              <li>
                <strong>Access Status:</strong>
                <span style={{ marginLeft: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  {accessStatus.active ? (
                    <>
                      <CheckIcon className="w-4 h-4" />
                      Active
                    </>
                  ) : (
                    <>
                      <XIcon className="w-4 h-4" />
                      {accessStatus.status}
                    </>
                  )}
                </span>
                {accessStatus.timeLeft && (
                  <div style={{ marginTop: '0.25rem', fontSize: '0.9rem', color: '#666' }}>
                    Expires in: {accessStatus.timeLeft}
                  </div>
                )}
                {accessStatus.status === 'Permanent' && (
                  <div style={{ marginTop: '0.25rem', fontSize: '0.9rem', color: '#666' }}>
                    Permanent access
                  </div>
                )}
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#999', fontStyle: 'italic' }}>
                  Usage is enforced by the service module, not the Pool.
                </div>
              </li>
            )}
            <li>
              <strong>Total Earnings:</strong>
              <span style={{ marginLeft: '0.5rem' }}>
                {earnings ? `${String(Number(earnings) / 1e18)} ETH` : '0 ETH'}
              </span>
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#666', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span style={{ marginTop: '0.1rem', flexShrink: 0 }}>
                  <LightBulbIcon className="w-4 h-4" />
                </span>
                <span>Earnings accumulate across all pools. Use <code style={{ fontSize: '0.75rem', background: '#f0f0f0', padding: '0.1rem 0.3rem' }}>withdraw()</code> to claim.</span>
              </div>
            </li>
          </ul>
        </div>
      )}

      {!poolId && !userAddress && (
        <div className="status status-info" style={{ marginTop: '1rem' }}>
          Enter a Pool ID and/or User Address to inspect
        </div>
      )}
    </div>
  );
}
