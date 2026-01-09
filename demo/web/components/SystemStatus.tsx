'use client';

import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { useReadContract } from 'wagmi';
import { useEffect, useState } from 'react';
import { CONTRACT_ADDRESSES } from '@/config';
import PoolRegistryABI from '@/abis/PoolRegistryABI.json';
import { isMockMode } from '@/config/demoMode';

const EXPECTED_CHAIN_ID = 31337; // Anvil localhost

export function SystemStatus() {
  const { isConnected } = useAccount();
  const isDemoConnected = isMockMode ? true : isConnected;
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [rpcStatus, setRpcStatus] = useState<'checking' | 'connected' | 'failed'>('checking');
  const [contractCode, setContractCode] = useState<'checking' | 'yes' | 'no'>('checking');
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [actualChainId, setActualChainId] = useState<number | null>(null);

  // Manually check MetaMask's actual chainId
  useEffect(() => {
    if (isMockMode) {
      return;
    }
    const checkActualChainId = async () => {
      const ethereum = (window as any).ethereum;
      if (ethereum && ethereum.request) {
        try {
          const chainIdHex = await ethereum.request({ method: 'eth_chainId' });
          const chainId = parseInt(chainIdHex, 16);
          setActualChainId(chainId);
        } catch (e) {
          console.error('Failed to get chainId from MetaMask:', e);
        }
      }
    };

    if (isConnected) {
      checkActualChainId();
      
      // Listen for chain changes - show message but don't auto-reload (prevent loop)
      const ethereum = (window as any).ethereum;
      if (ethereum) {
        const handleChainChanged = () => {
          // Just log, don't auto-reload to prevent infinite loop
          console.log('Chain changed detected. Please manually refresh the page.');
        };
        
        ethereum.on('chainChanged', handleChainChanged);
        
        return () => {
          ethereum.removeListener('chainChanged', handleChainChanged);
        };
      }
    }
  }, [isConnected, isMockMode]);

  // Check RPC status
  useEffect(() => {
    if (isMockMode) {
      return;
    }
    const checkRPC = async () => {
      try {
        const response = await fetch('http://localhost:8545', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1,
          }),
        });
        if (response.ok) {
          setRpcStatus('connected');
        } else {
          setRpcStatus('failed');
        }
      } catch (e) {
        setRpcStatus('failed');
      }
    };

    if (isConnected) {
      checkRPC();
    }
  }, [isConnected, isMockMode]);

  // Use actualChainId if available, otherwise fall back to wagmi's chainId
  const detectedChainId = actualChainId ?? chainId;
  const isWrongNetwork = detectedChainId !== EXPECTED_CHAIN_ID;
  const networkName = detectedChainId === 31337 ? 'Localhost (31337)' : `Chain ${detectedChainId}`;

  // Check contract code - use direct RPC call to bypass Wagmi network issues
  const [manualContractCheck, setManualContractCheck] = useState<'checking' | 'yes' | 'no'>('checking');
  
  useEffect(() => {
    if (isMockMode) {
      return;
    }
    if (isConnected && rpcStatus === 'connected') {
      const checkContract = async () => {
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
          if (code && code !== '0x') {
            setManualContractCheck('yes');
          } else {
            setManualContractCheck('no');
          }
        } catch (e) {
          setManualContractCheck('no');
        }
      };
      checkContract();
    }
  }, [isConnected, rpcStatus, isMockMode]);

  // Also try Wagmi's method as fallback
  const { data: contractData } = useReadContract({
    address: CONTRACT_ADDRESSES.PoolRegistry,
    abi: PoolRegistryABI,
    functionName: 'MAX_MEMBERS_PER_POOL',
    query: { enabled: !isMockMode && isConnected && rpcStatus === 'connected' && detectedChainId === 31337 },
  });

  useEffect(() => {
    // Use manual check result if available, otherwise fall back to Wagmi
    if (manualContractCheck !== 'checking') {
      setContractCode(manualContractCheck);
    } else if (contractData !== undefined) {
      setContractCode('yes');
    } else if (rpcStatus === 'connected' && isConnected && detectedChainId === 31337) {
      // Give it a moment, then check again
      const timer = setTimeout(() => {
        if (manualContractCheck === 'checking') {
          setContractCode('no');
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [contractData, rpcStatus, isConnected, manualContractCheck, detectedChainId]);

  if (!isDemoConnected) {
    return null;
  }

  if (isMockMode) {
    return (
      <div className="bg-white rounded-lg p-4 mb-6 border border-[#e0e0e0]">
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[#666666]">Network:</span>
            <span className="font-semibold text-green-600">Demo Mode (display only)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#666666]">RPC:</span>
            <span className="font-semibold text-[#999999]">Disabled</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#666666]">PoolRegistry:</span>
            <span className="font-mono text-xs text-[#999999]">
              {CONTRACT_ADDRESSES.PoolRegistry.slice(0, 6)}...{CONTRACT_ADDRESSES.PoolRegistry.slice(-4)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const handleSwitchNetwork = async () => {
    setSwitchError(null);
    try {
      await switchChain({ chainId: EXPECTED_CHAIN_ID });
    } catch (e: any) {
      console.error('Failed to switch network:', e);
      
      // Handle specific error cases
      if (e?.message?.includes('user rejected') || e?.message?.includes('User rejected')) {
        setSwitchError('Network switch rejected by user');
      } else if (e?.message?.includes('Unrecognized chain') || e?.code === 4902 || e?.message?.includes('not added')) {
        // Chain not added to wallet, try to add it programmatically
        try {
          const ethereum = (window as any).ethereum;
          if (ethereum && ethereum.request) {
            await ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${EXPECTED_CHAIN_ID.toString(16)}`,
                chainName: 'Localhost 8545',
                nativeCurrency: {
                  name: 'Ether',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: ['http://localhost:8545'],
                blockExplorerUrls: null,
              }],
            });
            // After adding, try switching again
            setTimeout(async () => {
              try {
                await switchChain({ chainId: EXPECTED_CHAIN_ID });
              } catch (retryError) {
                console.error('Failed to switch after adding network:', retryError);
                setSwitchError('Network added but switch failed. Please switch manually in MetaMask.');
              }
            }, 500);
          } else {
            setSwitchError('MetaMask not found. Please add localhost network manually (see instructions below).');
          }
        } catch (addError: any) {
          console.error('Failed to add network:', addError);
          if (addError?.message?.includes('user rejected') || addError?.message?.includes('User rejected')) {
            setSwitchError('Network addition rejected by user');
          } else {
            setSwitchError('Failed to add network. Please add localhost network manually in MetaMask (see instructions below).');
          }
        }
      } else if (e?.message) {
        setSwitchError(e.message);
      } else {
        setSwitchError('Failed to switch network. Please check MetaMask and try again.');
      }
      
      // Clear error after 10 seconds
      setTimeout(() => setSwitchError(null), 10000);
    }
  };

  return (
    <div className="bg-white rounded-lg p-4 mb-6 border border-[#e0e0e0]">
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-[#666666]">Network:</span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold ${isWrongNetwork ? 'text-red-600' : 'text-green-600'}`}>
              {networkName}
            </span>
            {isWrongNetwork && (
              <>
                <span className="text-red-600">— Wrong network</span>
                <button
                  onClick={handleSwitchNetwork}
                  disabled={isSwitching}
                  className="px-3 py-1 bg-[#667eea] text-white rounded text-xs hover:bg-[#5568d3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSwitching ? 'Switching...' : 'Switch'}
                </button>
              </>
            )}
          </div>
        </div>
        {actualChainId !== null && actualChainId !== chainId && (
          <div className="text-xs text-yellow-600 mt-1 bg-yellow-50 px-2 py-1 rounded">
            Debug: MetaMask reports Chain {actualChainId}, but Wagmi reports Chain {chainId}. 
            <button 
              onClick={() => window.location.reload()} 
              className="ml-2 text-blue-600 hover:underline"
            >
              Refresh page
            </button>
          </div>
        )}
        {switchError && (
          <div className="text-xs text-red-600 mt-1 bg-red-50 px-2 py-1 rounded">
            {switchError}
            <div className="mt-1 text-[#666666]">
              <strong>Manual setup:</strong> In MetaMask, go to Settings → Networks → Add Network:
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Network Name: <code>Localhost 8545</code></li>
                <li>RPC URL: <code>http://localhost:8545</code></li>
                <li>Chain ID: <code>31337</code></li>
                <li>Currency Symbol: <code>ETH</code></li>
              </ul>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-[#666666]">RPC:</span>
          <span className={`font-semibold ${
            rpcStatus === 'connected' ? 'text-green-600' : 
            rpcStatus === 'failed' ? 'text-red-600' : 
            'text-yellow-600'
          }`}>
            http://localhost:8545 ({rpcStatus === 'connected' ? 'connected' : rpcStatus === 'failed' ? 'failed' : 'checking'})
          </span>
        </div>

        {rpcStatus === 'failed' && (
          <div className="text-xs text-red-600 mt-1">
            Please start Anvil: <code className="bg-red-50 px-1 rounded">make anvil</code>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-[#666666]">PoolRegistry:</span>
          <span className={`font-mono text-xs ${
            contractCode === 'yes' ? 'text-green-600' : 
            contractCode === 'no' ? 'text-red-600' : 
            'text-yellow-600'
          }`}>
            {CONTRACT_ADDRESSES.PoolRegistry.slice(0, 6)}...{CONTRACT_ADDRESSES.PoolRegistry.slice(-4)} 
            {' '}(code: {contractCode === 'yes' ? 'yes' : contractCode === 'no' ? 'no' : 'checking'})
          </span>
        </div>
      </div>
    </div>
  );
}
