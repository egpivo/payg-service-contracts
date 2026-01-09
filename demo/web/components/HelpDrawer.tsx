'use client';

import { useState } from 'react';
import { LightBulbIcon, XIcon } from './Icons';
import { FlowStep } from './FlowStep';

interface HelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  transactionState?: 'intro' | 'creating' | 'created' | 'purchasing' | 'result';
}

export function HelpDrawer({ isOpen, onClose, transactionState }: HelpDrawerProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['flow']));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  if (!isOpen) return null;

  const isFlowComplete = transactionState === 'result';

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <LightBulbIcon className="w-6 h-6 text-[#667eea]" />
              <h2 className="text-2xl font-bold">How It Works</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close"
            >
              <XIcon className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Success Tip - Show when transaction is complete */}
          {isFlowComplete && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="text-sm font-semibold text-green-800 mb-2">✓ Transaction Complete!</h3>
              <p className="text-xs text-green-700">
                Revenue has been automatically distributed to all providers. Scroll down to see the detailed Money Flow diagram.
              </p>
            </div>
          )}

          {/* Content */}
          <div className="space-y-4">
            {/* Flow Steps - Always visible */}
            <section>
              <h3 className="text-lg font-semibold mb-4">Process Flow</h3>
              <div className="space-y-4">
                <FlowStep 
                  number={1} 
                  title="Create Pool" 
                  description="This creates a smart contract 'package' that bundles your selected providers"
                />
                <FlowStep 
                  number={2} 
                  title="Purchase Package" 
                  description="Buy access to all services in the pool with a single payment"
                />
                <FlowStep 
                  number={3} 
                  title="Access Services" 
                  description="Use all services included in your package"
                />
                <FlowStep 
                  number={4} 
                  title="Auto Settlement" 
                  description="Revenue splits automatically to providers based on their shares"
                  showArrow={false}
                />
              </div>
            </section>

            {/* Protocol Concepts - Collapsible */}
            <section className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('concepts')}
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <h3 className="text-lg font-semibold">Protocol Concepts</h3>
                <svg
                  className={`w-5 h-5 text-gray-600 transform transition-transform ${
                    expandedSections.has('concepts') ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {expandedSections.has('concepts') && (
                <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] p-6 text-white">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/15 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                      <p className="opacity-75 text-xs mb-1">Art Collection</p>
                      <p className="font-semibold">= Service</p>
                    </div>
                    <div className="bg-white/15 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                      <p className="opacity-75 text-xs mb-1">Hotel Space</p>
                      <p className="font-semibold">= Service</p>
                    </div>
                    <div className="bg-white/15 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                      <p className="opacity-75 text-xs mb-1">Access Package</p>
                      <p className="font-semibold">= Pool</p>
                    </div>
                    <div className="bg-white/15 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                      <p className="opacity-75 text-xs mb-1">Providers</p>
                      <p className="font-semibold">= Recipients</p>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Why Pools Exist - Collapsible */}
            <section className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('why')}
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <h3 className="text-lg font-semibold">Why Pools Exist</h3>
                <svg
                  className={`w-5 h-5 text-gray-600 transform transition-transform ${
                    expandedSections.has('why') ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {expandedSections.has('why') && (
                <div className="p-6 bg-[#f8f9fa]">
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                      <span className="text-[#667eea] font-bold mt-1">•</span>
                      <div>
                        <strong>Single Payment:</strong> Pay once for multiple services instead of separate transactions
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-[#667eea] font-bold mt-1">•</span>
                      <div>
                        <strong>Auto Settlement:</strong> Revenue automatically splits to providers based on shares
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-[#667eea] font-bold mt-1">•</span>
                      <div>
                        <strong>Lower Fees:</strong> Bundled services reduce transaction overhead
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-[#667eea] font-bold mt-1">•</span>
                      <div>
                        <strong>Simplified Access:</strong> One purchase grants access to all included services
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
