'use client';

import { CheckIcon } from './Icons';

// Using native Date instead of date-fns to avoid dependency

export type ActivityStatus = 'submitting' | 'pending' | 'confirmed' | 'failed';

export interface ActivityItem {
  id: string;
  action: string;
  status: ActivityStatus;
  txHash?: string;
  blockNumber?: bigint;
  gasUsed?: bigint;
  timestamp: Date;
  error?: string;
}

interface ActivityPanelProps {
  activities: ActivityItem[];
  explorerUrl?: string;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  
  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  return date.toLocaleTimeString();
}

export function ActivityPanel({ activities, explorerUrl }: ActivityPanelProps) {
  if (activities.length === 0) {
    return null;
  }

  const getStatusBadge = (status: ActivityStatus) => {
    switch (status) {
      case 'submitting':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Submitting...
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Pending...
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckIcon className="w-3 h-3 mr-1" />
            Confirmed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Failed
          </span>
        );
    }
  };

  const formatHash = (hash?: string) => {
    if (!hash) return '-';
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
      <h3 className="text-xl font-semibold mb-4">Activity Timeline</h3>
      <div className="space-y-4">
        {activities.map((activity, index) => (
          <div
            key={activity.id}
            className="border-l-4 border-[#e0e0e0] pl-4 pb-4 last:pb-0 last:border-l-0"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-[#1a1a1a]">{activity.action}</span>
                  {getStatusBadge(activity.status)}
                </div>
                <div className="text-sm text-[#666666] space-y-1">
                  {activity.txHash && (
                    <div className="flex items-center gap-2">
                      <span>Tx:</span>
                      <code className="bg-[#f5f5f5] px-2 py-0.5 rounded text-xs font-mono">
                        {formatHash(activity.txHash)}
                      </code>
                      <button
                        onClick={() => copyToClipboard(activity.txHash!)}
                        className="text-[#667eea] hover:text-[#5568d3] text-xs"
                        title="Copy full hash"
                      >
                        Copy
                      </button>
                      {explorerUrl && activity.txHash && (
                        <a
                          href={`${explorerUrl}/tx/${activity.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#667eea] hover:text-[#5568d3] text-xs"
                        >
                          View in Explorer
                        </a>
                      )}
                    </div>
                  )}
                  {activity.blockNumber !== undefined && (
                    <div>
                      Block: <span className="font-mono">{String(activity.blockNumber)}</span>
                    </div>
                  )}
                  {activity.gasUsed !== undefined && (
                    <div>
                      Gas Used: <span className="font-mono">{String(activity.gasUsed)}</span>
                    </div>
                  )}
                  {activity.error && (
                    <div className="text-red-600 text-xs mt-1">{activity.error}</div>
                  )}
                </div>
              </div>
              <div className="text-xs text-[#999999] ml-4">
                {formatTimeAgo(activity.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

