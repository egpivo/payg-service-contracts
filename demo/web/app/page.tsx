'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAccount, useReadContract, useWaitForTransactionReceipt, useChainId, useSwitchChain } from 'wagmi';
import { useWriteContract } from 'wagmi';
import { parseEther, decodeEventLog, Abi } from 'viem';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PrimaryButton } from '@/components/PrimaryButton';
import { InfoCard } from '@/components/InfoCard';
import { FlowStep } from '@/components/FlowStep';
import { StepPreviewCard } from '@/components/StepPreviewCard';
import { WalletButton } from '@/components/WalletButton';
import { ActivityPanel, ActivityItem, ActivityStatus } from '@/components/ActivityPanel';
import { EventLogPanel, EventLog } from '@/components/EventLogPanel';
import { ProtocolStatePanel } from '@/components/ProtocolStatePanel';
import { BeforeAfterPanel } from '@/components/BeforeAfterPanel';
import { TabNavigation } from '@/components/TabNavigation';
import { DeveloperToggle } from '@/components/DeveloperToggle';
import { TransactionLog, TransactionLogEntry, LogLevel } from '@/components/TransactionLog';
import { SystemStatus } from '@/components/SystemStatus';
import { DemoBadge } from '@/components/DemoBadge';
import PoolRegistryABI from '@/abis/PoolRegistryABI.json';
import { CONTRACT_ADDRESSES } from '@/config';

// Service name mapping
const SERVICE_NAMES: Record<string, string> = {
  '101': 'Rare Art Collection',
  '102': 'Historical Documents',
  '201': 'Luxury Hotel Space',
  '202': 'Premium Security Service',
  '203': 'Presentation Services',
};

interface PoolMember {
  serviceId: string;
  registry: string;
  shares: string;
  name: string;
}

// Default pool configuration
const DEFAULT_POOL = {
  poolId: '42',
  price: '1',
  duration: '604800', // 7 days
  operatorFeeBps: '200', // 2%
  members: [
    { serviceId: '101', registry: CONTRACT_ADDRESSES.PoolRegistry, shares: '3', name: 'Rare Art Collection' },
    { serviceId: '201', registry: CONTRACT_ADDRESSES.PoolRegistry, shares: '2', name: 'Luxury Hotel Space' },
    { serviceId: '202', registry: CONTRACT_ADDRESSES.PoolRegistry, shares: '1', name: 'Premium Security Service' },
  ],
};

type DemoState = 'intro' | 'creating' | 'created' | 'purchasing' | 'purchased' | 'result';

