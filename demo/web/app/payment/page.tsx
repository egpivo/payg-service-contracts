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
import { WalletButton } from '@/components/WalletButton';
import { ActivityPanel, ActivityItem, ActivityStatus } from '@/components/ActivityPanel';
import { EventLogPanel, EventLog } from '@/components/EventLogPanel';
import { ProtocolStatePanel } from '@/components/ProtocolStatePanel';
import { BeforeAfterPanel } from '@/components/BeforeAfterPanel';
import { HelpDrawer } from '@/components/HelpDrawer';
import { ProtocolBenefitCard } from '@/components/ProtocolBenefitCard';
import { DeveloperToggle } from '@/components/DeveloperToggle';
import { TransactionLog, TransactionLogEntry, LogLevel } from '@/components/TransactionLog';
import { TransactionProgress } from '@/components/TransactionProgress';
import { RevenueDistribution } from '@/components/RevenueDistribution';
import { MoneyFlowDiagram } from '@/components/MoneyFlowDiagram';
import { SettlementSuccessCard } from '@/components/SettlementSuccessCard';
import { PurchaseFailureCard } from '@/components/PurchaseFailureCard';
import { NetworkSwitchButton } from '@/components/NetworkSwitchButton';
import { SystemStatus } from '@/components/SystemStatus';
import PoolRegistryABI from '@/abis/PoolRegistryABI.json';
import { CONTRACT_ADDRESSES, getRegistryForService } from '@/config';
import { getServiceIcon, CheckIcon, LightBulbIcon, XIcon } from '@/components/Icons';

// Service name mapping
const SERVICE_NAMES: Record<string, string> = {
  '101': 'Rare Art Collection',
  '102': 'Historical Documents',
  '201': 'Luxury Hotel Space',
  '202': 'Premium Security Service',
  '203': 'Presentation Services',
};

// Service price mapping (must match select page)
const SERVICE_PRICES: Record<string, string> = {
  '101': '0.5',
  '102': '0.4',
  '201': '0.33',
  '202': '0.17',
  '203': '0.2',
};

interface PoolMember {
  serviceId: string;
  registry: string;
  shares: string;
  name: string;
}

// Default pool configuration
// Empty by default - user must select services from /select page
const DEFAULT_POOL = {
  poolId: '42',
  price: '0',
  duration: '604800', // 7 days
  operatorFeeBps: '200', // 2%
  members: [], // Empty by default - must select services
};

