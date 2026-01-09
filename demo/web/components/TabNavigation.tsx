'use client';

import { useState } from 'react';

type Tab = 'checkout' | 'help';

interface TabNavigationProps {
  checkout: React.ReactNode;
  help: React.ReactNode;
}

export function TabNavigation({ checkout, help }: TabNavigationProps) {
  const [activeTab, setActiveTab] = useState<Tab>('checkout');

  return (
    <div>
      {/* Tab Buttons */}
      <div className="flex gap-2 mb-6 border-b border-[#e0e0e0]">
        <button
          onClick={() => setActiveTab('checkout')}
          className={`px-6 py-3 font-semibold text-lg transition-colors ${
            activeTab === 'checkout'
              ? 'text-[#667eea] border-b-2 border-[#667eea]'
              : 'text-[#666666] hover:text-[#333333]'
          }`}
        >
          Checkout
        </button>
        <button
          onClick={() => setActiveTab('help')}
          className={`px-6 py-3 font-semibold text-lg transition-colors ${
            activeTab === 'help'
              ? 'text-[#667eea] border-b-2 border-[#667eea]'
              : 'text-[#666666] hover:text-[#333333]'
          }`}
        >
          Help
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'checkout' && checkout}
        {activeTab === 'help' && help}
      </div>
    </div>
  );
}

