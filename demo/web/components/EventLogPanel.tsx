'use client';

import React, { useState } from 'react';
import { decodeEventLog, Abi } from 'viem';
import PoolRegistryABI from '@/abis/PoolRegistryABI.json';
import { SparklesIcon, MoneyIcon, ClipboardIcon } from './Icons';

export interface EventLog {
  action: 'CreatePool' | 'PurchasePool';
  txHash: string;
  blockNumber?: bigint;
  events: {
    name: string;
    args: Record<string, any>;
  }[];
}

interface EventLogPanelProps {
  logs: EventLog[];
  explorerUrl?: string;
}

export function EventLogPanel({ logs, explorerUrl }: EventLogPanelProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (logs.length === 0) {
    return null;
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatAmount = (amount: bigint | string) => {
    const num = typeof amount === 'bigint' ? Number(amount) : parseFloat(String(amount));
    return (num / 1e18).toFixed(4);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'CreatePool':
        return <SparklesIcon className="w-5 h-5" />;
      case 'PurchasePool':
        return <MoneyIcon className="w-5 h-5" />;
      default:
        return <ClipboardIcon className="w-5 h-5" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CreatePool':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'PurchasePool':
        return 'bg-green-50 border-green-200 text-green-700';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  const getEventSummary = (events: { name: string; args: Record<string, any> }[]) => {
    const summaries: string[] = [];
    
    events.forEach(event => {
    switch (event.name) {
      case 'PoolCreated':
          summaries.push(`Pool #${event.args.poolId} created`);
          break;
        case 'PoolPurchased':
          summaries.push(`${formatAmount(event.args.required)} ETH purchased`);
          break;
      case 'MemberAdded':
        const serviceNames: Record<string, string> = {
            '101': 'Rare Art Collection',
            '201': 'Luxury Hotel Space',
            '202': 'Premium Security',
        };
        const serviceIdStr = String(event.args.serviceId);
        const serviceName = serviceNames[serviceIdStr] || `Service #${serviceIdStr}`;
          summaries.push(`${serviceName} added (${event.args.shares} shares)`);
          break;
      }
    });

    return summaries.join(', ');
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold">Transaction History</h3>
        <span className="text-sm text-[#666666] bg-[#f5f5f5] px-3 py-1 rounded-full">
          {logs.length} {logs.length === 1 ? 'transaction' : 'transactions'}
        </span>
      </div>
      
      <div className="space-y-2">
        {logs.map((log, index) => {
          const isExpanded = expandedIndex === index;
          const actionColor = getActionColor(log.action);
          
          return (
            <div
              key={index}
              className={`border rounded-lg overflow-hidden transition-all duration-200 hover:shadow-md ${actionColor}`}
            >
              <button
                onClick={() => setExpandedIndex(isExpanded ? null : index)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-opacity-50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-2xl flex-shrink-0">{getActionIcon(log.action)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm mb-1">{log.action}</div>
                    <div className="text-xs opacity-75 truncate">
                      {getEventSummary(log.events)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <div className="text-right text-xs opacity-75">
                    <div className="font-mono">{log.txHash.slice(0, 8)}...{log.txHash.slice(-6)}</div>
                    {log.blockNumber !== undefined && (
                      <div className="mt-0.5">Block #{String(log.blockNumber)}</div>
                    )}
                  </div>
                  <svg
                    className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              
              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-current border-opacity-20 bg-white bg-opacity-50">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs">
                      <code className="bg-[#f5f5f5] px-2 py-1 rounded font-mono text-[#1a1a1a]">
                        {log.txHash}
                    </code>
                    {explorerUrl && (
                      <a
                        href={`${explorerUrl}/tx/${log.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                          className="text-[#667eea] hover:text-[#5568d3] underline"
                      >
                          View in Explorer →
                      </a>
                    )}
                  </div>
                    
                    {log.events.length > 0 && (
                    <div>
                        <div className="text-xs font-semibold text-[#666666] mb-2">Events ({log.events.length}):</div>
                        <div className="space-y-2">
                          {log.events.map((event, eventIndex) => (
                            <div key={eventIndex} className="bg-[#f9fafb] rounded p-3 border border-[#e0e0e0]">
                              <div className="text-sm font-semibold text-[#1a1a1a] mb-2">{event.name}</div>
                              <div className="text-xs text-[#666666] space-y-1">
                                {event.name === 'PoolCreated' && (
                                  <>
                                    <div className="flex justify-between">
                                      <span>Pool ID:</span>
                                      <span className="font-mono font-semibold">#{String(event.args.poolId)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Price:</span>
                                      <span className="font-semibold">{formatAmount(event.args.price)} ETH</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Members:</span>
                                      <span className="font-semibold">{String(event.args.memberCount)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Operator:</span>
                                      <span className="font-mono">{formatAddress(event.args.operator)}</span>
                                    </div>
                                  </>
                                )}
                                {event.name === 'MemberAdded' && (
                                  <>
                                    {(() => {
                                      const serviceNames: Record<string, string> = {
                                        '101': 'Rare Art Collection #101',
                                        '201': 'Luxury Hotel Space #201',
                                        '202': 'Premium Security #202',
                                      };
                                      const serviceIdStr = String(event.args.serviceId);
                                      const serviceName = serviceNames[serviceIdStr] || `Service #${serviceIdStr}`;
                                      return (
                                        <>
                                          <div className="flex justify-between">
                                            <span>Service:</span>
                                            <span className="font-semibold">{serviceName}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>Shares:</span>
                                            <span className="font-semibold">{String(event.args.shares)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>Registry:</span>
                                            <span className="font-mono">{formatAddress(event.args.registry)}</span>
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </>
                                )}
                                {event.name === 'PoolPurchased' && (
                                  <>
                                    <div className="flex justify-between">
                                      <span>Pool ID:</span>
                                      <span className="font-mono font-semibold">#{String(event.args.poolId)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Amount:</span>
                                      <span className="font-semibold">{formatAmount(event.args.required)} ETH</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Buyer:</span>
                                      <span className="font-mono">{formatAddress(event.args.buyer)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Expires:</span>
                                      <span className="font-mono text-xs">
                                        {new Date(Number(event.args.expiry) * 1000).toLocaleString()}
                                      </span>
                                    </div>
                                  </>
                                )}
                                {event.name === 'Withdrawn' && (
                                  <>
                                    <div className="flex justify-between">
                                      <span>Provider:</span>
                                      <span className="font-mono">{formatAddress(event.args.provider)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Amount:</span>
                                      <span className="font-semibold">{formatAmount(event.args.amount)} ETH</span>
                    </div>
                                  </>
                                )}
                                {!['PoolCreated', 'MemberAdded', 'PoolPurchased', 'Withdrawn'].includes(event.name) && (
                                  <pre className="text-xs font-mono bg-white p-2 rounded overflow-auto">
                                    {JSON.stringify(event.args, null, 2)}
                                  </pre>
                  )}
                </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}




