'use client';

import { useState, useEffect } from 'react';
import { formatEther, isAddress } from 'viem';

export type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'tx';

export interface TransactionLogEntry {
  time: Date;
  level: LogLevel;
  msg: string;
  txHash?: string;
  status?: 'pending' | 'confirmed' | 'reverted';
  gasUsed?: bigint;
  blockNumber?: bigint;
  poolState?: {
    exists: boolean;
    members: number;
    totalShares: bigint;
  };
}

interface TransactionLogProps {
  logs: TransactionLogEntry[];
  chainId?: number;
  onAddressClick?: (address: string) => void;
}

interface AddressBalanceModalProps {
  address: string;
  onClose: () => void;
  chainId?: number;
}

// Address Balance Modal Component
function AddressBalanceModal({ address, onClose, chainId }: AddressBalanceModalProps) {
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real implementation, you would fetch the balance from the blockchain
    // For now, we'll simulate it
    const timer = setTimeout(() => {
      setBalance('0.0'); // Placeholder
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [address, chainId]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl p-6 shadow-2xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#1a1a1a]">Contract Address</h3>
          <button
            onClick={onClose}
            className="text-[#666666] hover:text-[#1a1a1a] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <div className="text-sm text-[#666666] mb-1">Address:</div>
            <div className="font-mono text-sm bg-[#f5f5f5] p-2 rounded border border-[#e0e0e0] break-all">
              {address}
            </div>
          </div>
          <div>
            <div className="text-sm text-[#666666] mb-1">Balance:</div>
            <div className="font-mono text-lg font-semibold text-[#1a1a1a]">
              {loading ? 'Loading...' : `${balance} ETH`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TransactionLog({ logs, chainId, onAddressClick }: TransactionLogProps) {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);

  // Show last 20 logs
  const displayLogs = logs.slice(-20);

  if (displayLogs.length === 0) {
    return null;
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
    });
  };

  const getStatusConfig = (status?: string, level?: LogLevel) => {
    if (status === 'confirmed') {
      return {
        color: 'bg-green-500',
        text: 'Confirmed',
        textColor: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
      };
    }
    if (status === 'pending') {
      return {
        color: 'bg-yellow-500 animate-pulse',
        text: 'Pending',
        textColor: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
      };
    }
    if (status === 'reverted') {
      return {
        color: 'bg-red-500',
        text: 'Failed',
        textColor: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
      };
    }
    if (level === 'success') {
      return {
        color: 'bg-green-500',
        text: 'Success',
        textColor: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
      };
    }
    if (level === 'error') {
      return {
        color: 'bg-red-500',
        text: 'Error',
        textColor: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
      };
    }
    return {
      color: 'bg-gray-400',
      text: 'Info',
      textColor: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
    };
  };

  const getExplorerUrl = (hash: string) => {
    if (chainId === 31337 || chainId === 1337) {
      // Localhost - no explorer
      return null;
    }
    if (chainId === 1) {
      return `https://etherscan.io/tx/${hash}`;
    }
    if (chainId === 11155111) {
      return `https://sepolia.etherscan.io/tx/${hash}`;
    }
    // Default to Etherscan
    return `https://etherscan.io/tx/${hash}`;
  };

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const formatHash = (hash: string) => {
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  // Parse log message for syntax highlighting
  const parseLogMessage = (msg: string) => {
    const parts: Array<{ text: string; type: 'event' | 'address' | 'number' | 'text' }> = [];
    const eventPattern = /(PoolCreated|Paid|AccessGranted|SettlementComplete)/gi;
    const addressPattern = /0x[a-fA-F0-9]{40}/g;
    const numberPattern = /\b\d+\.?\d*\s*(ETH|wei|gwei)?\b/gi;

    let lastIndex = 0;
    const matches: Array<{ index: number; length: number; type: 'event' | 'address' | 'number' }> = [];

    // Find all matches
    let match;
    while ((match = eventPattern.exec(msg)) !== null) {
      matches.push({ index: match.index, length: match[0].length, type: 'event' });
    }
    while ((match = addressPattern.exec(msg)) !== null) {
      matches.push({ index: match.index, length: match[0].length, type: 'address' });
    }
    while ((match = numberPattern.exec(msg)) !== null) {
      matches.push({ index: match.index, length: match[0].length, type: 'number' });
    }

    // Sort matches by index
    matches.sort((a, b) => a.index - b.index);

    // Build parts
    matches.forEach((m) => {
      if (m.index > lastIndex) {
        parts.push({ text: msg.slice(lastIndex, m.index), type: 'text' });
      }
      parts.push({ text: msg.slice(m.index, m.index + m.length), type: m.type });
      lastIndex = m.index + m.length;
    });

    if (lastIndex < msg.length) {
      parts.push({ text: msg.slice(lastIndex), type: 'text' });
    }

    return parts.length > 0 ? parts : [{ text: msg, type: 'text' }];
  };

  const handleAddressClick = (address: string) => {
    if (onAddressClick) {
      onAddressClick(address);
    } else {
      setSelectedAddress(address);
    }
  };

  const getSyntaxColor = (type: string) => {
    switch (type) {
      case 'event':
        return 'text-purple-600 font-semibold';
      case 'address':
        return 'text-blue-600 font-mono cursor-pointer hover:underline';
      case 'number':
        return 'text-green-600 font-semibold';
      default:
        return 'text-[#1a1a1a]';
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-white/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#1a1a1a]">Transaction Activity</h3>
        <span className="text-xs text-[#666666] bg-[#f5f5f5] px-3 py-1 rounded-full">
          {displayLogs.length} {displayLogs.length === 1 ? 'transaction' : 'transactions'}
        </span>
      </div>
      
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {displayLogs.map((log, index) => {
          const statusConfig = getStatusConfig(log.status, log.level);
          
          return (
            <div
              key={index}
              className={`${statusConfig.bgColor} ${statusConfig.borderColor} border rounded-lg p-4 transition-all hover:shadow-md`}
            >
              <div className="flex items-start gap-3">
                {/* Status Indicator */}
                <div className="flex-shrink-0 mt-0.5">
                  <div className={`w-3 h-3 ${statusConfig.color} rounded-full`} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-sm font-medium ${statusConfig.textColor}`}>
                      {statusConfig.text}
                    </span>
                    <span className="text-xs text-[#666666]">
                      {formatTime(log.time)}
                    </span>
                  </div>
                  
                  {/* Syntax-highlighted message */}
                  <div className="text-sm mb-2 font-mono bg-[#f8f9fa] p-3 rounded border border-[#e0e0e0]">
                    {parseLogMessage(log.msg).map((part, partIndex) => {
                      if (part.type === 'address' && isAddress(part.text)) {
                        return (
                          <span
                            key={partIndex}
                            className={getSyntaxColor(part.type)}
                            onClick={() => handleAddressClick(part.text)}
                            title="Click to view balance"
                          >
                            {part.text}
                          </span>
                        );
                      }
                      return (
                        <span key={partIndex} className={getSyntaxColor(part.type)}>
                          {part.text}
                        </span>
                      );
                    })}
                  </div>
                  
                  {log.txHash && (
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      <div className="flex items-center gap-2 bg-white rounded px-2 py-1 border border-[#e0e0e0]">
                        <span className="text-xs font-mono text-[#666666]">
                          {formatHash(log.txHash)}
                        </span>
                        <button
                          onClick={() => copyHash(log.txHash!)}
                          className="text-[#667eea] hover:text-[#5568d3] transition-colors"
                          title="Copy transaction hash"
                        >
                          {copiedHash === log.txHash ? (
                            <span className="text-xs">✓</span>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                        {getExplorerUrl(log.txHash) && (
                          <a
                            href={getExplorerUrl(log.txHash)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#667eea] hover:text-[#5568d3] transition-colors"
                            title="View on blockchain explorer"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                      
                      {log.blockNumber && (
                        <span className="text-xs text-[#666666] bg-white px-2 py-1 rounded border border-[#e0e0e0]">
                          Block #{String(log.blockNumber)}
                        </span>
                      )}
                      
                      {log.gasUsed && (
                        <span className="text-xs text-[#666666] bg-white px-2 py-1 rounded border border-[#e0e0e0]">
                          Gas: {String(log.gasUsed)}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {log.poolState && (
                    <div className="mt-2 text-xs text-[#666666] bg-white/50 rounded px-2 py-1">
                      Pool: exists={String(log.poolState.exists)}, 
                      members={log.poolState.members}, 
                      shares={String(log.poolState.totalShares)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Address Balance Modal */}
      {selectedAddress && (
        <AddressBalanceModal
          address={selectedAddress}
          onClose={() => setSelectedAddress(null)}
          chainId={chainId}
        />
      )}
    </div>
  );
}
