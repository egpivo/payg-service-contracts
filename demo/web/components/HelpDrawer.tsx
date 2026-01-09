'use client';

import { useState } from 'react';
import { LightBulbIcon, XIcon } from './Icons';
import { FlowStep } from './FlowStep';

interface HelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpDrawer({ isOpen, onClose }: HelpDrawerProps) {
  if (!isOpen) return null;

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

          {/* Content */}
          <div className="space-y-6">
            {/* Flow Steps */}
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

            {/* Protocol Concepts */}
            <section className="bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-lg p-6 text-white">
              <h3 className="text-lg font-semibold mb-4">Protocol Concepts</h3>
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
            </section>

            {/* Why Pools Exist */}
            <section className="bg-[#f8f9fa] rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Why Pools Exist</h3>
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
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
