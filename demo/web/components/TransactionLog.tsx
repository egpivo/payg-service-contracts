'use client';

import { useState } from 'react';
import { formatEther } from 'viem';

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
}

export function TransactionLog({ logs, chainId }: TransactionLogProps) {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

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
                  
                  <p className="text-sm text-[#1a1a1a] mb-2">{log.msg}</p>
                  
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
    </div>
  );
}