export default function App() {
  const router = useRouter();
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [mounted, setMounted] = useState(false);
  const [demoState, setDemoState] = useState<DemoState>('intro');
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [eventLogs, setEventLogs] = useState<EventLog[]>([]);
  const [txLogs, setTxLogs] = useState<TransactionLogEntry[]>([]);
  const loggedConfirmingTx = useRef<Set<string>>(new Set());
  const loggedEventTx = useRef<Set<string>>(new Set());
  const manualCheckTimeout = useRef<NodeJS.Timeout | null>(null);

  // Load selected configuration from sessionStorage
  const [DEMO_POOL, setDEMO_POOL] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedConfig = sessionStorage.getItem('selectedConfig');
      if (savedConfig) {
        try {
          const config = JSON.parse(savedConfig);
          if (config.type === 'package' || config.type === 'custom') {
            const serviceIds = config.services || [];
            // Map service IDs to members with appropriate shares
            // For simplicity, we'll use equal shares or a simple mapping
            const shareMap: Record<string, number> = {
              '101': 3, '102': 3, // content services
              '201': 2, '203': 2, // venue services
              '202': 1, // security services
            };
            
            const members = serviceIds.map((serviceId: string) => ({
              serviceId,
              registry: CONTRACT_ADDRESSES.PoolRegistry,
              shares: String(shareMap[serviceId] || 1),
              name: SERVICE_NAMES[serviceId] || `Service #${serviceId}`,
            }));

            const totalShares = members.reduce((sum: number, m: PoolMember) => sum + parseInt(m.shares), 0);
            const basePrice = totalShares * 0.16; // Rough price calculation
            
            return {
              poolId: '42',
              price: basePrice.toFixed(2),
              duration: '604800', // 7 days
              operatorFeeBps: '200', // 2%
              members,
            };
          }
        } catch (e) {
          console.error('Failed to parse saved config:', e);
        }
      }
    }
    return DEFAULT_POOL;
  });

  // Helper to add log entry
  const addLog = useCallback((level: LogLevel, msg: string, data?: {
    txHash?: string;
    status?: 'pending' | 'confirmed' | 'reverted';
    gasUsed?: bigint;
    blockNumber?: bigint;
    poolState?: { exists: boolean; members: number; totalShares: bigint };
  }) => {
    setTxLogs(prev => [...prev, {
      time: new Date(),
      level,
      msg,
      ...data,
    }]);
  }, []);

  const { writeContract: writeCreate, data: createHash, isPending: isCreating, reset: resetCreate } = useWriteContract();
  const { writeContract: writePurchase, data: purchaseHash, isPending: isPurchasing, reset: resetPurchase } = useWriteContract();
  
  const { data: createReceipt, isLoading: isCreateConfirming, isSuccess: isCreateConfirmed, isError: isCreateError } = 
    useWaitForTransactionReceipt({ 
      hash: createHash,
      query: {
        enabled: !!createHash,
        retry: 3,
        retryDelay: 1000,
      },
    });
  const { data: purchaseReceipt, isLoading: isPurchaseConfirming, isSuccess: isPurchaseConfirmed, isError: isPurchaseError } = 
    useWaitForTransactionReceipt({ 
      hash: purchaseHash,
      query: {
        enabled: !!purchaseHash,
        retry: 3,
        retryDelay: 1000,
      },
    });

  // Check if pool already exists (only refetch after tx confirmed or on mount)
  const shouldRefetchPool = mounted && isConnected && (isCreateConfirmed || isPurchaseConfirmed || demoState === 'intro');
  const poolQuery = useReadContract({
    address: CONTRACT_ADDRESSES.PoolRegistry,
    abi: PoolRegistryABI,
    functionName: 'getPool',
    args: [BigInt(DEMO_POOL.poolId)],
    query: { 
      enabled: shouldRefetchPool,
      refetchInterval: (query) => {
        // Only refetch if we're waiting for confirmation, max every 2 seconds
        if (isCreateConfirming || isPurchaseConfirming) {
          return 2000;
        }
        return false;
      },
    },
  });
  const poolData = poolQuery.data as [bigint, string, bigint, bigint, bigint, number, boolean, bigint, bigint] | undefined;
  const refetchPool = poolQuery.refetch;

  // Query earnings and access for settlement display
  const { data: userEarnings } = useReadContract({
    address: CONTRACT_ADDRESSES.PoolRegistry,
    abi: PoolRegistryABI,
    functionName: 'earnings',
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address && mounted && isConnected },
  });

  const { data: hasAccess } = useReadContract({
    address: CONTRACT_ADDRESSES.PoolRegistry,
    abi: PoolRegistryABI,
    functionName: 'hasPoolAccess',
    args: address && (demoState === 'result' || demoState === 'purchasing') ? [address as `0x${string}`, BigInt(DEMO_POOL.poolId)] : undefined,
    query: { enabled: !!address && (demoState === 'result' || demoState === 'purchasing') && mounted && isConnected },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && isConnected) {
      addLog('info', 'Wallet connected');
    }
  }, [mounted, isConnected, addLog]);

  useEffect(() => {
    if (poolData && poolData[0] === BigInt(DEMO_POOL.poolId)) {
      if (demoState === 'intro') {
        setDemoState('created');
        addLog('info', 'Pool already exists, skipping creation', {
          poolState: {
            exists: true,
            members: Number(poolData[2]),
            totalShares: poolData[3],
          },
        });
      } else if (demoState === 'creating' && isCreateConfirmed) {
        // Log pool state after creation
        addLog('success', 'Pool created successfully', {
          poolState: {
            exists: true,
            members: Number(poolData[2]),
            totalShares: poolData[3],
          },
        });
      }
    }
  }, [poolData, demoState, isCreateConfirmed, addLog]);

  // Activity tracking
  const addActivity = useCallback((activity: Omit<ActivityItem, 'id' | 'timestamp'>) => {
    setActivities(prev => [...prev, {
      ...activity,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
    }]);
  }, []);

  const updateActivity = useCallback((id: string, updates: Partial<ActivityItem>) => {
    setActivities(prev => prev.map(act => act.id === id ? { ...act, ...updates } : act));
  }, []);

  // Track create transaction with better error handling
  useEffect(() => {
    if (createHash && !loggedConfirmingTx.current.has(createHash)) {
      loggedConfirmingTx.current.add(createHash);
      addActivity({
        action: 'Create Pool',
        status: 'submitting',
        txHash: createHash,
      });
      addLog('tx', 'createPool transaction sent', {
        txHash: createHash,
        status: 'pending',
      });

      // Start manual check immediately (don't wait for isCreateConfirming)
      // This is critical because Wagmi might be on wrong network
      const checkReceipt = async () => {
        try {
          const response = await fetch('http://localhost:8545', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getTransactionReceipt',
              params: [createHash],
              id: 1,
            }),
          });
          const data = await response.json();
          if (data.result && data.result.blockNumber) {
            addLog('success', 'Transaction confirmed (manual check)', {
              txHash: createHash,
              status: 'confirmed',
              gasUsed: BigInt(data.result.gasUsed || '0'),
              blockNumber: BigInt(data.result.blockNumber || '0'),
            });
            // Update state - this will trigger other useEffects
            setDemoState('created');
            return true; // Found receipt
          }
          // Also check if transaction exists in mempool
          const txResponse = await fetch('http://localhost:8545', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getTransactionByHash',
              params: [createHash],
              id: 2,
            }),
          });
          const txData = await txResponse.json();
          if (!txData.result) {
            // Transaction not found at all - might be on wrong network
            addLog('error', `Transaction ${createHash.slice(0, 10)}... not found on Anvil. It may have been sent to wrong network (Chain 1).`);
            addLog('error', 'Please refresh the page and ensure MetaMask is on Localhost 8545 (Chain 31337).');
            setDemoState('intro');
            return true; // Stop checking
          }
          return false; // Not confirmed yet, but exists
        } catch (e) {
          console.error('Error checking transaction:', e);
          return false; // Error checking
        }
      };

      // Check immediately and then every 2 seconds
      let checkCount = 0;
      const maxChecks = 30; // 30 checks = 60 seconds
      
      const startChecking = async () => {
        const found = await checkReceipt();
        if (!found && checkCount < maxChecks) {
          checkCount++;
          setTimeout(startChecking, 2000);
        } else if (checkCount >= maxChecks && !found) {
          addLog('warning', 'Transaction still pending after 60 seconds. Please check network and try again.');
          addLog('info', 'If transaction was sent to wrong network, it will never confirm. Please refresh and try again.');
        }
      };
      
      // Start checking after a short delay to allow transaction to be mined
      setTimeout(() => startChecking(), 1000);
    }
  }, [createHash, addActivity, addLog, refetchPool, activities, updateActivity]);

  // Refetch pool after create confirmed
  useEffect(() => {
    if (isCreateConfirmed && createReceipt && refetchPool) {
      addLog('success', 'createPool transaction confirmed', {
        txHash: createReceipt.transactionHash,
        status: 'confirmed',
        gasUsed: createReceipt.gasUsed,
        blockNumber: createReceipt.blockNumber,
      });
      
      // Refetch pool state after confirmation
      setTimeout(async () => {
        const result = await refetchPool();
        if (result.data) {
          const pool = result.data as [bigint, string, bigint, bigint, bigint, number, boolean, bigint, bigint];
          addLog('success', 'Pool state refetched', {
            poolState: {
              exists: true,
              members: Number(pool[2]),
              totalShares: pool[3],
            },
          });
        }
      }, 500);
    }
  }, [isCreateConfirmed, createReceipt, refetchPool, addLog]);

  useEffect(() => {
    if (createHash && isCreateConfirming && !loggedConfirmingTx.current.has(createHash)) {
      loggedConfirmingTx.current.add(createHash);
      const activity = activities.find(a => a.txHash === createHash);
      if (activity) {
        updateActivity(activity.id, { status: 'pending' });
      }
      addLog('info', 'Waiting for transaction confirmations', {
        txHash: createHash,
        status: 'pending',
      });

      // Manual check as fallback (in case Wagmi is on wrong network)
      // Use direct RPC call to localhost to bypass Wagmi network issues
      const checkReceipt = async () => {
        try {
          const response = await fetch('http://localhost:8545', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getTransactionReceipt',
              params: [createHash],
              id: 1,
            }),
          });
          const data = await response.json();
          if (data.result && data.result.blockNumber) {
            addLog('success', 'Transaction confirmed (manual check)', {
              txHash: createHash,
              status: 'confirmed',
              gasUsed: BigInt(data.result.gasUsed || '0'),
              blockNumber: BigInt(data.result.blockNumber || '0'),
            });
            // Force update state
            setTimeout(() => window.location.reload(), 1000);
          }
        } catch (e) {
          // Transaction not found yet, will retry
        }
      };

      // Check immediately and then every 2 seconds
      checkReceipt();
      const interval = setInterval(checkReceipt, 2000);
      
      // Clear after 30 seconds if still pending
      manualCheckTimeout.current = setTimeout(() => {
        clearInterval(interval);
        addLog('warning', 'Transaction still pending after 30 seconds. Please check network and try again.');
      }, 30000);

      return () => {
        clearInterval(interval);
        if (manualCheckTimeout.current) {
          clearTimeout(manualCheckTimeout.current);
        }
      };
    }
  }, [createHash, isCreateConfirming, activities, updateActivity, addLog]);

  useEffect(() => {
    if (createReceipt && !loggedEventTx.current.has(createReceipt.transactionHash)) {
      loggedEventTx.current.add(createReceipt.transactionHash);
      
      const activity = activities.find(a => a.txHash === createReceipt.transactionHash);
      if (activity) {
        updateActivity(activity.id, {
          status: 'confirmed',
          blockNumber: createReceipt.blockNumber,
          gasUsed: createReceipt.gasUsed,
        });
      }
      // Parse events from receipt
      const events: { name: string; args: Record<string, any> }[] = [];
      if (createReceipt.logs) {
        for (const log of createReceipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: PoolRegistryABI as Abi,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName) {
              events.push({ name: decoded.eventName, args: decoded.args as Record<string, any> });
            }
          } catch (e) {
            // Skip logs that don't match our ABI
          }
        }
      }
      setEventLogs(prev => [...prev, {
        action: 'CreatePool',
        txHash: createReceipt.transactionHash,
        blockNumber: createReceipt.blockNumber,
        events,
      }]);
    }
  }, [createReceipt, activities, updateActivity]);

  useEffect(() => {
    if (createHash && isCreateError) {
      const activity = activities.find(a => a.txHash === createHash);
      if (activity) {
        updateActivity(activity.id, { status: 'failed', error: 'Transaction failed' });
      }
      addLog('error', 'createPool transaction failed', {
        txHash: createHash,
        status: 'reverted',
      });
      // Reset demo state on error
      setDemoState('intro');
    }
  }, [createHash, isCreateError, activities, updateActivity, addLog]);

  // Track purchase transaction
  useEffect(() => {
    if (purchaseHash && !loggedConfirmingTx.current.has(purchaseHash)) {
      loggedConfirmingTx.current.add(purchaseHash);
      addActivity({
        action: 'Purchase Pool',
        status: 'submitting',
        txHash: purchaseHash,
      });
      addLog('tx', 'purchasePool transaction sent', {
        txHash: purchaseHash,
        status: 'pending',
      });

      // Start manual check for purchase transaction too
      const checkReceipt = async () => {
        try {
          const response = await fetch('http://localhost:8545', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getTransactionReceipt',
              params: [purchaseHash],
              id: 1,
            }),
          });
          const data = await response.json();
          if (data.result && data.result.blockNumber) {
            addLog('success', 'Purchase transaction confirmed (manual check)', {
              txHash: purchaseHash,
              status: 'confirmed',
              gasUsed: BigInt(data.result.gasUsed || '0'),
              blockNumber: BigInt(data.result.blockNumber || '0'),
            });
            // Update activity status
            const activity = activities.find(a => a.txHash === purchaseHash);
            if (activity) {
              updateActivity(activity.id, {
                status: 'confirmed',
                blockNumber: BigInt(data.result.blockNumber || '0'),
                gasUsed: BigInt(data.result.gasUsed || '0'),
              });
            }
            // Update state to result - this will trigger the useEffect that sets demoState to 'result'
            setDemoState('result');
            return true; // Found receipt
          }
          return false; // Not found yet
        } catch (e) {
          console.error('Error checking purchase transaction:', e);
          return false;
        }
      };

      // Check immediately and then every 2 seconds
      let checkCount = 0;
      const maxChecks = 30;
      
      const startChecking = async () => {
        const found = await checkReceipt();
        if (!found && checkCount < maxChecks) {
          checkCount++;
          setTimeout(startChecking, 2000);
        } else if (checkCount >= maxChecks && !found) {
          addLog('warning', 'Purchase transaction still pending after 60 seconds.');
        }
      };
      
      setTimeout(() => startChecking(), 1000);
    }
  }, [purchaseHash, addActivity, addLog, activities, updateActivity, setDemoState]);

  useEffect(() => {
    if (purchaseHash && isPurchaseConfirming && !loggedConfirmingTx.current.has(purchaseHash)) {
      loggedConfirmingTx.current.add(purchaseHash);
      const activity = activities.find(a => a.txHash === purchaseHash);
      if (activity) {
        updateActivity(activity.id, { status: 'pending' });
      }
      addLog('info', 'Waiting for transaction confirmations', {
        txHash: purchaseHash,
        status: 'pending',
      });
    }
  }, [purchaseHash, isPurchaseConfirming, activities, updateActivity, addLog]);

  useEffect(() => {
    if (purchaseReceipt && !loggedEventTx.current.has(purchaseReceipt.transactionHash)) {
      loggedEventTx.current.add(purchaseReceipt.transactionHash);
      
      const activity = activities.find(a => a.txHash === purchaseReceipt.transactionHash);
      if (activity) {
        updateActivity(activity.id, {
          status: 'confirmed',
          blockNumber: purchaseReceipt.blockNumber,
          gasUsed: purchaseReceipt.gasUsed,
        });
      }
      addLog('success', 'purchasePool transaction confirmed', {
        txHash: purchaseReceipt.transactionHash,
        status: 'confirmed',
        gasUsed: purchaseReceipt.gasUsed,
        blockNumber: purchaseReceipt.blockNumber,
      });
      // Parse events from receipt
      const events: { name: string; args: Record<string, any> }[] = [];
      if (purchaseReceipt.logs) {
        for (const log of purchaseReceipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: PoolRegistryABI as Abi,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName) {
              events.push({ name: decoded.eventName, args: decoded.args as Record<string, any> });
            }
          } catch (e) {
            // Skip logs that don't match our ABI
          }
        }
      }
      setEventLogs(prev => [...prev, {
        action: 'PurchasePool',
        txHash: purchaseReceipt.transactionHash,
        blockNumber: purchaseReceipt.blockNumber,
        events,
      }]);
    }
  }, [purchaseReceipt, activities, updateActivity, addLog]);

  useEffect(() => {
    if (purchaseHash && isPurchaseError) {
      const activity = activities.find(a => a.txHash === purchaseHash);
      if (activity) {
        updateActivity(activity.id, { status: 'failed', error: 'Transaction failed' });
      }
      addLog('error', 'purchasePool transaction failed', {
        txHash: purchaseHash,
        status: 'reverted',
      });
    }
  }, [purchaseHash, isPurchaseError, activities, updateActivity, addLog]);

  const [shouldAutoPurchase, setShouldAutoPurchase] = useState(false);

  // Navigation handlers that can cancel pending transactions
  const handleBackFromCreate = useCallback(() => {
    if (isCreating || isCreateConfirming) {
      // Reset the transaction state
      resetCreate();
      addLog('info', 'Transaction cancelled. Please reject the transaction in MetaMask if the popup is still open.');
    }
    setDemoState('intro');
  }, [isCreating, isCreateConfirming, resetCreate, addLog]);

  const handleBackFromPurchase = useCallback(() => {
    if (isPurchasing || isPurchaseConfirming) {
      // Reset the transaction state
      resetPurchase();
      addLog('info', 'Transaction cancelled. Please reject the transaction in MetaMask if the popup is still open.');
    }
    setDemoState('created');
  }, [isPurchasing, isPurchaseConfirming, resetPurchase, addLog]);

  const handlePurchase = useCallback(() => {
    setDemoState('purchasing');
    addLog('info', 'Requesting wallet signature for purchasePool');
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
  }, [writePurchase, addLog]);

  // Handle create confirmation - both from Wagmi and manual check
  // Use a ref to prevent duplicate triggers
  const autoPurchaseTriggered = useRef(false);
  useEffect(() => {
    // Only trigger auto-purchase once when state changes to 'created'
    if (demoState === 'created' && shouldAutoPurchase && !autoPurchaseTriggered.current) {
      autoPurchaseTriggered.current = true;
      setShouldAutoPurchase(false);
      // Wait a bit for pool state to be available, then trigger purchase
      setTimeout(() => {
        handlePurchase();
      }, 1500);
    }
    // Reset ref when demo state resets
    if (demoState === 'intro') {
      autoPurchaseTriggered.current = false;
    }
  }, [demoState, shouldAutoPurchase, handlePurchase]);

  // Clear event logs when demo resets to intro
  useEffect(() => {
    if (demoState === 'intro') {
      setEventLogs([]);
      loggedEventTx.current.clear();
    }
  }, [demoState]);

  useEffect(() => {
    if (isPurchaseConfirmed) {
      setDemoState('result');
    }
  }, [isPurchaseConfirmed]);

  // Auto-run demo flow: check if pool exists, create if needed, then purchase
  const handleStartDemo = useCallback(async () => {
    addLog('info', 'Starting demo flow');
    
    // Check network first - both MetaMask and Wagmi
    const ethereum = (window as any).ethereum;
    let metaMaskChainId: number | null = null;
    
    if (ethereum) {
      try {
        const chainIdHex = await ethereum.request({ method: 'eth_chainId' });
        metaMaskChainId = parseInt(chainIdHex, 16);
      } catch (e) {
        console.error('Failed to get chainId from MetaMask:', e);
      }
    }
    
    // Check if network is correct
    const expectedChainId = 31337;
    const wagmiChainId = chainId;
    
    // Only block if MetaMask is on wrong network (Wagmi can be wrong, we'll use MetaMask)
    if (metaMaskChainId !== null && metaMaskChainId !== expectedChainId) {
      addLog('error', `Wrong network! MetaMask is on Chain ${metaMaskChainId}, but expected Chain ${expectedChainId}.`);
      addLog('info', 'Attempting to switch network...');
      
      try {
        await switchChain({ chainId: expectedChainId });
        addLog('info', 'Network switch initiated. Please wait 2-3 seconds, then click "Start Demo" again.');
        return;
      } catch (switchError: any) {
        addLog('error', `Failed to switch network: ${switchError?.message || 'Unknown error'}`);
        addLog('error', 'Please manually switch to Localhost 8545 (Chain 31337) in MetaMask and try again.');
        return;
      }
    }
    
    // If MetaMask chainId is null but Wagmi is wrong, warn but proceed
    if (metaMaskChainId === null && wagmiChainId !== expectedChainId) {
      addLog('warning', `Could not detect MetaMask network. Wagmi reports Chain ${wagmiChainId}. Proceeding anyway...`);
    }
    
    // Double-check Wagmi chainId matches - warn but allow to proceed
    if (wagmiChainId !== expectedChainId && metaMaskChainId === expectedChainId) {
      addLog('warning', `Wagmi reports Chain ${wagmiChainId}, but MetaMask is on Chain ${metaMaskChainId}.`);
      addLog('info', 'Proceeding anyway - using MetaMask network. If issues occur, refresh the page.');
      // Don't return - allow execution to continue
    }
    
    // If both are wrong, try to switch
    if (wagmiChainId !== expectedChainId && metaMaskChainId !== expectedChainId) {
      addLog('error', `Both Wagmi (Chain ${wagmiChainId}) and MetaMask (Chain ${metaMaskChainId}) are on wrong network.`);
      addLog('info', 'Attempting to switch network...');
      try {
        await switchChain({ chainId: expectedChainId });
        addLog('info', 'Network switch initiated. Please wait 2-3 seconds, then manually refresh the page (F5).');
        return;
      } catch (switchError: any) {
        addLog('error', `Failed to switch network: ${switchError?.message || 'Unknown error'}`);
        addLog('error', 'Please manually switch to Localhost 8545 (Chain 31337) in MetaMask and try again.');
        return;
      }
    }
    
    // Check if pool exists
    if (poolData && poolData[0] === BigInt(DEMO_POOL.poolId)) {
      // Pool exists, go straight to purchase
      addLog('info', 'Pool already exists, proceeding to purchase');
      handlePurchase();
    } else {
      // Pool doesn't exist, create it first (will auto-purchase after creation)
      addLog('info', 'Pool does not exist, creating pool...');
      addLog('info', 'Requesting wallet signature for createPool');
      setShouldAutoPurchase(true);
      setDemoState('creating');
      const serviceIds = DEMO_POOL.members.map((m: PoolMember) => BigInt(m.serviceId));
      const registries = DEMO_POOL.members.map((m: PoolMember) => m.registry as `0x${string}`);
      const shares = DEMO_POOL.members.map((m: PoolMember) => BigInt(m.shares));

      try {
        await writeCreate({
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
      } catch (error: any) {
        addLog('error', `Failed to send transaction: ${error?.message || 'Unknown error'}`);
        setDemoState('intro');
      }
    }
  }, [poolData, writeCreate, handlePurchase, addLog, chainId, switchChain]);

  const handleReset = () => {
    setDemoState('intro');
    setActivities([]);
    setEventLogs([]);
  };

  // Calculate settlement breakdown
  const calculateSettlement = () => {
    const price = parseFloat(DEMO_POOL.price);
    const operatorFeeBps = parseInt(DEMO_POOL.operatorFeeBps);
    const operatorFee = price * (operatorFeeBps / 10000);
    const netRevenue = price - operatorFee;
    
    const totalShares = DEMO_POOL.members.reduce((sum: number, m: PoolMember) => sum + parseInt(m.shares), 0);
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
      totalShares,
    };
  };

  const settlement = calculateSettlement();
  const daysDuration = Math.floor(parseInt(DEMO_POOL.duration) / 86400);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-[#666666]">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Wallet Connection Section */}
        <section className="bg-white rounded-lg p-6 mb-8 flex items-center justify-between border border-[#e0e0e0]">
          <div className="flex items-center gap-4">
            <div>
              {isConnected ? (
                <div>
                  <span className="text-[#666666] text-[0.85rem]">Connected:</span>
                  <span className="ml-2 font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                </div>
              ) : (
                <span className="text-[#666666]">Not connected</span>
              )}
            </div>
            <Link
              href="/select"
              className="text-[#667eea] hover:text-[#5568d3] font-semibold text-sm underline"
            >
              ← Select Services
            </Link>
          </div>
          <div>
            <WalletButton />
          </div>
        </section>

        {/* Tab Navigation */}
        <TabNavigation
          demo={
            <div className="max-w-4xl mx-auto">
              {/* Hero Section - Private Gallery Access (Always visible) */}
              <section className="bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-xl p-12 mb-8 text-white text-center">
                <div className="mb-4">
                  <span className="inline-block bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-medium mb-4">
                    Demo: Art collection + hotel space + security
                  </span>
                </div>
                <h1 className="text-[2.5rem] mb-4 font-bold">Private Gallery Access</h1>
                <p className="text-[1.2rem] mb-8 opacity-90 max-w-3xl mx-auto">
                  A composable product built from multiple on-chain services
                </p>
                <div className="bg-white/15 backdrop-blur-sm rounded-lg p-6 max-w-3xl mx-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
                    <div>
                      <p className="opacity-75 text-[0.85rem]">Art Collection</p>
                      <p className="font-semibold">= Service</p>
                    </div>
                    <div>
                      <p className="opacity-75 text-[0.85rem]">Hotel Space & Security</p>
                      <p className="font-semibold">= Services</p>
                    </div>
                    <div>
                      <p className="opacity-75 text-[0.85rem]">Access Package</p>
                      <p className="font-semibold">= Pool</p>
                    </div>
                    <div>
                      <p className="opacity-75 text-[0.85rem]">Providers</p>
                      <p className="font-semibold">= Revenue Recipients</p>
                    </div>
                  </div>
                </div>
                
                {/* Demo Badge - Below Protocol Mapping */}
                <DemoBadge 
                  poolId={DEMO_POOL.poolId}
                  price={DEMO_POOL.price}
                  duration={daysDuration}
                  operatorFeeBps={DEMO_POOL.operatorFeeBps}
                />
              </section>

              {!isConnected ? (
                <section className="bg-white rounded-xl p-8 shadow-[0_2px_8px_rgba(0,0,0,0.1)] text-center">
                  <p className="text-[#666666] text-lg">Please connect your wallet to start the demo.</p>
                </section>
              ) : (
                <>
                {/* System Status */}
                <SystemStatus />

                <section className="bg-white rounded-xl p-8 shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
            <div className="space-y-8">
            {/* Intro State */}
            {demoState === 'intro' && (
              <div>

                {/* Pool Configuration Info */}
                <InfoCard variant="info" className="mb-6">
                  <h3 className="mb-3 text-[1.5rem] font-semibold">Pool Configuration</h3>
                  <ul className="space-y-2 text-[#666666]">
                    <li className="flex items-start gap-2">
                      <span className="text-[#667eea] mt-1 font-bold">•</span>
                      <span>Access Duration: {daysDuration} days</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#667eea] mt-1 font-bold">•</span>
                      <span>Price: {DEMO_POOL.price} ETH per pass</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#667eea] mt-1 font-bold">•</span>
                      <span>Service Providers: 3 providers (content, venue, security)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#667eea] mt-1 font-bold">•</span>
                      <span>Operator Fee: {Number(parseInt(DEMO_POOL.operatorFeeBps) / 100)}%</span>
                    </li>
                  </ul>
                </InfoCard>

                {/* Step Preview Cards */}
                <div className="space-y-4 mb-8">
                  <StepPreviewCard 
                    number={1}
                    title="Create the Gallery Package"
                    description="Set up a gallery pool with content access, venue, and security services"
                    status="locked"
                  />
                  <StepPreviewCard 
                    number={2}
                    title="Purchase Gallery Access"
                    description={`Buy complete access to content and all infrastructure for ${daysDuration} days`}
                    status="locked"
                  />
                  <StepPreviewCard 
                    number={3}
                    title="View Settlement"
                    description="See how revenue is automatically distributed to content and infrastructure providers"
                    status="locked"
                  />
                </div>

                <div className="text-center">
                  <PrimaryButton 
                    onClick={handleStartDemo}
                    className="text-[1.1rem]"
                  >
                    Start Demo
                  </PrimaryButton>
                </div>
              </div>
            )}


            {/* Create Step */}
            {(demoState === 'creating' || demoState === 'created') && (
              <div>
                <h2 className="mb-2 text-[1.75rem] font-semibold">Step 1 — Create the Gallery Package</h2>
                <p className="text-[#666666] mb-6 text-base">
                  Creates Pool #{DEMO_POOL.poolId} and registers 3 members (content + venue + security)
                </p>

                {/* Results KPI */}
                <div className="mb-6">
                  <BeforeAfterPanel 
                    poolId={DEMO_POOL.poolId} 
                    showAfter={demoState === 'created' || isCreateConfirmed}
                    price={DEMO_POOL.price}
                    duration={daysDuration}
                  />
                </div>

                {/* Transaction Log */}
                <div className="mb-6">
                  <TransactionLog logs={txLogs} />
                </div>

                {/* Protocol State Panel */}
                <div className="mb-6">
                  <ProtocolStatePanel 
                    poolId={DEMO_POOL.poolId}
                    enabled={mounted && isConnected}
                  />
                </div>

                {/* Developer Toggle */}
                <DeveloperToggle title="Show protocol details">
                  <div className="space-y-3">
                    <p className="font-semibold text-[#1a1a1a]">Protocol Concept #1: Pool Creation as a State Transition</p>
                    <p className="text-[#666666]">
                      This operation moves the Pool from a non-existent state (exists = false) to a fully initialized, purchasable protocol object (exists = true). 
                      The state transition is atomic and deterministic.
                    </p>
                    <p className="text-xs text-[#999999] italic mt-2">
                      Live on-chain state queried from PoolRegistry
                    </p>
                  </div>
                </DeveloperToggle>

                <InfoCard variant="default" className="mb-6">
                  <h3 className="mb-4 text-xl font-semibold">Pool Details</h3>
                  <div className="space-y-3 text-[#666666]">
                    <div className="flex justify-between border-b border-[#e0e0e0] pb-2">
                      <span>Duration:</span>
                      <span className="text-[#1a1a1a] font-semibold">{daysDuration} days</span>
                    </div>
                    <div className="flex justify-between border-b border-[#e0e0e0] pb-2">
                      <span>Package Price:</span>
                      <span className="text-[#1a1a1a] font-semibold">{DEMO_POOL.price} ETH</span>
                    </div>
                    <div className="flex justify-between border-b border-[#e0e0e0] pb-2">
                      <span>Services:</span>
                      <span className="text-[#1a1a1a] font-semibold">3 providers</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Operator Fee:</span>
                      <span className="text-[#1a1a1a] font-semibold">{Number(parseInt(DEMO_POOL.operatorFeeBps) / 100)}%</span>
                    </div>
                  </div>
                </InfoCard>

                {/* Event Log Panel */}
                {eventLogs.length > 0 && (
                  <div className="mb-6">
                    <EventLogPanel logs={eventLogs} />
                  </div>
                )}

                {/* Activity Panel */}
                {activities.length > 0 && (
                  <div className="mb-6">
                    <ActivityPanel activities={activities} />
                  </div>
                )}

                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center gap-4 mb-2">
                    {demoState === 'created' && (
                      <button
                        onClick={handleBackFromCreate}
                        className="px-4 py-2 text-sm text-[#666666] hover:text-[#333333] border border-[#e0e0e0] rounded-lg hover:bg-[#f5f5f5] transition-colors"
                        title={isCreating || isCreateConfirming ? "This will cancel the transaction. Please reject it in MetaMask if popup is open." : ""}
                      >
                        ← Back to Start
                      </button>
                    )}
                    <PrimaryButton 
                      onClick={() => setDemoState('purchasing')}
                      loading={demoState === 'creating' || isCreating || isCreateConfirming}
                      disabled={demoState === 'creating' || isCreating || isCreateConfirming}
                      className="text-[1.1rem]"
                    >
                      {isCreating && !createHash ? 'Waiting for wallet confirmation...' : 
                       isCreating && createHash ? 'Waiting for confirmations...' :
                       isCreateConfirming ? 'Confirming transaction...' :
                       demoState === 'creating' ? 'Creating Pool...' : 
                       'Proceed to Purchase →'}
                    </PrimaryButton>
                  </div>
                  {(demoState === 'creating' || isCreating || isCreateConfirming) && (
                    <div className="text-xs text-[#999999]">
                      <p>Tip: Close MetaMask popup to access navigation buttons</p>
                      <button
                        onClick={handleReset}
                        className="text-sm text-[#666666] hover:text-[#333333] underline mt-1"
                      >
                        Cancel / Reset
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Purchase Step */}
            {demoState === 'purchasing' && (
              <div>
                {/* Check if already purchased */}
                {hasAccess === true && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-800 font-semibold">✓ You have already purchased this pool!</p>
                    <p className="text-green-700 text-sm mt-1">You have access to all services. Proceeding to settlement view...</p>
                    <div className="mt-4">
                      <PrimaryButton 
                        variant="success"
                        onClick={() => setDemoState('result')}
                        className="text-[1.1rem]"
                      >
                        View Settlement →
                      </PrimaryButton>
                    </div>
                  </div>
                )}
                {hasAccess !== true && (
                  <>
                <h2 className="mb-2 text-[1.75rem] font-semibold">Step 2: Purchase Gallery Access</h2>
                <p className="text-[#666666] mb-6 text-lg">
                  Buy complete access to content and all infrastructure for {daysDuration} days
                </p>

                {/* Transaction Log */}
                <div className="mb-6">
                  <TransactionLog logs={txLogs} />
                </div>

                <div className="text-center mb-8">
                  <div className="inline-block bg-[#f8f9fa] rounded-lg p-8">
                    <div className="text-[3rem] text-[#667eea] mb-2 font-bold">{DEMO_POOL.price} ETH</div>
                    <p className="text-[#666666]">{daysDuration}-day access to 3 services</p>
                  </div>
                </div>

                {/* Protocol State Panel */}
                <div className="mb-6">
                  <ProtocolStatePanel 
                    poolId={DEMO_POOL.poolId}
                    enabled={mounted && isConnected}
                  />
                </div>

                {/* Developer Toggle */}
                <DeveloperToggle title="Show protocol details">
                  <div className="space-y-3">
                    <p className="font-semibold text-[#1a1a1a]">Protocol Concept #2: Atomic Purchase & Deterministic Settlement</p>
                    <p className="text-[#666666]">
                      One transaction updates access rights and provider earnings atomically. 
                      All state changes happen in a single transaction, ensuring consistency.
                    </p>
                  </div>
                </DeveloperToggle>

                <InfoCard variant="info" className="mb-6">
                  <h3 className="mb-3 text-[1.5rem] font-semibold">What You Get</h3>
                  <ul className="space-y-2 text-[#666666]">
                    <li className="flex items-start gap-2">
                      <span className="text-[#667eea] mt-1 font-bold">•</span>
                      <span>Unlimited access to all 3 services</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#667eea] mt-1 font-bold">•</span>
                      <span>{daysDuration} days of access</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#667eea] mt-1 font-bold">•</span>
                      <span>Automatic revenue distribution to providers</span>
                    </li>
                  </ul>
                </InfoCard>

                {/* Event Log Panel */}
                {eventLogs.length > 0 && (
                  <div className="mb-6">
                    <EventLogPanel logs={eventLogs} />
                  </div>
                )}

                {/* Activity Panel */}
                {activities.length > 0 && (
                  <div className="mb-6">
                    <ActivityPanel activities={activities} />
                  </div>
                )}

                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={handleBackFromPurchase}
                      className="px-4 py-2 text-sm text-[#666666] hover:text-[#333333] border border-[#e0e0e0] rounded-lg hover:bg-[#f5f5f5] transition-colors"
                      title={isPurchasing || isPurchaseConfirming ? "This will cancel the transaction. Please reject it in MetaMask if popup is open." : ""}
                    >
                      ← Back to Step 1
                    </button>
                    <PrimaryButton 
                      variant="success"
                      onClick={handlePurchase}
                      loading={(isPurchasing || isPurchaseConfirming) && !isPurchaseConfirmed}
                      disabled={(isPurchasing || isPurchaseConfirming) && !isPurchaseConfirmed}
                      className="text-[1.1rem]"
                    >
                      {isPurchasing && !purchaseHash ? 'Waiting for wallet confirmation...' :
                       isPurchasing && purchaseHash ? 'Waiting for confirmations...' :
                       isPurchaseConfirming && !isPurchaseConfirmed ? 'Confirming transaction...' :
                       `Purchase Package (${DEMO_POOL.price} ETH) →`}
                    </PrimaryButton>
                  </div>
                  {(isPurchasing || isPurchaseConfirming) && (
                    <div className="text-xs text-[#999999]">
                      💡 If MetaMask popup is open, please <strong>reject</strong> the transaction there, then click &quot;Back&quot; above.
                    </div>
                  )}
                </div>
                  </>
                )}
              </div>
            )}

            {/* Result State */}
            {demoState === 'result' && (
              <div>
                <h2 className="mb-2 text-[1.75rem] font-semibold">Step 3: View Settlement</h2>
                <p className="text-[#666666] mb-6 text-lg">
                  See how revenue is automatically distributed to content and infrastructure providers
                </p>

                {/* Developer Toggle */}
                <DeveloperToggle title="Show protocol details">
                  <div className="space-y-3">
                    <p className="font-semibold text-[#1a1a1a]">Protocol Concept #3: Revenue Invariants & Share-Based Splits</p>
                    <p className="text-[#666666]">
                      Total distributed value equals net revenue, every time. 
                      Revenue is split proportionally based on shares (3:2:1 ratio), ensuring mathematical correctness.
                    </p>
                  </div>
                </DeveloperToggle>

                <InfoCard variant="success" className="mb-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-4 border-b-2 border-[#10b981]">
                      <span className="text-xl">Total Payment:</span>
                      <span className="text-[2rem] text-[#10b981] font-bold">{settlement.price.toFixed(2)} ETH</span>
                    </div>

                    <div className="flex justify-between items-center text-[#666666]">
                      <span>Operator Fee ({Number(parseInt(DEMO_POOL.operatorFeeBps) / 100)}%):</span>
                      <span className="text-[#1a1a1a] font-semibold">{settlement.operatorFee.toFixed(4)} ETH</span>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-[#10b981]/30">
                      <h3 className="mb-3 text-xl font-semibold">Revenue Distribution ({settlement.netRevenue.toFixed(4)} ETH)</h3>
                      <div className="space-y-4">
                        {/* Art Collection Provider */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[#666666]">Art Collection Provider</span>
                            <span className="text-[#1a1a1a] font-semibold">{settlement.contentRevenue.toFixed(4)} ETH (50%)</span>
                          </div>
                          <div className="w-full bg-[#e5e7eb] rounded-full h-4">
                            <div 
                              className="bg-[#667eea] h-4 rounded-full" 
                              style={{ width: '50%' }}
                            />
                          </div>
                        </div>
                        {/* Hotel Space Provider */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[#666666]">Hotel Space Provider</span>
                            <span className="text-[#1a1a1a] font-semibold">{settlement.venueRevenue.toFixed(4)} ETH (33.3%)</span>
                          </div>
                          <div className="w-full bg-[#e5e7eb] rounded-full h-4">
                            <div 
                              className="bg-[#3b82f6] h-4 rounded-full" 
                              style={{ width: '33.3%' }}
                            />
                          </div>
                        </div>
                        {/* Security Service Provider */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[#666666]">Security Service Provider</span>
                            <span className="text-[#1a1a1a] font-semibold">{settlement.securityRevenue.toFixed(4)} ETH (16.7%)</span>
                          </div>
                          <div className="w-full bg-[#e5e7eb] rounded-full h-4">
                            <div 
                              className="bg-[#10b981] h-4 rounded-full" 
                              style={{ width: '16.7%' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    {userEarnings !== undefined && (
                      <div className="mt-4 pt-4 border-t border-[#e0e0e0]">
                        <div className="text-sm text-[#666666]">
                          <strong>Your Earnings Ledger:</strong>{' '}
                          <span className="font-semibold text-[#1a1a1a]">
                            {userEarnings ? `${String(Number(userEarnings) / 1e18)} ETH` : '0 ETH'}
                          </span>
                          <div className="text-xs text-[#999999] mt-1 italic">
                            Earnings accumulate across all pools. Use withdraw() to claim.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </InfoCard>

                {/* Event Log Panel */}
                {eventLogs.length > 0 && (
                  <div className="mb-6">
                    <EventLogPanel logs={eventLogs} />
                  </div>
                )}

                {/* Activity Panel */}
                {activities.length > 0 && (
                  <div className="mb-6">
                    <ActivityPanel activities={activities} />
                  </div>
                )}

                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={() => {
                        // Check if user already has access - if so, go to result, otherwise go to purchasing
                        if (hasAccess === true) {
                          setDemoState('result');
                        } else {
                          // Reset purchase state when going back
                          if (purchaseHash) {
                            resetPurchase();
                          }
                          setDemoState('purchasing');
                        }
                      }}
                      className="px-4 py-2 text-sm text-[#666666] hover:text-[#333333] border border-[#e0e0e0] rounded-lg hover:bg-[#f5f5f5] transition-colors"
                    >
                      ← Back to Step 2
                    </button>
                    <PrimaryButton 
                      onClick={handleReset} 
                      className="text-[1.1rem]"
                    >
                      Start New Demo
                    </PrimaryButton>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
                </>
              )}
            </div>
          }
          help={
            <div className="space-y-8">
              {/* Product Flow Section */}
              <section className="bg-[#f8f9fa] rounded-lg p-8">
                <h2 className="text-center mb-8 text-[1.75rem] font-semibold">How It Works</h2>
                <div className="flex flex-col md:flex-row justify-center items-start gap-4">
                  <FlowStep 
                    number={1} 
                    title="Create Pool" 
                    description="Set up a gallery pool with content and infrastructure services"
                  />
                  <FlowStep 
                    number={2} 
                    title="User Purchases" 
                    description="Buy gallery access to all services in the pool"
                  />
                  <FlowStep 
                    number={3} 
                    title="Access Services" 
                    description="Use content and infrastructure services with your access"
                  />
                  <FlowStep 
                    number={4} 
                    title="Auto Settlement" 
                    description="Revenue splits automatically to providers"
                    showArrow={false}
                  />
                </div>
              </section>

              {/* Why This Matters Section */}
              <section className="bg-white rounded-xl p-8 shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
                <h3 className="text-center mb-8 text-[1.5rem] font-semibold">Why Pools Exist</h3>
                
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Without Pools */}
                  <div className="bg-[#fef2f2] border-l-4 border-[#ef4444] rounded-r-lg p-6">
                    <h4 className="mb-4 text-[#ef4444] font-semibold">Without Pools</h4>
                    <ul className="space-y-3 text-[#666666]">
                      <li className="flex items-start gap-2">
                        <span className="text-[#ef4444] mt-1 font-bold">•</span>
                        <span>Pay each service provider separately</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#ef4444] mt-1 font-bold">•</span>
                        <span>Manage multiple subscriptions</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#ef4444] mt-1 font-bold">•</span>
                        <span>Complex integration for each service</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#ef4444] mt-1 font-bold">•</span>
                        <span>Higher overhead for small transactions</span>
                      </li>
                    </ul>
                  </div>

                  {/* With Pools */}
                  <div className="bg-[#f0fdf4] border-l-4 border-[#10b981] rounded-r-lg p-6">
                    <h4 className="mb-4 text-[#10b981] font-semibold">With Pools</h4>
                    <ul className="space-y-3 text-[#666666]">
                      <li className="flex items-start gap-2">
                        <span className="text-[#10b981] mt-1 font-bold">•</span>
                        <span>Single payment for multiple services</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#10b981] mt-1 font-bold">•</span>
                        <span>Automatic revenue distribution</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#10b981] mt-1 font-bold">•</span>
                        <span>Simplified access management</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#10b981] mt-1 font-bold">•</span>
                        <span>Lower fees with bundled services</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </section>
            </div>
          }
        />
      </div>
    </div>
  );
}
