'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { useWriteContract } from 'wagmi';
import { parseEther } from 'viem';
import PoolRegistryABI from '@/abis/PoolRegistryABI.json';
import { CONTRACT_ADDRESSES } from '@/config';

// Pre-configured Private Gallery Access Demo
const DEMO_POOL = {
  poolId: '42',
  name: 'Private Gallery Access (Demo)',
  price: '1',
  duration: '604800', // 7 days
  operatorFeeBps: '200', // 2%
  members: [
    { serviceId: '101', registry: '0x1234567890123456789012345678901234567890', shares: '3', name: 'Rare Art Collection' },
    { serviceId: '201', registry: '0x0987654321098765432109876543210987654321', shares: '2', name: 'Luxury Hotel Space' },
    { serviceId: '202', registry: '0x0987654321098765432109876543210987654321', shares: '1', name: 'Premium Security Service' },
  ],
};

type DemoStep = 'intro' | 'create' | 'purchase' | 'result';

export function DemoFlow() {
  const { address } = useAccount();
  const [currentStep, setCurrentStep] = useState<DemoStep>('intro');
  const [poolCreated, setPoolCreated] = useState(false);
  const [purchaseHash, setPurchaseHash] = useState<string | null>(null);

  const { writeContract: writeCreate, data: createHash, isPending: isCreating } = useWriteContract();
  const { writeContract: writePurchase, data: purchaseHashData, isPending: isPurchasing } = useWriteContract();
  
  const { isLoading: isCreateConfirming, isSuccess: isCreateConfirmed } = 
    useWaitForTransactionReceipt({ hash: createHash });
  const { isLoading: isPurchaseConfirming, isSuccess: isPurchaseConfirmed } = 
    useWaitForTransactionReceipt({ hash: purchaseHashData || (purchaseHash ? purchaseHash as `0x${string}` : undefined) });

  // Check if pool already exists
  const { data: poolData } = useReadContract({
    address: CONTRACT_ADDRESSES.PoolRegistry,
    abi: PoolRegistryABI,
    functionName: 'getPool',
    args: [BigInt(DEMO_POOL.poolId)],
    query: { enabled: true },
  }) as { data: [bigint, string, bigint, bigint, bigint, number, boolean, bigint, bigint] | undefined };

  useEffect(() => {
    if (poolData && poolData[0] === BigInt(DEMO_POOL.poolId)) {
      setPoolCreated(true);
      if (currentStep === 'intro') {
        setCurrentStep('purchase');
      }
    }
  }, [poolData, currentStep]);

  useEffect(() => {
    if (isCreateConfirmed) {
      setPoolCreated(true);
      setCurrentStep('purchase');
    }
  }, [isCreateConfirmed]);

  useEffect(() => {
    if (isPurchaseConfirmed && purchaseHashData) {
      setPurchaseHash(purchaseHashData);
      setCurrentStep('result');
    }
  }, [isPurchaseConfirmed, purchaseHashData]);

  const handleCreatePool = () => {
    const serviceIds = DEMO_POOL.members.map(m => BigInt(m.serviceId));
    const registries = DEMO_POOL.members.map(m => m.registry as `0x${string}`);
    const shares = DEMO_POOL.members.map(m => BigInt(m.shares));

    writeCreate({
      address: CONTRACT_ADDRESSES.PoolRegistry,
      abi: PoolRegistryABI,
      functionName: 'createPool',
      args: [
        BigInt(DEMO_POOL.poolId),
        serviceIds,
        registries,
        shares,
        parseEther(DEMO_POOL.price),
        BigInt(DEMO_POOL.duration),
        parseInt(DEMO_POOL.operatorFeeBps),
      ],
    });
  };

  const handlePurchase = () => {
    writePurchase({
      address: CONTRACT_ADDRESSES.PoolRegistry,
      abi: PoolRegistryABI,
      functionName: 'purchasePool',
      args: [
        BigInt(DEMO_POOL.poolId),
        '0x0000000000000000000000000000000000000000' as `0x${string}`,
      ],
      value: parseEther(DEMO_POOL.price),
    });
  };

  // Calculate settlement breakdown
  const calculateSettlement = () => {
    const price = parseFloat(DEMO_POOL.price);
    const operatorFeeBps = parseInt(DEMO_POOL.operatorFeeBps);
    const operatorFee = price * (operatorFeeBps / 10000);
    const netRevenue = price - operatorFee;
    
    const totalShares = DEMO_POOL.members.reduce((sum, m) => sum + parseInt(m.shares), 0);
    const contentShares = parseInt(DEMO_POOL.members[0].shares); // Rare Art Collection: 3 shares
    const venueShares = parseInt(DEMO_POOL.members[1].shares); // Luxury Hotel Space: 2 shares
    const securityShares = parseInt(DEMO_POOL.members[2].shares); // Premium Security Service: 1 share
    
    const contentRevenue = (netRevenue * contentShares) / totalShares;
    const venueRevenue = (netRevenue * venueShares) / totalShares;
    const securityRevenue = (netRevenue * securityShares) / totalShares;

    return {
      price,
      operatorFee,
      netRevenue,
      contentRevenue,
      venueRevenue,
      securityRevenue,
    };
  };

  const settlement = calculateSettlement();

  if (currentStep === 'intro') {
    return (
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.75rem', fontWeight: '600' }}>
          Demo: Private Gallery Access
        </h2>
        <p style={{ margin: '0 0 2rem 0', color: '#666', fontSize: '1rem' }}>
          Experience the complete flow in 3 simple steps
        </p>

        <div style={{
          background: '#f8f9fa',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '2rem',
          textAlign: 'left'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '1rem', fontSize: '1.1rem' }}>
            This demo will create a Pool with:
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li style={{ padding: '0.5rem 0', display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '0.75rem', color: '#10b981', fontWeight: 'bold' }}>•</span>
              <span><strong>1 content provider</strong> (Precious content)</span>
            </li>
            <li style={{ padding: '0.5rem 0', display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '0.75rem', color: '#10b981', fontWeight: 'bold' }}>•</span>
              <span><strong>2 infrastructure providers</strong> (Luxury Hotel Space + Premium Security)</span>
            </li>
            <li style={{ padding: '0.5rem 0', display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '0.75rem', color: '#10b981', fontWeight: 'bold' }}>•</span>
              <span><strong>Revenue split:</strong> 3 : 2 : 1 (Content 50%, Venue 33.3%, Security 16.7%)</span>
            </li>
            <li style={{ padding: '0.5rem 0', display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '0.75rem', color: '#10b981', fontWeight: 'bold' }}>•</span>
              <span><strong>Price:</strong> 1 ETH for 7 days access</span>
            </li>
          </ul>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ 
            padding: '1rem', 
            background: '#e8f4f8', 
            borderRadius: '6px',
            borderLeft: '4px solid #2196F3'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Step 1: Create Gallery Pool</div>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>
              Deploy the composable product on-chain
            </div>
          </div>
          <div style={{ 
            padding: '1rem', 
            background: '#f0f9ff', 
            borderRadius: '6px',
            borderLeft: '4px solid #3b82f6'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Step 2: Purchase Gallery Access</div>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>
              Make one payment, get access to all services
            </div>
          </div>
          <div style={{ 
            padding: '1rem', 
            background: '#f0fdf4', 
            borderRadius: '6px',
            borderLeft: '4px solid #10b981'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Step 3: See Revenue Split</div>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>
              View how revenue is distributed automatically
            </div>
          </div>
        </div>

        <button
          onClick={handleCreatePool}
          className="button"
          disabled={isCreating || isCreateConfirming || poolCreated}
          style={{
            fontSize: '1.1rem',
            padding: '1rem 2rem',
            background: poolCreated ? '#10b981' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            fontWeight: '600',
            border: 'none',
            boxShadow: '0 4px 6px rgba(102, 126, 234, 0.3)'
          }}
        >
          {poolCreated ? 'Pool Created - Proceed to Purchase' : 
           isCreating ? 'Creating Pool...' : 
           isCreateConfirming ? 'Confirming...' : 
           'Start Demo'}
        </button>
      </div>
    );
  }

  if (currentStep === 'purchase') {
    return (
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.75rem', fontWeight: '600' }}>
          Step 2: Purchase Gallery Access
        </h2>
        <p style={{ margin: '0 0 2rem 0', color: '#666', fontSize: '1rem' }}>
          Purchase access with one transaction
        </p>

        <div style={{
          background: '#f8f9fa',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            {DEMO_POOL.price} ETH
          </div>
          <div style={{ color: '#666', fontSize: '0.9rem' }}>
            7 days access to all services in the pool
          </div>
        </div>

        <button
          onClick={handlePurchase}
          className="button"
          disabled={isPurchasing || isPurchaseConfirming}
          style={{
            fontSize: '1.1rem',
            padding: '1rem 2rem',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            fontWeight: '600',
            border: 'none',
            boxShadow: '0 4px 6px rgba(16, 185, 129, 0.3)'
          }}
        >
          {isPurchasing ? 'Processing Purchase...' : 
           isPurchaseConfirming ? 'Confirming...' : 
           'Purchase Gallery Access'}
        </button>
      </div>
    );
  }

  if (currentStep === 'result') {
    return (
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.75rem', fontWeight: '600' }}>
            Settlement Result
          </h2>
          <p style={{ margin: 0, color: '#666', fontSize: '0.95rem' }}>
            Revenue split executed atomically
          </p>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
          borderRadius: '8px',
          padding: '2rem',
          border: '2px solid #10b981'
        }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #ddd' }}>
              <span style={{ fontWeight: '600' }}>You paid:</span>
              <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>{settlement.price.toFixed(2)} ETH</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #ddd' }}>
              <span style={{ color: '#666' }}>Operator fee ({Number(parseInt(DEMO_POOL.operatorFeeBps) / 100)}%):</span>
              <span>{settlement.operatorFee.toFixed(4)} ETH</span>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '2px solid #10b981' }}>
            <div style={{ fontWeight: '600', marginBottom: '1rem', fontSize: '1.1rem' }}>
              Revenue Split (Net):
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span><strong>Content Provider</strong>:</span>
                <span style={{ fontWeight: '600' }}>{settlement.contentRevenue.toFixed(4)} ETH</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#666', marginLeft: '1rem' }}>
                Share ratio: 3 (50%)
              </div>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span><strong>Venue Provider</strong>:</span>
                <span style={{ fontWeight: '600' }}>{settlement.venueRevenue.toFixed(4)} ETH</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#666', marginLeft: '1rem' }}>
                Share ratio: 2 (33.3%)
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span><strong>Security Provider</strong>:</span>
                <span style={{ fontWeight: '600' }}>{settlement.securityRevenue.toFixed(4)} ETH</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#666', marginLeft: '1rem' }}>
                Share ratio: 1 (16.7%)
              </div>
            </div>
          </div>

          <div style={{
            marginTop: '1.5rem',
            padding: '0.75rem',
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: '4px',
            fontSize: '0.85rem',
            color: '#065f46',
            fontStyle: 'italic'
          }}>
            <strong>Deterministic split</strong> · Ledger credits · No inline transfers
          </div>
        </div>

        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button
            onClick={() => {
              setCurrentStep('intro');
              setPurchaseHash(null);
            }}
            className="button button-secondary"
            style={{ padding: '0.75rem 1.5rem' }}
          >
            Run Demo Again
          </button>
        </div>
      </div>
    );
  }

  return null;
}