type DemoState = 'intro' | 'creating' | 'created' | 'purchasing' | 'purchased' | 'result' | 'purchase_failed';

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
  const createPollingTimeouts = useRef<NodeJS.Timeout[]>([]);
  const purchasePollingTimeouts = useRef<NodeJS.Timeout[]>([]);
  const purchaseReceiptFound = useRef<Set<string>>(new Set()); // Track which purchase hashes have been confirmed
  const purchaseCompletedRef = useRef<boolean>(false); // Track if purchase has been completed - NEVER reset this
  const createFailedRef = useRef<boolean>(false); // Track if create transaction failed
  const createFailedHashRef = useRef<string | null>(null); // Track which create hash failed

  // Debug: Track all state changes
  const setDemoStateWithLog = useCallback((newState: DemoState, reason: string) => {
    const oldState = demoState;
    console.log(`[STATE CHANGE] ${oldState} -> ${newState} | Reason: ${reason} | PurchaseCompleted: ${purchaseCompletedRef.current}`);
    console.trace('[STATE CHANGE STACK]');
    setDemoState(newState);
  }, [demoState]);

  // Load selected configuration from sessionStorage (client-side only)
  const [DEMO_POOL, setDEMO_POOL] = useState(DEFAULT_POOL);

  // Load configuration from sessionStorage after mount
  useEffect(() => {
    if (mounted) {
      const savedConfig = sessionStorage.getItem('selectedConfig');
      if (savedConfig) {
        try {
          const config = JSON.parse(savedConfig);
          if (config.type === 'package' || config.type === 'custom') {
            const serviceIds = config.services || [];
            // Map service IDs to members with appropriate shares
            const shareMap: Record<string, number> = {
              '101': 3, '102': 3, // content services
              '201': 2, '203': 2, // venue services
              '202': 1, // security services
            };
            
            const members = serviceIds.map((serviceId: string) => ({
              serviceId,
              registry: getRegistryForService(serviceId),
              shares: String(shareMap[serviceId] || 1),
              name: SERVICE_NAMES[serviceId] || `Service #${serviceId}`,
            }));

            // Calculate total price by summing actual service prices (must match select page)
            const totalPrice = serviceIds.reduce((sum: number, serviceId: string) => {
              const price = SERVICE_PRICES[serviceId] || '0';
              return sum + parseFloat(price);
            }, 0);
            
            setDEMO_POOL({
              poolId: '42',
              price: totalPrice.toFixed(2),
              duration: '604800', // 7 days
              operatorFeeBps: '200', // 2%
              members,
            });
          }
        } catch (e) {
          console.error('Failed to parse saved config:', e);
        }
      }
    }
  }, [mounted]);

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
  // Don't refetch if we're in result state (purchase completed)
  // Also don't refetch if purchase was confirmed (even if state hasn't updated yet)
  const shouldRefetchPool = mounted && isConnected && 
    (demoState !== 'result' && demoState !== 'purchased' && demoState !== 'purchase_failed') &&
    !(purchaseHash && purchaseReceiptFound.current.has(purchaseHash)) &&
    (isCreateConfirmed || isPurchaseConfirmed || demoState === 'intro' || demoState === 'creating' || demoState === 'created' || demoState === 'purchasing');
  const poolQuery = useReadContract({
    address: CONTRACT_ADDRESSES.PoolRegistry,
    abi: PoolRegistryABI,
    functionName: 'getPool',
    args: [BigInt(DEMO_POOL.poolId)],
    query: { 
      enabled: shouldRefetchPool,
      refetchInterval: (query) => {
        // Stop refetching if we're in result state (purchase completed) or failed state
        if (demoState === 'result' || demoState === 'purchased' || demoState === 'purchase_failed') {
          return false;
        }
        // Stop refetching if purchase was confirmed (even if state hasn't updated yet)
        if (purchaseHash && purchaseReceiptFound.current.has(purchaseHash)) {
          return false;
        }
        // Keep refetching if we're waiting for confirmation OR if pool was created but data not available yet
        if (isCreateConfirming || isPurchaseConfirming) {
          return 2000;
        }
        // Continue refetching after confirmation until pool data is available
        // Check if pool data exists and matches the expected pool ID
        if (isCreateConfirmed) {
          const poolData = poolQuery.data as [bigint, string, bigint, bigint, bigint, number, boolean, bigint, bigint] | undefined;
          if (!poolData || poolData[0] !== BigInt(DEMO_POOL.poolId)) {
            return 2000; // Keep refetching every 2 seconds until pool data is available
          }
        }
        return false;
      },
    },
  });
  const poolData = poolQuery.data as [bigint, string, bigint, bigint, bigint, number, boolean, bigint, bigint] | undefined;
  const refetchPool = poolQuery.refetch;
  
  // Check if contract code exists at the address
  const [contractCodeExists, setContractCodeExists] = useState<boolean | null>(null);
  
  useEffect(() => {
    if (mounted && isConnected && CONTRACT_ADDRESSES.PoolRegistry) {
      const checkContractCode = async () => {
        try {
          const response = await fetch('http://localhost:8545', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_getCode',
              params: [CONTRACT_ADDRESSES.PoolRegistry, 'latest'],
              id: 1,
            }),
          });
          const data = await response.json();
          const code = data.result || '';
          setContractCodeExists(code && code !== '0x' && code.length > 2);
        } catch (error) {
          console.error('Error checking contract code:', error);
          setContractCodeExists(false);
        }
      };
      checkContractCode();
    }
  }, [mounted, isConnected, CONTRACT_ADDRESSES.PoolRegistry]);

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

  // Debug: Track all state changes
  useEffect(() => {
    console.log(`[STATE] demoState changed to: ${demoState}`, {
      purchaseCompleted: purchaseCompletedRef.current,
      purchaseReceiptFoundSize: purchaseReceiptFound.current.size,
      purchaseHash: purchaseHash || 'none',
      createHash: createHash || 'none',
    });
  }, [demoState, purchaseHash, createHash]);

  useEffect(() => {
    if (mounted && isConnected) {
      addLog('info', 'Wallet connected');
    } else if (mounted && !isConnected && demoState !== 'intro') {
      // Don't reset state when wallet disconnects - just log it
      // This prevents the flow from resetting if user accidentally disconnects
      addLog('warning', 'Wallet disconnected. Please reconnect to continue.');
    }
  }, [mounted, isConnected, addLog, demoState]);

  useEffect(() => {
    // CRITICAL: Never run this effect if purchase was completed
    if (purchaseCompletedRef.current) {
      return;
    }
    
    // Don't run this effect if we're already in 'result' or 'purchased' state
    // Also don't run if we're in 'purchasing' state - let purchase confirmation handle state transitions
    // Also don't run if purchase was confirmed (even if state hasn't updated yet)
    // This prevents the state from being reset after purchase completes or during purchase
    if (demoState === 'result' || demoState === 'purchased' || demoState === 'purchasing' || demoState === 'purchase_failed') {
      return;
    }
    
    // Don't run if purchase was confirmed (even if state hasn't updated yet)
    // Check if ANY purchase hash was confirmed (not just current one, in case purchaseHash was reset)
    if (purchaseReceiptFound.current.size > 0) {
      return;
    }
    
    if (poolData && poolData[0] === BigInt(DEMO_POOL.poolId)) {
      if (demoState === 'intro') {
        // Check if we should go directly to checkout
        const goToCheckout = typeof window !== 'undefined' && sessionStorage.getItem('goToCheckout') === 'true';
        if (goToCheckout) {
          setDemoState('created'); // Go to purchase stage
          sessionStorage.removeItem('goToCheckout'); // Clear flag
        } else {
          setDemoState('created');
        }
        addLog('info', 'Pool already exists, skipping creation', {
          poolState: {
            exists: true,
            members: Number(poolData[2]),
            totalShares: poolData[3],
          },
        });
      } else if (demoState === 'creating') {
        // Transition to 'created' state when pool data is available
        // This works even if isCreateConfirmed hasn't updated yet (backup logic)
        if (isCreateConfirmed) {
          // Log pool state after creation
          addLog('success', 'Pool created successfully', {
            poolState: {
              exists: true,
              members: Number(poolData[2]),
              totalShares: poolData[3],
            },
          });
        } else {
          // Pool data exists but isCreateConfirmed not yet true - log anyway
          addLog('info', 'Pool data detected, transitioning to purchase step', {
            poolState: {
              exists: true,
              members: Number(poolData[2]),
              totalShares: poolData[3],
            },
          });
        }
        // Always transition to 'created' state when pool data is available
        // This ensures pool data is loaded before showing purchase step
        setDemoState('created');
        // Check if we should go directly to checkout after creation
        const goToCheckout = typeof window !== 'undefined' && sessionStorage.getItem('goToCheckout') === 'true';
        if (goToCheckout) {
          sessionStorage.removeItem('goToCheckout'); // Clear flag
        }
      }
      // Explicitly do NOT handle 'created' state here - it should only transition forward via purchase confirmation
    }
  }, [poolData, demoState, isCreateConfirmed, addLog, purchaseHash]);

  // Auto-create pool if coming from selection page and pool doesn't exist
  useEffect(() => {
    // Don't auto-create if we just came from a failed state
    if (createFailedRef.current) {
      console.log('[AUTO-CREATE] BLOCKED: createFailedRef is true');
      return;
    }
    
    // CRITICAL: Wait for DEMO_POOL to be loaded from sessionStorage
    // Check if members array is populated (not empty)
    if (DEMO_POOL.members.length === 0) {
      console.log('[AUTO-CREATE] BLOCKED: DEMO_POOL.members is empty, waiting for config to load...');
      return;
    }
    
    // Validate price is set
    const priceNum = parseFloat(DEMO_POOL.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      console.log('[AUTO-CREATE] BLOCKED: Invalid price:', DEMO_POOL.price);
      return;
    }
    
    if (mounted && isConnected && demoState === 'intro') {
      const goToCheckout = typeof window !== 'undefined' && sessionStorage.getItem('goToCheckout') === 'true';
      const hasSelectedConfig = typeof window !== 'undefined' && sessionStorage.getItem('selectedConfig');
      
      if (goToCheckout && hasSelectedConfig && (!poolData || poolData[0] !== BigInt(DEMO_POOL.poolId))) {
        // Pool doesn't exist, auto-create it
        if (!isCreating && !createHash) {
          console.log('[AUTO-CREATE] Starting auto-creation', {
            membersCount: DEMO_POOL.members.length,
            price: DEMO_POOL.price,
            serviceIds: DEMO_POOL.members.map(m => m.serviceId)
          });
          
          // Clear any previous failure flags
          createFailedRef.current = false;
          createFailedHashRef.current = null;
          
          const serviceIds = DEMO_POOL.members.map((m: PoolMember) => BigInt(m.serviceId));
          const registries = DEMO_POOL.members.map((m: PoolMember) => m.registry as `0x${string}`);
          const shares = DEMO_POOL.members.map((m: PoolMember) => BigInt(m.shares));
          
          // Double-check arrays are not empty
          if (serviceIds.length === 0 || registries.length === 0 || shares.length === 0) {
            console.error('[AUTO-CREATE] ERROR: Empty arrays!', {
              serviceIds: serviceIds.length,
              registries: registries.length,
              shares: shares.length,
              members: DEMO_POOL.members
            });
            addLog('error', 'Invalid pool configuration: empty service arrays');
            return;
          }
          
          setDemoState('creating');
          addLog('info', `Auto-creating pool with ${DEMO_POOL.members.length} services, price: ${DEMO_POOL.price} ETH`);

          try {
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
          } catch (error: any) {
            console.error('[AUTO-CREATE] Failed to send transaction:', error);
            addLog('error', `Failed to send transaction: ${error?.message || 'Unknown error'}`);
            createFailedRef.current = true;
            setDemoState('intro');
          }
        }
      }
    }
  }, [mounted, isConnected, demoState, poolData, isCreating, createHash, DEMO_POOL, writeCreate, addLog]);

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
    // Clear any existing polling timeouts when effect runs or dependencies change
    createPollingTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
    createPollingTimeouts.current = [];

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
            // Trigger pool refetch to ensure data is updated before state transition
            // The useEffect at line 237 will handle state transition when poolData updates
            // This ensures pool data is available before moving to 'created' state
            setTimeout(async () => {
              if (refetchPool) {
                try {
                  await refetchPool();
                } catch (error) {
                  console.error('Error refetching pool after manual check:', error);
                }
              }
            }, 1000); // Wait for block to be processed
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
          const timeoutId = setTimeout(startChecking, 2000);
          createPollingTimeouts.current.push(timeoutId);
        } else if (checkCount >= maxChecks && !found) {
          addLog('warning', 'Transaction still pending after 60 seconds. Please check network and try again.');
          addLog('info', 'If transaction was sent to wrong network, it will never confirm. Please refresh and try again.');
        }
      };
      
      // Start checking after a short delay to allow transaction to be mined
      const initialTimeoutId = setTimeout(() => startChecking(), 1000);
      createPollingTimeouts.current.push(initialTimeoutId);

      // Cleanup function to clear all pending timeouts
      return () => {
        createPollingTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
        createPollingTimeouts.current = [];
      };
    }
  }, [createHash, addActivity, addLog, refetchPool, updateActivity]);

  // Refetch pool after create confirmed
  useEffect(() => {
    if (isCreateConfirmed && createReceipt && refetchPool) {
      addLog('success', 'createPool transaction confirmed', {
        txHash: createReceipt.transactionHash,
        status: 'confirmed',
        gasUsed: createReceipt.gasUsed,
        blockNumber: createReceipt.blockNumber,
      });
      
      // Refetch pool state after confirmation - wait a bit for block to be processed
      // The state transition will happen in the useEffect at line 237 when poolData updates
      setTimeout(async () => {
        try {
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
          } else {
            // Pool not found yet, refetchInterval will continue polling
            addLog('info', 'Pool not found yet, polling will continue...');
          }
        } catch (error: any) {
          console.error('Error refetching pool:', error);
          // If error is "PoolDoesNotExist", pool might not be created yet, keep trying
          if (error?.message?.includes('PoolDoesNotExist') || error?.message?.includes('revert')) {
            addLog('info', 'Pool not found yet (may still be processing), polling will continue...');
          } else {
            addLog('warning', 'Error refetching pool state, polling will continue...');
          }
          // refetchInterval will continue polling automatically
        }
      }, 1500); // Wait a bit longer to ensure block is fully processed
    }
  }, [isCreateConfirmed, createReceipt, refetchPool, addLog]);

  useEffect(() => {
    if (createHash && isCreateConfirming && !loggedConfirmingTx.current.has(createHash)) {
      loggedConfirmingTx.current.add(createHash);
      // Find and update activity in a single setActivities call to avoid race condition
      setActivities(prev => prev.map(act => 
        act.txHash === createHash ? { ...act, status: 'pending' as ActivityStatus } : act
      ));
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
            // Trigger pool refetch to ensure data is updated before state transition
            // The useEffect at line 264 will handle state transition when poolData updates
            // This ensures pool data is available before moving to 'created' state
            setTimeout(async () => {
              if (refetchPool) {
                try {
                  await refetchPool();
                } catch (error) {
                  console.error('Error refetching pool after manual check:', error);
                }
              }
            }, 1000); // Wait for block to be processed
            return true; // Found receipt, stop polling
          }
        } catch (e) {
          // Transaction not found yet, will retry
        }
      };

      // Check immediately and then every 2 seconds
      let checkCount = 0;
      const maxChecks = 30; // 30 checks = 60 seconds
      
      const startChecking = async () => {
        const found = await checkReceipt();
        if (!found && checkCount < maxChecks) {
          checkCount++;
          const timeoutId = setTimeout(startChecking, 2000);
          manualCheckTimeout.current = timeoutId;
        } else if (checkCount >= maxChecks && !found) {
          addLog('warning', 'Transaction still pending after 60 seconds. Please check network and try again.');
        }
      };
      
      // Start checking after a short delay to allow transaction to be mined
      const initialTimeoutId = setTimeout(() => startChecking(), 1000);
      manualCheckTimeout.current = initialTimeoutId;

      return () => {
        if (manualCheckTimeout.current) {
          clearTimeout(manualCheckTimeout.current);
          manualCheckTimeout.current = null;
        }
      };
    }
  }, [createHash, isCreateConfirming, updateActivity, addLog]);

  useEffect(() => {
    if (createReceipt && !loggedEventTx.current.has(createReceipt.transactionHash)) {
      loggedEventTx.current.add(createReceipt.transactionHash);
      
      // Check if transaction reverted
      const isReverted = createReceipt.status === 'reverted';
      
      if (isReverted) {
        // Transaction was confirmed but reverted
        createFailedRef.current = true;
        createFailedHashRef.current = createReceipt.transactionHash;
        console.log('[CREATE FAILED] Transaction reverted:', createReceipt.transactionHash);
        setActivities(prev => prev.map(act => 
          act.txHash === createReceipt.transactionHash 
            ? { ...act, status: 'failed' as ActivityStatus, error: 'Transaction reverted', blockNumber: createReceipt.blockNumber, gasUsed: createReceipt.gasUsed }
            : act
        ));
        addLog('error', 'createPool transaction reverted', {
          txHash: createReceipt.transactionHash,
          status: 'reverted',
          gasUsed: createReceipt.gasUsed,
          blockNumber: createReceipt.blockNumber,
        });
        // Reset create state so user can retry
        resetCreate();
        // Stay in creating state so user can see the error and retry
        return; // Don't process events if reverted
      }
      
      // Clear failed flags if transaction succeeded
      createFailedRef.current = false;
      createFailedHashRef.current = null;
      
      // Find and update activity in a single setActivities call to avoid race condition
      setActivities(prev => prev.map(act => 
        act.txHash === createReceipt.transactionHash 
          ? { ...act, status: 'confirmed' as ActivityStatus, blockNumber: createReceipt.blockNumber, gasUsed: createReceipt.gasUsed }
          : act
      ));
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
  }, [createReceipt, updateActivity]);

  useEffect(() => {
    if (createHash && isCreateError) {
      // Mark as failed
      createFailedRef.current = true;
      createFailedHashRef.current = createHash;
      console.log('[CREATE FAILED] Transaction error:', createHash);
      // Find and update activity in a single setActivities call to avoid race condition
      setActivities(prev => prev.map(act => 
        act.txHash === createHash 
          ? { ...act, status: 'failed' as ActivityStatus, error: 'Transaction failed' }
          : act
      ));
      addLog('error', 'createPool transaction failed', {
        txHash: createHash,
        status: 'reverted',
      });
      // Reset create state so user can retry
      resetCreate();
      // Stay in creating state so user can see the error and retry
    }
  }, [createHash, isCreateError, updateActivity, addLog, resetCreate]);

  // Track purchase transaction
  useEffect(() => {
    // CRITICAL: Never start polling if purchase was completed
    if (purchaseCompletedRef.current) {
      purchasePollingTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
      purchasePollingTimeouts.current = [];
      return;
    }
    
    // Don't start polling if we're already in result state
    // This check must be first to prevent any polling from starting
    if (demoState === 'result' || demoState === 'purchased') {
      // Clear any existing polling timeouts if we're in result state
      purchasePollingTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
      purchasePollingTimeouts.current = [];
      return;
    }

    // Don't start polling if ANY purchase hash was already confirmed
    // This prevents re-polling even if purchaseHash was reset to undefined
    if (purchaseReceiptFound.current.size > 0) {
      // Clear any existing polling timeouts if receipt was already found
      purchasePollingTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
      purchasePollingTimeouts.current = [];
      return;
    }

    // Don't start polling if this specific purchase hash was already confirmed
    if (purchaseHash && purchaseReceiptFound.current.has(purchaseHash)) {
      // Clear any existing polling timeouts if receipt was already found
      purchasePollingTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
      purchasePollingTimeouts.current = [];
      return;
    }

    // Clear any existing polling timeouts when effect runs or dependencies change
    purchasePollingTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
    purchasePollingTimeouts.current = [];

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
            // Update activity status in a single setActivities call to avoid race condition
            setActivities(prev => prev.map(act => 
              act.txHash === purchaseHash 
                ? { ...act, status: 'confirmed' as ActivityStatus, blockNumber: BigInt(data.result.blockNumber || '0'), gasUsed: BigInt(data.result.gasUsed || '0') }
                : act
            ));
            // Mark receipt as found first to prevent any polling from restarting
            purchaseReceiptFound.current.add(purchaseHash);
            
            // CRITICAL: Mark purchase as completed - this flag is NEVER reset
            purchaseCompletedRef.current = true;
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('purchaseCompleted', 'true');
              sessionStorage.setItem('demoState', 'result');
            }
            
            // Clear all polling timeouts
            purchasePollingTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
            purchasePollingTimeouts.current = [];
            // Update state to result
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
        // Stop if receipt was already found for this hash
        if (purchaseReceiptFound.current.has(purchaseHash)) {
          return;
        }
        
        const found = await checkReceipt();
        if (found) {
          purchaseReceiptFound.current.add(purchaseHash);
          // Clear all pending timeouts since we found the receipt
          purchasePollingTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
          purchasePollingTimeouts.current = [];
          return; // Stop polling
        }
        
        if (!found && checkCount < maxChecks && !purchaseReceiptFound.current.has(purchaseHash)) {
          checkCount++;
          // Only schedule next check if we haven't found receipt
          const timeoutId = setTimeout(startChecking, 2000);
          purchasePollingTimeouts.current.push(timeoutId);
        } else if (checkCount >= maxChecks && !found) {
          addLog('warning', 'Purchase transaction still pending after 60 seconds.');
        }
      };
      
      const initialTimeoutId = setTimeout(() => {
        if (!purchaseReceiptFound.current.has(purchaseHash)) {
          startChecking();
        }
      }, 1000);
      purchasePollingTimeouts.current.push(initialTimeoutId);

      // Cleanup function to clear all pending timeouts
      return () => {
        purchasePollingTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
        purchasePollingTimeouts.current = [];
      };
    }
    // Note: demoState is intentionally NOT in dependencies to prevent effect from re-running
    // when state changes to 'result'. We check demoState inside the effect instead.
  }, [purchaseHash, addActivity, addLog, updateActivity, setDemoState]);

  useEffect(() => {
    if (purchaseHash && isPurchaseConfirming && !loggedConfirmingTx.current.has(purchaseHash)) {
      loggedConfirmingTx.current.add(purchaseHash);
      // Find and update activity in a single setActivities call to avoid race condition
      setActivities(prev => prev.map(act => 
        act.txHash === purchaseHash ? { ...act, status: 'pending' as ActivityStatus } : act
      ));
      addLog('info', 'Waiting for transaction confirmations', {
        txHash: purchaseHash,
        status: 'pending',
      });
    }
  }, [purchaseHash, isPurchaseConfirming, updateActivity, addLog]);

  useEffect(() => {
    if (purchaseReceipt && !loggedEventTx.current.has(purchaseReceipt.transactionHash)) {
      console.log('[PURCHASE RECEIPT] Receipt received', {
        txHash: purchaseReceipt.transactionHash,
        currentState: demoState,
        purchaseCompleted: purchaseCompletedRef.current,
      });
      
      loggedEventTx.current.add(purchaseReceipt.transactionHash);
      
      // Mark receipt as found
      purchaseReceiptFound.current.add(purchaseReceipt.transactionHash);
      
      // CRITICAL: Mark purchase as completed - this flag is NEVER reset
      purchaseCompletedRef.current = true;
      console.log('[PURCHASE RECEIPT] Marking purchase as completed');
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('purchaseCompleted', 'true');
        sessionStorage.setItem('demoState', 'result');
        console.log('[PURCHASE RECEIPT] Saved to sessionStorage');
      }
      
      // Find and update activity in a single setActivities call to avoid race condition
      setActivities(prev => prev.map(act => 
        act.txHash === purchaseReceipt.transactionHash 
          ? { ...act, status: 'confirmed' as ActivityStatus, blockNumber: purchaseReceipt.blockNumber, gasUsed: purchaseReceipt.gasUsed }
          : act
      ));
      addLog('success', 'purchasePool transaction confirmed', {
        txHash: purchaseReceipt.transactionHash,
        status: 'confirmed',
        gasUsed: purchaseReceipt.gasUsed,
        blockNumber: purchaseReceipt.blockNumber,
      });
      
      // Clear all purchase polling timeouts
      purchasePollingTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
      purchasePollingTimeouts.current = [];
      
      // Transition to result state if not already there
      if (demoState !== 'result') {
        console.log('[PURCHASE RECEIPT] Setting state to result');
        setDemoState('result');
      } else {
        console.log('[PURCHASE RECEIPT] Already in result state, skipping');
      }
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
  }, [purchaseReceipt, updateActivity, addLog, demoState]);

  // Store purchase error message for display
  const [purchaseErrorMessage, setPurchaseErrorMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (purchaseHash && isPurchaseError) {
      // Find and update activity in a single setActivities call to avoid race condition
      setActivities(prev => prev.map(act => 
        act.txHash === purchaseHash 
          ? { ...act, status: 'failed' as ActivityStatus, error: 'Transaction failed' }
          : act
      ));
      addLog('error', 'purchasePool transaction failed', {
        txHash: purchaseHash,
        status: 'reverted',
      });
      // Set error message if available
      // Note: wagmi's useWaitForTransactionReceipt doesn't provide error message directly
      // We'll use a generic message or try to extract from error if available
      setPurchaseErrorMessage('Transaction failed or was reverted');
      // Transition to purchase_failed state so user can see failure page
      // But only if we're still in 'purchasing' state (not already in 'result')
      if (demoState === 'purchasing') {
        setDemoState('purchase_failed');
      }
    }
  }, [purchaseHash, isPurchaseError, updateActivity, addLog, demoState]);

  const [shouldAutoPurchase, setShouldAutoPurchase] = useState(false);

  // Navigation handlers that can cancel pending transactions
  const handleBackFromCreate = useCallback(() => {
    if (isCreating || isCreateConfirming) {
      // Reset the transaction state
      resetCreate();
      addLog('info', 'Transaction cancelled. Please reject the transaction in MetaMask if the popup is still open.');
    }
    // Navigate back to home page
    router.push('/');
  }, [isCreating, isCreateConfirming, resetCreate, addLog, router]);

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
  }, [writePurchase, addLog, DEMO_POOL]);

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
    if (isPurchaseConfirmed && purchaseHash) {
      // Mark this purchase hash as confirmed
      purchaseReceiptFound.current.add(purchaseHash);
      
      // CRITICAL: Mark purchase as completed - this flag is NEVER reset
      purchaseCompletedRef.current = true;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('purchaseCompleted', 'true');
        sessionStorage.setItem('demoState', 'result');
      }
      
      // Clear all purchase polling timeouts when confirmed via wagmi
      purchasePollingTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
      purchasePollingTimeouts.current = [];
      // Only set state if not already in result or purchased state
      if (demoState !== 'result' && demoState !== 'purchased') {
        setDemoState('result');
      }
    }
  }, [isPurchaseConfirmed, purchaseHash, demoState]);

  // Auto-run flow: check if pool exists, create if needed, then purchase
  const handleStartDemo = useCallback(async () => {
    addLog('info', 'Starting package creation flow');
    
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
        addLog('info', 'Network switch initiated. Please wait 2-3 seconds, then click "Create Package" again.');
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
    
    // Check if any services are selected
    if (DEMO_POOL.members.length === 0) {
      addLog('error', 'No services selected. Please select services first.');
      return;
    }
    
    // Validate price
    const priceNum = parseFloat(DEMO_POOL.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      addLog('error', `Invalid price: ${DEMO_POOL.price}. Please select services first.`);
      return;
    }
    
    // Clear any previous failure flags
    createFailedRef.current = false;
    createFailedHashRef.current = null;
    
    // Check if pool exists
    if (poolData && poolData[0] === BigInt(DEMO_POOL.poolId)) {
      // Pool exists, go straight to purchase
      addLog('info', 'Pool already exists, proceeding to purchase');
      handlePurchase();
    } else {
      // Pool doesn't exist, create it first (will auto-purchase after creation)
      addLog('info', 'Pool does not exist, creating pool...');
      addLog('info', `Creating pool with ${DEMO_POOL.members.length} services, price: ${DEMO_POOL.price} ETH`);
      
      const serviceIds = DEMO_POOL.members.map((m: PoolMember) => BigInt(m.serviceId));
      const registries = DEMO_POOL.members.map((m: PoolMember) => m.registry as `0x${string}`);
      const shares = DEMO_POOL.members.map((m: PoolMember) => BigInt(m.shares));
      
      // Double-check arrays are not empty
      if (serviceIds.length === 0 || registries.length === 0 || shares.length === 0) {
        addLog('error', `Invalid pool configuration: serviceIds=${serviceIds.length}, registries=${registries.length}, shares=${shares.length}`);
        console.error('[CREATE POOL] Invalid state:', { 
          members: DEMO_POOL.members, 
          serviceIds, 
          registries, 
          shares,
          price: DEMO_POOL.price 
        });
        return;
      }

      setShouldAutoPurchase(true);
      setDemoState('creating');
      addLog('info', 'Requesting wallet signature for createPool');

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
  }, [poolData, writeCreate, handlePurchase, addLog, chainId, switchChain, DEMO_POOL]);

  const handleReset = () => {
    // Clear purchase completed flag when user explicitly resets
    purchaseCompletedRef.current = false;
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('purchaseCompleted');
      sessionStorage.removeItem('demoState');
    }
    setDemoState('intro');
    setActivities([]);
    setEventLogs([]);
    // Check if user came from select page
    const hasSelectedConfig = typeof window !== 'undefined' && sessionStorage.getItem('selectedConfig');
    // Navigate back: if came from select page, go back to select; otherwise go to home
    if (hasSelectedConfig) {
      router.push('/select');
    } else {
      router.push('/');
    }
  };

  // Calculate settlement breakdown
  const calculateSettlement = () => {
    const price = parseFloat(DEMO_POOL.price);
    const operatorFeeBps = parseInt(DEMO_POOL.operatorFeeBps);
    const operatorFee = price * (operatorFeeBps / 10000);
    const netRevenue = price - operatorFee;
    
    const totalShares = DEMO_POOL.members.reduce((sum: number, m: PoolMember) => sum + parseInt(m.shares), 0);
    
    // Calculate revenue for each member dynamically
    const memberRevenues = DEMO_POOL.members.map((member: PoolMember) => {
      const shares = parseInt(member.shares);
      return {
        member,
        revenue: totalShares > 0 ? (netRevenue * shares) / totalShares : 0,
        shares,
        percentage: totalShares > 0 ? (shares / totalShares) * 100 : 0,
      };
    });
    
    // For backward compatibility, keep the old structure but use first member's revenue
    const contentRevenue = memberRevenues[0]?.revenue || 0;
    const venueRevenue = memberRevenues[1]?.revenue || 0;
    const securityRevenue = memberRevenues[2]?.revenue || 0;

    return {
      price,
      operatorFee,
      netRevenue,
      contentRevenue,
      venueRevenue,
      securityRevenue,
      totalShares,
      memberRevenues, // Add new field for dynamic member revenues
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

  // Show friendly setup guide if contract doesn't exist (first-time setup)
  if (mounted && isConnected && contractCodeExists === false) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-8 mb-6 shadow-lg">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold text-blue-900 mb-2">🚀 First Time Setup</h2>
              <p className="text-blue-700 text-lg">
                This is a development demo. You need to deploy the contract once to get started.
              </p>
            </div>
            
            <div className="bg-white rounded-lg p-6 mb-4 shadow-md">
              <h3 className="font-semibold text-xl mb-4 text-gray-800">Quick Setup (One-time only)</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                    1
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800 mb-1">Start local blockchain</p>
                    <p className="text-sm text-gray-600 mb-2">Open a terminal and run:</p>
                    <code className="block bg-gray-800 text-green-400 px-4 py-2 rounded text-sm font-mono">
                      make anvil-free
                    </code>
                    <p className="text-xs text-gray-500 mt-2">Keep this terminal running</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                    2
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800 mb-1">Deploy the contract</p>
                    <p className="text-sm text-gray-600 mb-2">Open another terminal and run:</p>
                    <code className="block bg-gray-800 text-green-400 px-4 py-2 rounded text-sm font-mono">
                      make deploy-local
                    </code>
                    <p className="text-xs text-gray-500 mt-2">This will automatically update the contract address</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
                    3
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800 mb-1">Refresh this page</p>
                    <p className="text-sm text-gray-600">Click the button below or refresh your browser</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors"
              >
                🔄 Refresh Page
              </button>
              <Link
                href="/"
                className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg shadow-md transition-colors"
              >
                ← Back to Home
              </Link>
            </div>
            
            <div className="mt-6 bg-blue-100 border border-blue-300 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>💡 Tip:</strong> After the first deployment, you won't need to do this again unless you restart Anvil. 
                The contract address is saved in <code className="bg-blue-200 px-1 rounded">demo/contracts.json</code>.
              </p>
            </div>
          </div>
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
            <Link
              href="/"
              className="text-[#667eea] hover:text-[#5568d3] font-semibold text-sm underline ml-4"
            >
              Home
            </Link>
          </div>
          <div>
            <WalletButton />
          </div>
        </section>

        {/* Network Switch Warning - Only show if not on localhost networks */}
        {mounted && isConnected && chainId && chainId !== 1337 && chainId !== 31337 && (
          <NetworkSwitchButton targetChainId={31337} targetChainName="Localhost 8545" />
        )}

        {/* Help Drawer */}
        <HelpDrawer isOpen={helpDrawerOpen} onClose={() => setHelpDrawerOpen(false)} />

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          {/* Help Link */}
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setHelpDrawerOpen(true)}
              className="flex items-center gap-2 text-sm text-[#667eea] hover:text-[#5568d3] font-medium transition-colors"
            >
              <LightBulbIcon className="w-4 h-4" />
              How it works
            </button>
          </div>

          {/* Package Header - Only show if services are selected */}
          {DEMO_POOL.members.length > 0 && (
            <>
            <section className="bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-xl p-8 mb-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl font-bold mb-2">Service Package #{DEMO_POOL.poolId}</h1>
                      <p className="text-white/80 text-sm">Complete access to selected services</p>
                    </div>
                    <div className="bg-white/15 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                      <div className="grid grid-cols-4 gap-4 text-center">
                        <div>
                          <span className="text-white/70 text-xs block mb-1">Price</span>
                          <span className="text-white font-semibold text-lg">{DEMO_POOL.price} ETH</span>
                        </div>
                        <div>
                          <span className="text-white/70 text-xs block mb-1">Duration</span>
                          <span className="text-white font-semibold text-lg">{daysDuration} days</span>
                        </div>
                        <div>
                          <span className="text-white/70 text-xs block mb-1">Fee</span>
                          <span className="text-white font-semibold text-lg">{Number(parseInt(DEMO_POOL.operatorFeeBps) / 100)}%</span>
                        </div>
                        <div>
                          <span className="text-white/70 text-xs block mb-1">Services</span>
                          <span className="text-white font-semibold text-lg">{DEMO_POOL.members.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
                
                {/* Protocol Benefit Card */}
                <ProtocolBenefitCard className="mb-6" />
                </>
              )}

              {/* Wallet Connection Banner - Show if not connected */}
              {!isConnected && (
                <section className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 mb-6 text-center">
                  <p className="text-yellow-800 font-semibold text-lg mb-2">
                    ⚠️ Wallet Not Connected
                  </p>
                  <p className="text-yellow-700 text-sm">
                    Please connect your wallet to proceed with checkout. You can still view package details below.
                  </p>
                </section>
              )}

              {/* System Status - Only show if connected */}
              {isConnected && <SystemStatus />}

              <section className="bg-white rounded-xl p-8 shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
            <div className="space-y-8">
            {/* Intro State */}
            {demoState === 'intro' && (
              <div>
                {DEMO_POOL.members.length === 0 ? (
                  <div className="text-center space-y-6">
                    <div className="bg-white rounded-xl p-8 border-2 border-[#e0e0e0]">
                      <h3 className="text-xl font-semibold mb-4">No Services Selected</h3>
                      <p className="text-[#666666] mb-6">
                        Please select services to create a package.
                      </p>
                      <Link href="/select">
                        <PrimaryButton className="text-[1.1rem]">
                          Select Services →
                        </PrimaryButton>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Selected Services Summary */}
                    <div className="bg-white rounded-xl p-6 mb-6 border-2 border-[#e0e0e0]">
                      <h3 className="mb-4 text-lg font-semibold">Selected Services</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        {DEMO_POOL.members.map((member: PoolMember, index: number) => (
                          <div key={index} className="flex items-center gap-3 p-3 bg-[#f8f9fa] rounded-lg">
                            <span className="text-2xl">
                              {getServiceIcon(member.serviceId, "w-5 h-5")}
                            </span>
                            <div>
                              <div className="font-semibold text-[#1a1a1a]">{member.name}</div>
                              <div className="text-sm text-[#666666]">{member.shares} shares</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="pt-4 border-t border-[#e0e0e0] flex items-center justify-between">
                        <div>
                          <div className="text-sm text-[#666666]">Total Price</div>
                          <div className="text-2xl font-bold text-[#667eea]">{DEMO_POOL.price} ETH</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-[#666666]">Duration</div>
                          <div className="text-lg font-semibold">{daysDuration} days</div>
                        </div>
                      </div>
                    </div>

                    <div className="text-center">
                      <PrimaryButton 
                        onClick={handleStartDemo}
                        className="text-[1.1rem]"
                        disabled={!isConnected}
                      >
                        {!isConnected ? 'Connect Wallet to Create Package' : 'Create Package'}
                      </PrimaryButton>
                      {!isConnected && (
                        <p className="text-sm text-[#999999] mt-3">
                          You need to connect your wallet to create a package
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}


            {/* Create Step */}
            {(demoState === 'creating' || demoState === 'created') && (
              <div>
                <h2 className="mb-2 text-[1.75rem] font-semibold">Step 1: Create Package</h2>
                <p className="text-[#666666] mb-6 text-base">
                  Creating package with {DEMO_POOL.members.length} services
                </p>

                {/* Transaction Progress */}
                <TransactionProgress
                  currentStep={isCreateConfirmed ? 3 : (createHash ? 2 : 1)}
                  totalSteps={3}
                  steps={[
                    { label: 'Initialize Contract', status: createHash ? 'completed' : (isCreating ? 'active' : 'pending') },
                    { label: 'Authorize Transaction', status: isCreateConfirming ? 'active' : (createHash ? 'completed' : 'pending') },
                    { label: 'Complete', status: isCreateConfirmed ? 'completed' : 'pending' },
                  ]}
                />

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
                  <TransactionLog logs={txLogs} chainId={chainId} />
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
                  {/* Check if create failed */}
                  {(createFailedRef.current || isCreateError || (createReceipt && createReceipt.status === 'reverted')) ? (
                    <div className="space-y-4">
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <XIcon className="w-5 h-5 text-red-600" />
                          <h3 className="text-lg font-semibold text-red-800">Package Creation Failed</h3>
                        </div>
                        <p className="text-sm text-red-700 mb-2">
                          The transaction failed or was reverted. Please check the transaction details below and try again.
                        </p>
                        {createFailedHashRef.current && (
                          <div className="text-xs text-red-600 font-mono break-all">
                            Tx: {createFailedHashRef.current}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-center gap-4">
                        <button
                          onClick={() => {
                            // Reset everything and go back to start
                            console.log('[BACK TO START] Resetting state');
                            createFailedRef.current = false;
                            createFailedHashRef.current = null;
                            resetCreate();
                            // Clear sessionStorage flags that might trigger auto-creation
                            if (typeof window !== 'undefined') {
                              sessionStorage.removeItem('goToCheckout');
                            }
                            // Set state to intro and prevent auto-creation
                            setDemoState('intro');
                            // Navigate to home to fully reset
                            setTimeout(() => {
                              router.push('/');
                            }, 100);
                          }}
                          className="px-6 py-3 text-sm text-[#666666] hover:text-[#333333] border border-[#e0e0e0] rounded-lg hover:bg-[#f5f5f5] transition-colors"
                        >
                          ← Back to Start
                        </button>
                        <PrimaryButton
                          onClick={() => {
                            // Reset and retry
                            createFailedRef.current = false;
                            createFailedHashRef.current = null;
                            resetCreate();
                            setDemoState('creating');
                            // Trigger create again
                            const serviceIds = DEMO_POOL.members.map((m: PoolMember) => BigInt(m.serviceId));
                            const registries = DEMO_POOL.members.map((m: PoolMember) => m.registry as `0x${string}`);
                            const shares = DEMO_POOL.members.map((m: PoolMember) => BigInt(m.shares));
                            setTimeout(() => {
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
                            }, 100);
                          }}
                          className="text-[1.1rem]"
                        >
                          Try Again →
                        </PrimaryButton>
                      </div>
                    </div>
                  ) : (
                    <>
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
                    </>
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
                    <p className="text-green-800 font-semibold flex items-center gap-2">
                      <CheckIcon className="w-5 h-5" />
                      You have already purchased this pool!
                    </p>
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
                <h2 className="mb-2 text-[1.75rem] font-semibold">Step 2: Purchase Package</h2>
                <p className="text-[#666666] mb-6 text-lg">
                  Buy complete access to your selected services for {daysDuration} days
                </p>

                {/* Transaction Progress */}
                <TransactionProgress
                  currentStep={isPurchaseConfirmed ? 3 : (purchaseHash ? 2 : 1)}
                  totalSteps={3}
                  steps={[
                    { label: 'Approve Payment', status: purchaseHash ? 'completed' : (isPurchasing ? 'active' : 'pending') },
                    { label: 'Confirm Transaction', status: isPurchaseConfirming ? 'active' : (purchaseHash ? 'completed' : 'pending') },
                    { label: 'Complete', status: isPurchaseConfirmed ? 'completed' : 'pending' },
                  ]}
                />

                {/* Selected Services Display */}
                <div className="bg-white rounded-xl p-6 mb-6 border-2 border-[#e0e0e0]">
                  <h3 className="text-lg font-semibold mb-4 text-[#1a1a1a]">Selected Services:</h3>
                  <div className="space-y-3">
                    {DEMO_POOL.members.map((member: PoolMember, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-[#f8f9fa] rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-[#667eea]">
                            {getServiceIcon(member.serviceId, "w-6 h-6")}
                          </span>
                          <div>
                            <div className="font-semibold text-[#1a1a1a]">{member.name}</div>
                            <div className="text-sm text-[#666666]">Service ID: {member.serviceId} • Shares: {member.shares}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Transaction Log */}
                <div className="mb-6">
                  <TransactionLog logs={txLogs} chainId={chainId} />
                </div>

                <div className="text-center mb-8">
                  <div className="inline-block bg-[#f8f9fa] rounded-lg p-8">
                    <div className="text-[3rem] text-[#667eea] mb-2 font-bold">{DEMO_POOL.price} ETH</div>
                    <p className="text-[#666666]">{daysDuration}-day access to {DEMO_POOL.members.length} {DEMO_POOL.members.length === 1 ? 'service' : 'services'}</p>
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
                  {!isPurchasing && !isPurchaseConfirming && (
                    <div className="mb-3 text-sm text-[#666666] bg-[#f8f9fa] rounded-lg p-3 border border-[#e0e0e0]">
                      <span className="font-semibold">Total Payment:</span> {DEMO_POOL.price} ETH + estimated gas fee
                      <br />
                      <span className="text-xs text-[#999999]">Gas fee will be shown in MetaMask confirmation popup</span>
                    </div>
                  )}
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
                      <div className="flex items-center gap-2">
                        <LightBulbIcon className="w-4 h-4 text-[#999999]" />
                        <span>If MetaMask popup is open, please <strong>reject</strong> the transaction there, then click &quot;Back&quot; above.</span>
                      </div>
                    </div>
                  )}
                </div>
                  </>
                )}
              </div>
            )}

            {/* Purchase Failed State */}
            {demoState === 'purchase_failed' && (
              <div>
                <h2 className="mb-2 text-[1.75rem] font-semibold">Purchase Failed</h2>
                <p className="text-[#666666] mb-6 text-lg">
                  The purchase transaction could not be completed. Please review the error and try again.
                </p>

                {/* Purchase Failure Card */}
                <div className="mb-6">
                  <PurchaseFailureCard
                    txHash={purchaseHash || undefined}
                    errorMessage={purchaseErrorMessage}
                    onRetry={() => {
                      // Reset purchase state and retry
                      if (purchaseHash) {
                        resetPurchase();
                      }
                      setPurchaseErrorMessage(undefined);
                      setDemoState('created');
                      // Trigger purchase again
                      setTimeout(() => {
                        handlePurchase();
                      }, 100);
                    }}
                    onBack={() => {
                      // Reset purchase state and go back to created state
                      if (purchaseHash) {
                        resetPurchase();
                      }
                      setPurchaseErrorMessage(undefined);
                      setDemoState('created');
                    }}
                  />
                </div>

                {/* Transaction Activity */}
                {activities.length > 0 && (
                  <div className="mb-6">
                    <ActivityPanel activities={activities} />
                  </div>
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

                {/* Settlement Success Card */}
                <div className="mb-6">
                  <SettlementSuccessCard
                    totalPayment={settlement.price.toFixed(4)}
                    netRevenue={settlement.netRevenue.toFixed(4)}
                    operatorFee={settlement.operatorFee.toFixed(4)}
                    gasUsed={purchaseReceipt?.gasUsed}
                  />
                </div>

                {/* Money Flow Diagram */}
                <div className="mb-6">
                  <MoneyFlowDiagram
                    totalPayment={settlement.price}
                    operatorFee={settlement.operatorFee}
                    netRevenue={settlement.netRevenue}
                    providers={settlement.memberRevenues.map((mr, index) => {
                      const colors = [
                        '#667eea', // Purple
                        '#3b82f6', // Blue
                        '#10b981', // Green
                        '#f59e0b', // Amber
                        '#ef4444', // Red
                        '#8b5cf6', // Violet
                      ];
                      return {
                        name: mr.member.name,
                        amount: mr.revenue,
                        percentage: mr.percentage,
                        color: colors[index % colors.length],
                      };
                    })}
                  />
                </div>

                {/* Detailed Revenue Distribution (for reference) */}
                <div className="mb-6">
                  <RevenueDistribution
                    totalPayment={settlement.price.toFixed(4)}
                    operatorFee={settlement.operatorFee.toFixed(4)}
                    netRevenue={settlement.netRevenue.toFixed(4)}
                    providers={settlement.memberRevenues.map((mr, index) => {
                      // Color palette for different providers
                      const colors = [
                        'bg-[#667eea]', // Purple
                        'bg-[#3b82f6]', // Blue
                        'bg-[#10b981]', // Green
                        'bg-[#f59e0b]', // Amber
                        'bg-[#ef4444]', // Red
                        'bg-[#8b5cf6]', // Violet
                      ];
                      return {
                        name: mr.member.name,
                        address: mr.member.registry || '0x0000000000000000000000000000000000000000',
                        amount: mr.revenue.toFixed(4),
                        percentage: Number(mr.percentage.toFixed(1)),
                        color: colors[index % colors.length],
                      };
                    })}
                  />
                </div>

                {/* User Earnings */}
                {userEarnings !== undefined && (
                  <InfoCard variant="info" className="mb-6">
                    <div className="text-sm text-[#666666]">
                      <strong>Your Earnings Ledger:</strong>{' '}
                      <span className="font-semibold text-[#1a1a1a]">
                        {userEarnings ? `${String(Number(userEarnings) / 1e18)} ETH` : '0 ETH'}
                      </span>
                      <div className="text-xs text-[#999999] mt-1 italic">
                        Earnings accumulate across all pools. Use withdraw() to claim.
                      </div>
                    </div>
                  </InfoCard>
                )}

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
                      Create New Package
                    </PrimaryButton>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
            </div>
          </div>
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

              {/* Protocol Concepts Section */}
              <section className="bg-white rounded-xl p-8 shadow-[0_2px_8px_rgba(0,0,0,0.1)] mb-8">
                <h3 className="text-center mb-6 text-[1.5rem] font-semibold">Protocol Concepts</h3>
                <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-lg p-6 text-white">
                  <p className="text-center mb-6 text-sm opacity-90">
                    Understanding how services are composed into packages
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white/15 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                      <p className="opacity-75 text-xs mb-1">Art Collection</p>
                      <p className="font-semibold">= Service</p>
                    </div>
                    <div className="bg-white/15 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                      <p className="opacity-75 text-xs mb-1">Hotel Space & Security</p>
                      <p className="font-semibold">= Services</p>
                    </div>
                    <div className="bg-white/15 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                      <p className="opacity-75 text-xs mb-1">Access Package</p>
                      <p className="font-semibold">= Pool</p>
                    </div>
                    <div className="bg-white/15 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                      <p className="opacity-75 text-xs mb-1">Providers</p>
                      <p className="font-semibold">= Revenue Recipients</p>
                    </div>
                  </div>
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
