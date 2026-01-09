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
import { DeveloperToggle } from '@/components/DeveloperToggle';
import { TransactionLog, TransactionLogEntry, LogLevel } from '@/components/TransactionLog';
import { TransactionProgress } from '@/components/TransactionProgress';
import { RevenueDistribution } from '@/components/RevenueDistribution';
import { MoneyFlowDiagram } from '@/components/MoneyFlowDiagram';
import { SettlementSuccessCard } from '@/components/SettlementSuccessCard';
import { NetworkSwitchButton } from '@/components/NetworkSwitchButton';
import { SystemStatus } from '@/components/SystemStatus';
import { HelpDrawer } from '@/components/HelpDrawer';
import { ProtocolBenefitCard } from '@/components/ProtocolBenefitCard';
import PoolRegistryABI from '@/abis/PoolRegistryABI.json';
import { CONTRACT_ADDRESSES, getRegistryForService } from '@/config';
import { getServiceIcon, CheckIcon, LightBulbIcon, XIcon } from '@/components/Icons';
import { isMockMode } from '@/config/demoMode';

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
// Demonstrates cross-registry composition: ArticleRegistry (#101) + RentalRegistry (#201, #202)
const DEFAULT_POOL = {
  poolId: '42',
  price: '1',
  duration: '604800', // 7 days
  operatorFeeBps: '200', // 2%
  members: [
    { serviceId: '101', registry: getRegistryForService('101'), shares: '3', name: 'Rare Art Collection' },
    { serviceId: '201', registry: getRegistryForService('201'), shares: '2', name: 'Luxury Hotel Space' },
    { serviceId: '202', registry: getRegistryForService('202'), shares: '1', name: 'Premium Security Service' },
  ],
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
  const mockTimeouts = useRef<NodeJS.Timeout[]>([]);
  const purchaseReceiptFound = useRef<Set<string>>(new Set());
  const purchaseCompletedRef = useRef<boolean>(false);
  const createFailedRef = useRef<boolean>(false);
  const createFailedHashRef = useRef<string | null>(null);
  const [mockCreatePhase, setMockCreatePhase] = useState<'idle' | 'signing' | 'pending' | 'confirmed'>('idle');
  const [mockPurchasePhase, setMockPurchasePhase] = useState<'idle' | 'signing' | 'pending' | 'confirmed'>('idle');
  const [mockCreateHash, setMockCreateHash] = useState<string | null>(null);
  const [mockPurchaseHash, setMockPurchaseHash] = useState<string | null>(null);
  const [helpDrawerOpen, setHelpDrawerOpen] = useState(false);
  const isDemoConnected = isMockMode ? true : isConnected;

  const makeMockHash = useCallback(() => {
    const bytes = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    return `0x${Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  }, []);

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
        enabled: !!createHash && !isMockMode,
        retry: 3,
        retryDelay: 1000,
      },
    });
  const { data: purchaseReceipt, isLoading: isPurchaseConfirming, isSuccess: isPurchaseConfirmed, isError: isPurchaseError } = 
    useWaitForTransactionReceipt({ 
      hash: purchaseHash,
      query: {
        enabled: !!purchaseHash && !isMockMode,
        retry: 3,
        retryDelay: 1000,
      },
    });

  const activeCreateHash = isMockMode ? mockCreateHash : createHash;
  const activePurchaseHash = isMockMode ? mockPurchaseHash : purchaseHash;
  const createHasHash = !!activeCreateHash;
  const purchaseHasHash = !!activePurchaseHash;
  const createWaitingForSignature = isMockMode ? mockCreatePhase === 'signing' : (isCreating && !createHash);
  const createWaitingForConfirmations = isMockMode ? mockCreatePhase === 'pending' : (isCreating && !!createHash);
  const createIsConfirming = isMockMode ? mockCreatePhase === 'pending' : isCreateConfirming;
  const createIsConfirmed = isMockMode ? mockCreatePhase === 'confirmed' : isCreateConfirmed;
  const createInProgress = isMockMode
    ? mockCreatePhase === 'signing' || mockCreatePhase === 'pending'
    : isCreating || isCreateConfirming;
  const purchaseWaitingForSignature = isMockMode ? mockPurchasePhase === 'signing' : (isPurchasing && !purchaseHash);
  const purchaseWaitingForConfirmations = isMockMode ? mockPurchasePhase === 'pending' : (isPurchasing && !!purchaseHash);
  const purchaseIsConfirming = isMockMode ? mockPurchasePhase === 'pending' : isPurchaseConfirming;
  const purchaseIsConfirmed = isMockMode ? mockPurchasePhase === 'confirmed' : isPurchaseConfirmed;
  const purchaseInProgress = isMockMode
    ? mockPurchasePhase === 'signing' || mockPurchasePhase === 'pending'
    : isPurchasing || isPurchaseConfirming;
  const displayChainId = isMockMode ? 31337 : chainId;

  // Check if pool already exists (only refetch after tx confirmed or on mount)
  const shouldRefetchPool = !isMockMode && mounted && isConnected && 
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
        if (demoState === 'result' || demoState === 'purchased' || demoState === 'purchase_failed') {
          return false;
        }
        if (purchaseHash && purchaseReceiptFound.current.has(purchaseHash)) {
          return false;
        }
        if (isCreateConfirming || isPurchaseConfirming) {
          return 2000;
        }
        if (isCreateConfirmed) {
          const poolData = poolQuery.data as [bigint, string, bigint, bigint, bigint, number, boolean, bigint, bigint] | undefined;
          if (!poolData || poolData[0] !== BigInt(DEMO_POOL.poolId)) {
            return 2000;
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
    if (mounted && isMockMode) {
      setContractCodeExists(true);
      return;
    }
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
  }, [mounted, isConnected, CONTRACT_ADDRESSES.PoolRegistry, isMockMode]);

  // Query earnings and access for settlement display
  const { data: userEarnings } = useReadContract({
    address: CONTRACT_ADDRESSES.PoolRegistry,
    abi: PoolRegistryABI,
    functionName: 'earnings',
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !isMockMode && !!address && mounted && isConnected },
  });

  const { data: hasAccess } = useReadContract({
    address: CONTRACT_ADDRESSES.PoolRegistry,
    abi: PoolRegistryABI,
    functionName: 'hasPoolAccess',
    args: address && (demoState === 'result' || demoState === 'purchasing') ? [address as `0x${string}`, BigInt(DEMO_POOL.poolId)] : undefined,
    query: { enabled: !isMockMode && !!address && (demoState === 'result' || demoState === 'purchasing') && mounted && isConnected },
  });
  const displayHasAccess = isMockMode ? demoState === 'result' : hasAccess;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      mockTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
      mockTimeouts.current = [];
    };
  }, []);

  useEffect(() => {
    if (mounted && isDemoConnected) {
      addLog('info', isMockMode ? 'Demo mode active (no wallet required)' : 'Wallet connected');
    } else if (mounted && !isDemoConnected && demoState !== 'intro') {
      addLog('warning', 'Wallet disconnected. Please reconnect to continue.');
    }
  }, [mounted, isDemoConnected, addLog, demoState, isMockMode]);

  useEffect(() => {
    if (isMockMode) {
      return;
    }
    if (purchaseCompletedRef.current) {
      return;
    }
    
    if (demoState === 'result' || demoState === 'purchased' || demoState === 'purchasing' || demoState === 'purchase_failed') {
      return;
    }
    
    if (purchaseReceiptFound.current.size > 0) {
      return;
    }
    
    if (poolData && poolData[0] === BigInt(DEMO_POOL.poolId)) {
      if (demoState === 'intro') {
          setDemoState('created');
        addLog('info', 'Pool already exists, proceeding directly to purchase', {
          poolState: {
            exists: true,
            members: Number(poolData[2]),
            totalShares: poolData[3],
          },
        });
      } else if (demoState === 'creating') {
        if (isCreateConfirmed) {
        addLog('success', 'Pool created successfully', {
          poolState: {
            exists: true,
            members: Number(poolData[2]),
            totalShares: poolData[3],
          },
        });
        } else {
          addLog('info', 'Pool data detected, transitioning to purchase step', {
            poolState: {
              exists: true,
              members: Number(poolData[2]),
              totalShares: poolData[3],
            },
          });
        }
        setDemoState('created');
        const goToCheckout = typeof window !== 'undefined' && sessionStorage.getItem('goToCheckout') === 'true';
        if (goToCheckout) {
          sessionStorage.removeItem('goToCheckout');
        }
      }
    }
  }, [poolData, demoState, isCreateConfirmed, addLog, purchaseHash, isMockMode]);

  // Auto-create pool if coming from selection page and pool doesn't exist
  useEffect(() => {
    if (isMockMode) {
      return;
    }
    if (createFailedRef.current) {
      return;
    }
    
    if (DEMO_POOL.members.length === 0) {
      return;
    }
    
    const priceNum = parseFloat(DEMO_POOL.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      return;
    }
    
    if (mounted && isConnected && demoState === 'intro') {
      const goToCheckout = typeof window !== 'undefined' && sessionStorage.getItem('goToCheckout') === 'true';
      const hasSelectedConfig = typeof window !== 'undefined' && sessionStorage.getItem('selectedConfig');
      
      if (goToCheckout && hasSelectedConfig && (!poolData || poolData[0] !== BigInt(DEMO_POOL.poolId))) {
        // Pool doesn't exist, auto-create it
        if (!isCreating && !createHash) {
          createFailedRef.current = false;
          createFailedHashRef.current = null;
          
          const serviceIds = DEMO_POOL.members.map((m: PoolMember) => BigInt(m.serviceId));
          const registries = DEMO_POOL.members.map((m: PoolMember) => m.registry as `0x${string}`);
          const shares = DEMO_POOL.members.map((m: PoolMember) => BigInt(m.shares));
          
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
            addLog('error', `Failed to send transaction: ${error?.message || 'Unknown error'}`);
            setDemoState('intro');
          }
        }
      }
    }
  }, [mounted, isConnected, demoState, poolData, isCreating, createHash, DEMO_POOL, writeCreate, addLog, isMockMode]);

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
      // Find activity using setActivities to avoid dependency on activities array
      setActivities(prev => {
        const activity = prev.find(a => a.txHash === createHash);
      if (activity) {
        updateActivity(activity.id, { status: 'pending' });
      }
        return prev;
      });
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
  }, [createHash, isCreateConfirming, updateActivity, addLog]);

  useEffect(() => {
    if (createReceipt && !loggedEventTx.current.has(createReceipt.transactionHash)) {
      loggedEventTx.current.add(createReceipt.transactionHash);
      
      // Find activity using setActivities to avoid dependency on activities array
      setActivities(prev => {
        const activity = prev.find(a => a.txHash === createReceipt.transactionHash);
      if (activity) {
        updateActivity(activity.id, {
          status: 'confirmed',
          blockNumber: createReceipt.blockNumber,
          gasUsed: createReceipt.gasUsed,
        });
      }
        return prev;
      });
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
      // Find activity using ref to avoid dependency on activities array
      setActivities(prev => {
        const activity = prev.find(a => a.txHash === createHash);
      if (activity) {
        updateActivity(activity.id, { status: 'failed', error: 'Transaction failed' });
      }
        return prev;
      });
      addLog('error', 'createPool transaction failed', {
        txHash: createHash,
        status: 'reverted',
      });
      // Reset demo state on error
      setDemoState('intro');
    }
  }, [createHash, isCreateError, updateActivity, addLog]);

  // Track purchase transaction
  useEffect(() => {
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
            // Update activity status (using setActivities to avoid dependency)
            setActivities(prev => {
              const activity = prev.find(a => a.txHash === purchaseHash);
            if (activity) {
              updateActivity(activity.id, {
                status: 'confirmed',
                blockNumber: BigInt(data.result.blockNumber || '0'),
                gasUsed: BigInt(data.result.gasUsed || '0'),
              });
            }
              return prev;
            });
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
          const timeoutId = setTimeout(startChecking, 2000);
          purchasePollingTimeouts.current.push(timeoutId);
        } else if (checkCount >= maxChecks && !found) {
          addLog('warning', 'Purchase transaction still pending after 60 seconds.');
        }
      };
      
      const initialTimeoutId = setTimeout(() => startChecking(), 1000);
      purchasePollingTimeouts.current.push(initialTimeoutId);

      // Cleanup function to clear all pending timeouts
      return () => {
        purchasePollingTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
        purchasePollingTimeouts.current = [];
      };
    }
  }, [purchaseHash, addActivity, addLog, updateActivity, setDemoState]);

  useEffect(() => {
    if (purchaseHash && isPurchaseConfirming && !loggedConfirmingTx.current.has(purchaseHash)) {
      loggedConfirmingTx.current.add(purchaseHash);
      // Find activity using setActivities to avoid dependency on activities array
      setActivities(prev => {
        const activity = prev.find(a => a.txHash === purchaseHash);
      if (activity) {
        updateActivity(activity.id, { status: 'pending' });
      }
        return prev;
      });
      addLog('info', 'Waiting for transaction confirmations', {
        txHash: purchaseHash,
        status: 'pending',
      });
    }
  }, [purchaseHash, isPurchaseConfirming, updateActivity, addLog]);

  useEffect(() => {
    if (purchaseReceipt && !loggedEventTx.current.has(purchaseReceipt.transactionHash)) {
      loggedEventTx.current.add(purchaseReceipt.transactionHash);
      
      // Find activity using setActivities to avoid dependency on activities array
      setActivities(prev => {
        const activity = prev.find(a => a.txHash === purchaseReceipt.transactionHash);
      if (activity) {
        updateActivity(activity.id, {
          status: 'confirmed',
          blockNumber: purchaseReceipt.blockNumber,
          gasUsed: purchaseReceipt.gasUsed,
        });
      }
        return prev;
      });
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
  }, [purchaseReceipt, updateActivity, addLog]);

  useEffect(() => {
    if (purchaseHash && isPurchaseError) {
      // Find activity using setActivities to avoid dependency on activities array
      setActivities(prev => {
        const activity = prev.find(a => a.txHash === purchaseHash);
      if (activity) {
        updateActivity(activity.id, { status: 'failed', error: 'Transaction failed' });
      }
        return prev;
      });
      addLog('error', 'purchasePool transaction failed', {
        txHash: purchaseHash,
        status: 'reverted',
      });
    }
  }, [purchaseHash, isPurchaseError, updateActivity, addLog]);

  const [shouldAutoPurchase, setShouldAutoPurchase] = useState(false);

  // Navigation handlers that can cancel pending transactions
  const handleBackFromCreate = useCallback(() => {
    if (isMockMode) {
      // Clear mock timeouts
      mockTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
      mockTimeouts.current = [];
      setMockCreatePhase('idle');
      setMockCreateHash(null);
      createFailedRef.current = false;
      createFailedHashRef.current = null;
      addLog('info', 'Demo transaction cancelled');
    } else if (isCreating || isCreateConfirming) {
      // Reset the transaction state
      resetCreate();
      addLog('info', 'Transaction cancelled. Please reject the transaction in MetaMask if the popup is still open.');
    }
    // Navigate back to home page
    router.push('/');
  }, [isCreating, isCreateConfirming, resetCreate, addLog, router, isMockMode]);

  const handleBackFromPurchase = useCallback(() => {
    if (isMockMode) {
      // Clear mock timeouts
      mockTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
      mockTimeouts.current = [];
      setMockPurchasePhase('idle');
      setMockPurchaseHash(null);
      addLog('info', 'Demo transaction cancelled');
    } else if (isPurchasing || isPurchaseConfirming) {
      // Reset the transaction state
      resetPurchase();
      addLog('info', 'Transaction cancelled. Please reject the transaction in MetaMask if the popup is still open.');
    }
    setDemoState('created');
  }, [isPurchasing, isPurchaseConfirming, resetPurchase, addLog, isMockMode]);

  const handlePurchase = useCallback(() => {
    if (isMockMode) {
      setDemoState('purchasing');
      setMockPurchasePhase('signing');
      setMockPurchaseHash(null);
      addLog('info', 'Demo mode: simulating purchase');
      const mockHash = makeMockHash();
      const pendingTimeout = setTimeout(() => {
        setMockPurchasePhase('pending');
        setMockPurchaseHash(mockHash);
        addActivity({
          action: 'Purchase Pool',
          status: 'submitting',
          txHash: mockHash,
        });
        addLog('tx', 'purchasePool transaction sent (demo)', {
          txHash: mockHash,
          status: 'pending',
        });
      }, 400);
      const confirmTimeout = setTimeout(() => {
        setMockPurchasePhase('confirmed');
        purchaseCompletedRef.current = true;
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('purchaseCompleted', 'true');
          sessionStorage.setItem('demoState', 'result');
        }
        setActivities(prev => prev.map(act =>
          act.txHash === mockHash
            ? { ...act, status: 'confirmed' as ActivityStatus }
            : act
        ));
        addLog('success', 'purchasePool transaction confirmed (demo)', {
          txHash: mockHash,
          status: 'confirmed',
        });
        setDemoState('result');
      }, 1400);
      mockTimeouts.current.push(pendingTimeout, confirmTimeout);
      return;
    }
    
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
  }, [writePurchase, addLog, isMockMode, makeMockHash, addActivity, DEMO_POOL]);

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
    if (isMockMode && mockCreatePhase === 'confirmed' && demoState === 'creating') {
      setDemoState('created');
    }
  }, [isMockMode, mockCreatePhase, demoState]);

  useEffect(() => {
    if (isMockMode && mockPurchasePhase === 'confirmed') {
      if (demoState !== 'result') {
        setDemoState('result');
      }
      return;
    }
    if (isPurchaseConfirmed) {
      setDemoState('result');
    }
  }, [isPurchaseConfirmed, isMockMode, mockPurchasePhase, demoState]);

  // Auto-run flow: check if pool exists, create if needed, then purchase
  const handleStartDemo = useCallback(async () => {
    addLog('info', 'Starting package creation flow');

    if (isMockMode) {
      if (DEMO_POOL.members.length === 0) {
        addLog('error', 'No services selected. Please select services first.');
        return;
      }
      createFailedRef.current = false;
      createFailedHashRef.current = null;
      setShouldAutoPurchase(true);
      setDemoState('creating');
      setMockCreatePhase('signing');
      setMockCreateHash(null);
      addLog('info', 'Demo mode: simulating pool creation');
      const mockHash = makeMockHash();
      const pendingTimeout = setTimeout(() => {
        setMockCreatePhase('pending');
        setMockCreateHash(mockHash);
        addActivity({
          action: 'Create Pool',
          status: 'submitting',
          txHash: mockHash,
        });
        addLog('tx', 'createPool transaction sent (demo)', {
          txHash: mockHash,
          status: 'pending',
        });
      }, 400);
      const confirmTimeout = setTimeout(() => {
        setMockCreatePhase('confirmed');
        setActivities(prev => prev.map(act =>
          act.txHash === mockHash
            ? { ...act, status: 'confirmed' as ActivityStatus }
            : act
        ));
        addLog('success', 'Pool created successfully (demo)', {
          poolState: {
            exists: true,
            members: DEMO_POOL.members.length,
            totalShares: BigInt(DEMO_POOL.members.reduce((sum, member) => sum + parseInt(member.shares, 10), 0)),
          },
        });
        setDemoState('created');
      }, 1400);
      mockTimeouts.current.push(pendingTimeout, confirmTimeout);
      return;
    }
    
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
  }, [poolData, writeCreate, handlePurchase, addLog, chainId, switchChain, isMockMode, makeMockHash, addActivity, DEMO_POOL]);

  const handleReset = () => {
    purchaseCompletedRef.current = false;
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('purchaseCompleted');
      sessionStorage.removeItem('demoState');
    }
    mockTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
    mockTimeouts.current = [];
    setMockCreatePhase('idle');
    setMockPurchasePhase('idle');
    setMockCreateHash(null);
    setMockPurchaseHash(null);
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
                <strong>Tip:</strong> After the first deployment, you won&apos;t need to do this again unless you restart Anvil. 
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
              {isDemoConnected ? (
                <div>
                  <span className="text-[#666666] text-[0.85rem]">
                    {isMockMode ? 'Demo Mode' : 'Connected:'}
                  </span>
                  {!isMockMode && address && (
                  <span className="ml-2 font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                  )}
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
        {mounted && isDemoConnected && chainId && chainId !== 1337 && chainId !== 31337 && (
          <NetworkSwitchButton targetChainId={31337} targetChainName="Localhost 8545" />
        )}

        {/* Help Drawer */}
        <HelpDrawer isOpen={helpDrawerOpen} onClose={() => setHelpDrawerOpen(false)} transactionState={demoState} />

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
          {!isDemoConnected && (
                <section className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 mb-6 text-center">
                  <p className="text-yellow-800 font-semibold text-lg mb-2">
                    Wallet Not Connected
                  </p>
              <p className="text-yellow-700 text-sm">
                Please connect your wallet to proceed with checkout. You can still view package details below.
              </p>
                </section>
          )}

          {/* System Status - Only show if connected */}
              {isDemoConnected && <SystemStatus />}

                <section className="bg-white rounded-xl p-8 shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
            <div className="space-y-8">
            {/* Intro State - Only show if pool doesn't exist yet */}
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
                        disabled={!isDemoConnected}
                  >
                        {!isDemoConnected ? 'Connect Wallet to Create Package' : 'Create Package'}
                  </PrimaryButton>
                      {!isDemoConnected && (
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
                  currentStep={createIsConfirmed ? 3 : (createHasHash ? 2 : 1)}
                  totalSteps={3}
                  steps={[
                    { 
                      label: 'Initialize Contract', 
                      status: createHasHash ? 'completed' : (createWaitingForSignature ? 'active' : 'pending')
                    },
                    { 
                      label: 'Authorize Transaction', 
                      status: createIsConfirming ? 'active' : (createHasHash ? 'completed' : 'pending')
                    },
                    { 
                      label: 'Complete', 
                      status: createIsConfirmed ? 'completed' : 'pending'
                    },
                  ]}
                />

                {/* Results KPI */}
                <div className="mb-6">
                  <BeforeAfterPanel 
                    poolId={DEMO_POOL.poolId} 
                    showAfter={demoState === 'created' || createIsConfirmed}
                    price={DEMO_POOL.price}
                    duration={daysDuration}
                    memberCount={DEMO_POOL.members.length}
                    totalShares={settlement.totalShares}
                  />
                </div>

                {/* Transaction Log */}
                <div className="mb-6">
                  <TransactionLog logs={txLogs} chainId={displayChainId} />
                </div>

                {/* Protocol State Panel */}
                {!isMockMode && (
                  <div className="mb-6">
                    <ProtocolStatePanel 
                      poolId={DEMO_POOL.poolId}
                      enabled={mounted && isConnected}
                    />
                  </div>
                )}

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
                        title={createInProgress ? "This will cancel the transaction. Please reject it in MetaMask if popup is open." : ""}
                      >
                        ← Back to Start
                      </button>
                    )}
                    <PrimaryButton 
                      onClick={() => setDemoState('purchasing')}
                      loading={demoState === 'creating' || createInProgress}
                      disabled={demoState === 'creating' || createInProgress || createFailedRef.current}
                      className="text-[1.1rem]"
                    >
                      {createWaitingForSignature ? 'Waiting for wallet confirmation...' : 
                       createWaitingForConfirmations ? 'Waiting for confirmations...' :
                       createIsConfirming ? 'Confirming transaction...' :
                       createFailedRef.current ? 'Create Failed - Try Again' :
                       demoState === 'creating' ? 'Creating Pool...' : 
                       'Proceed to Purchase →'}
                    </PrimaryButton>
                  </div>
                  {(demoState === 'creating' || createInProgress) && (
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
                {displayHasAccess === true && (
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
                {displayHasAccess !== true && (
                  <>
                <h2 className="mb-2 text-[1.75rem] font-semibold">Step 2: Purchase Package</h2>
                <p className="text-[#666666] mb-6 text-lg">
                  Buy complete access to your selected services for {daysDuration} days
                </p>

                {/* Transaction Progress */}
                <TransactionProgress
                  currentStep={purchaseIsConfirmed ? 3 : (purchaseHasHash ? 2 : 1)}
                  totalSteps={3}
                  steps={[
                    { 
                      label: 'Approve Payment', 
                      status: purchaseHasHash ? 'completed' : (purchaseWaitingForSignature ? 'active' : 'pending')
                    },
                    { 
                      label: 'Confirm Transaction', 
                      status: purchaseIsConfirming ? 'active' : (purchaseHasHash ? 'completed' : 'pending')
                    },
                    { 
                      label: 'Complete', 
                      status: purchaseIsConfirmed ? 'completed' : 'pending'
                    },
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
                  <TransactionLog logs={txLogs} chainId={displayChainId} />
                </div>

                <div className="text-center mb-8">
                  <div className="inline-block bg-[#f8f9fa] rounded-lg p-8">
                    <div className="text-[3rem] text-[#667eea] mb-2 font-bold">{DEMO_POOL.price} ETH</div>
                    <p className="text-[#666666]">{daysDuration}-day access to {DEMO_POOL.members.length} {DEMO_POOL.members.length === 1 ? 'service' : 'services'}</p>
                  </div>
                </div>

                {/* Protocol State Panel */}
                {!isMockMode && (
                  <div className="mb-6">
                    <ProtocolStatePanel 
                      poolId={DEMO_POOL.poolId}
                      enabled={mounted && isConnected}
                    />
                  </div>
                )}

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
                  {!purchaseInProgress && (
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
                      title={purchaseInProgress ? "This will cancel the transaction. Please reject it in MetaMask if popup is open." : ""}
                    >
                      ← Back to Step 1
                    </button>
                    <PrimaryButton 
                      variant="success"
                      onClick={handlePurchase}
                      loading={purchaseInProgress && !purchaseIsConfirmed}
                      disabled={purchaseInProgress && !purchaseIsConfirmed}
                      className="text-[1.1rem]"
                    >
                      {purchaseWaitingForSignature ? 'Waiting for wallet confirmation...' :
                       purchaseWaitingForConfirmations ? 'Waiting for confirmations...' :
                       purchaseIsConfirming && !purchaseIsConfirmed ? 'Confirming transaction...' :
                       `Purchase Package (${DEMO_POOL.price} ETH) →`}
                    </PrimaryButton>
                  </div>
                  {purchaseInProgress && (
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
                        if (displayHasAccess === true) {
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
    </div>
  );
}
