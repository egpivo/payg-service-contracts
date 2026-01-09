'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { WalletButton } from '@/components/WalletButton';
import { useAccount } from 'wagmi';
import { ArtIcon, HotelIcon, LockIcon } from '@/components/Icons';
import Link from 'next/link';
import { isMockMode } from '@/config/demoMode';

export default function HomePage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const isDemoConnected = isMockMode ? true : isConnected;

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSelectServices = () => {
    router.push('/select');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#667eea] via-[#764ba2] to-[#667eea]">
      <div className="max-w-7xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-16">
          <div className="text-white">
            <h1 className="text-4xl font-bold mb-2">Service Marketplace</h1>
            <p className="text-white/80">Compose and purchase access to premium services</p>
          </div>
            <WalletButton />
          </div>

        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-5xl font-bold text-white mb-6">
              Access Premium Services
            </h2>
            <p className="text-xl text-white/90 mb-8 leading-relaxed">
              Combine art collections, venue spaces, and security services into a single access package.
              Pay once, access everything.
            </p>
            
            {mounted && !isDemoConnected && (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 mb-8 max-w-2xl mx-auto">
                <p className="text-yellow-800 font-semibold">
                  Please connect your wallet to start selecting services
                </p>
              </div>
            )}

            <button
              onClick={handleSelectServices}
              disabled={mounted && !isDemoConnected}
              className={`px-8 py-4 rounded-lg font-semibold text-lg transition-all shadow-lg ${
                mounted && isDemoConnected
                  ? 'bg-white text-[#667eea] hover:bg-white/90 hover:scale-105'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Select Services →
            </button>
                </div>
                </div>

        {/* Quick Start Section - Only show in local mode */}
        {!isMockMode && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 mb-12 max-w-3xl mx-auto">
            <h3 className="text-xl font-semibold text-white mb-3">Quick Start</h3>
            <p className="text-white/90 text-sm mb-4">
              First time using this demo? You&apos;ll need to deploy the contract once:
            </p>
            <div className="bg-white/20 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-white/90">
                <span className="font-mono bg-white/20 px-2 py-1 rounded">make anvil-free</span>
                <span>→ Start local blockchain</span>
                  </div>
              <div className="flex items-center gap-2 text-white/90">
                <span className="font-mono bg-white/20 px-2 py-1 rounded">make deploy-local</span>
                <span>→ Deploy contract (one-time)</span>
                    </div>
                  </div>
            <p className="text-white/70 text-xs mt-3">
              After deployment, refresh the page and you&apos;re ready to go!
            </p>
                  </div>
                )}

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="mb-4 text-white">
              <ArtIcon className="w-12 h-12" />
                  </div>
            <h3 className="text-xl font-semibold text-white mb-2">Art Collections</h3>
            <p className="text-white/80">
              Access rare art collections and precious artifacts from trusted providers
            </p>
              </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="mb-4 text-white">
              <HotelIcon className="w-12 h-12" />
                    </div>
            <h3 className="text-xl font-semibold text-white mb-2">Venue Spaces</h3>
            <p className="text-white/80">
              Premium hotel spaces and venues in major cities, rented through service providers
            </p>
                </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="mb-4 text-white">
              <LockIcon className="w-12 h-12" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Security Services</h3>
            <p className="text-white/80">
              Professional security services to protect valuable items and ensure safe access
            </p>
                  </div>
                </div>

        {/* How It Works */}
        <div className="mt-20 bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20">
          <h3 className="text-2xl font-semibold text-white mb-6 text-center">How It Works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">
                1
                </div>
              <h4 className="text-lg font-semibold text-white mb-2">Select Services</h4>
              <p className="text-white/80 text-sm">
                Choose from pre-configured packages or customize your own service combination
                    </p>
                  </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">
                2
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Create Package</h4>
              <p className="text-white/80 text-sm">
                Services are bundled into a single access package with automatic revenue distribution
                    </p>
                  </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">
                3
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Purchase & Access</h4>
              <p className="text-white/80 text-sm">
                Pay once and gain access to all selected services for the specified duration
              </p>
            </div>
                  </div>
                </div>
      </div>
    </div>
  );
}
