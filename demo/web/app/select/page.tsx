'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { WalletButton } from '@/components/WalletButton';
import { useAccount } from 'wagmi';

interface ServiceOption {
  id: string;
  name: string;
  description: string;
  category: 'content' | 'venue' | 'security';
  price: string;
  icon: string;
}

interface PackageOption {
  id: string;
  name: string;
  description: string;
  services: ServiceOption[];
  totalPrice: string;
  duration: string;
  image?: string;
}

// Available services
const AVAILABLE_SERVICES: ServiceOption[] = [
  {
    id: '101',
    name: 'Rare Art Collection',
    description: 'Exclusive access to precious art collections and valuable artifacts',
    category: 'content',
    price: '0.5',
    icon: '🎨',
  },
  {
    id: '102',
    name: 'Historical Documents',
    description: 'Access to rare historical documents and manuscripts',
    category: 'content',
    price: '0.4',
    icon: '📜',
  },
  {
    id: '201',
    name: 'Luxury Hotel Space',
    description: 'Premium hotel spaces in major cities, rented by service providers',
    category: 'venue',
    price: '0.33',
    icon: '🏨',
  },
  {
    id: '202',
    name: 'Premium Security Service',
    description: 'Professional security services for protecting valuable items',
    category: 'security',
    price: '0.17',
    icon: '🔒',
  },
  {
    id: '203',
    name: 'Presentation Services',
    description: 'Professional setup and presentation services',
    category: 'venue',
    price: '0.2',
    icon: '🎭',
  },
];

// Pre-configured packages
const PACKAGE_OPTIONS: PackageOption[] = [
  {
    id: 'gallery-access',
    name: 'Private Gallery Access',
    description: 'Complete package for viewing art collections in premium spaces',
    services: [
      AVAILABLE_SERVICES.find(s => s.id === '101')!,
      AVAILABLE_SERVICES.find(s => s.id === '201')!,
      AVAILABLE_SERVICES.find(s => s.id === '202')!,
    ],
    totalPrice: '1.0',
    duration: '7 days',
  },
  {
    id: 'document-viewing',
    name: 'Historical Document Viewing',
    description: 'Access historical documents in secure, professional settings',
    services: [
      AVAILABLE_SERVICES.find(s => s.id === '102')!,
      AVAILABLE_SERVICES.find(s => s.id === '201')!,
      AVAILABLE_SERVICES.find(s => s.id === '202')!,
    ],
    totalPrice: '0.9',
    duration: '5 days',
  },
];

export default function SelectPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [customServices, setCustomServices] = useState<string[]>([]);
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSelectPackage = (pkgId: string) => {
    setSelectedPackage(pkgId);
    setShowCustom(false);
  };

  const handleToggleService = (serviceId: string) => {
    if (customServices.includes(serviceId)) {
      setCustomServices(customServices.filter(id => id !== serviceId));
    } else {
      setCustomServices([...customServices, serviceId]);
    }
    setSelectedPackage(null);
  };

  const handleProceed = () => {
    let config;
    
    if (selectedPackage) {
      const pkg = PACKAGE_OPTIONS.find(p => p.id === selectedPackage);
      if (pkg) {
        config = {
          type: 'package',
          packageId: pkg.id,
          services: pkg.services.map(s => s.id),
        };
      }
    } else if (customServices.length > 0) {
      config = {
        type: 'custom',
        services: customServices,
      };
    }

    if (config) {
      // Store config in sessionStorage and navigate to checkout
      sessionStorage.setItem('selectedConfig', JSON.stringify(config));
      sessionStorage.setItem('goToCheckout', 'true');
      router.push('/payment');
    }
  };

  const selectedServices = selectedPackage
    ? PACKAGE_OPTIONS.find(p => p.id === selectedPackage)?.services || []
    : customServices.map(id => AVAILABLE_SERVICES.find(s => s.id === id)!).filter(Boolean);

  const canProceed = (selectedPackage || customServices.length > 0) && (mounted ? isConnected : false);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f5f5f5] to-[#e8e8e8] flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-[#666666]">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f5f5] to-[#e8e8e8]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-xl p-6 mb-8 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-[#1a1a1a] mb-2">Select Your Services</h1>
              <p className="text-[#666666]">Choose a package or customize your own service combination</p>
            </div>
            <WalletButton />
          </div>
          <div className="pt-4 border-t border-[#e0e0e0]">
            <Link
              href="/"
              className="text-[#667eea] hover:text-[#5568d3] font-semibold text-sm"
            >
              ← Back to Home
            </Link>
          </div>
        </div>

        {mounted && !isConnected && (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 mb-8 text-center">
            <p className="text-yellow-800 font-semibold">
              Please connect your wallet to proceed with service selection
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Package Options */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-4 text-[#1a1a1a]">Pre-configured Packages</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PACKAGE_OPTIONS.map((pkg) => (
                  <div
                    key={pkg.id}
                    onClick={() => handleSelectPackage(pkg.id)}
                    className={`bg-white rounded-xl p-6 cursor-pointer transition-all border-2 ${
                      selectedPackage === pkg.id
                        ? 'border-[#667eea] shadow-lg scale-105'
                        : 'border-[#e0e0e0] hover:border-[#667eea] hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold text-[#1a1a1a] mb-2">{pkg.name}</h3>
                        <p className="text-sm text-[#666666]">{pkg.description}</p>
                      </div>
                      {selectedPackage === pkg.id && (
                        <div className="bg-[#667eea] text-white rounded-full w-8 h-8 flex items-center justify-center">
                          ✓
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 mb-4">
                      {pkg.services.map((service) => (
                        <div key={service.id} className="flex items-center gap-2 text-sm">
                          <span className="text-xl">{service.icon}</span>
                          <span className="text-[#666666]">{service.name}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-[#e0e0e0]">
                      <div>
                        <span className="text-2xl font-bold text-[#1a1a1a]">{pkg.totalPrice} ETH</span>
                        <span className="text-sm text-[#666666] ml-2">/ {pkg.duration}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Selection */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold text-[#1a1a1a]">Custom Selection</h2>
                <button
                  onClick={() => {
                    setShowCustom(!showCustom);
                    setSelectedPackage(null);
                  }}
                  className="text-[#667eea] hover:text-[#5568d3] font-semibold"
                >
                  {showCustom ? 'Hide' : 'Show'} Custom Options
                </button>
              </div>

              {showCustom && (
                <div className="bg-white rounded-xl p-6 border-2 border-[#e0e0e0]">
                  <div className="space-y-3">
                    {AVAILABLE_SERVICES.map((service) => (
                      <div
                        key={service.id}
                        onClick={() => handleToggleService(service.id)}
                        className={`p-4 rounded-lg cursor-pointer transition-all border-2 ${
                          customServices.includes(service.id)
                            ? 'border-[#667eea] bg-blue-50'
                            : 'border-[#e0e0e0] hover:border-[#667eea]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{service.icon}</span>
                            <div>
                              <div className="font-semibold text-[#1a1a1a]">{service.name}</div>
                              <div className="text-sm text-[#666666]">{service.description}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-semibold text-[#1a1a1a]">{service.price} ETH</span>
                            {customServices.includes(service.id) && (
                              <div className="bg-[#667eea] text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                                ✓
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl p-6 shadow-lg sticky top-8 border-2 border-[#e0e0e0]">
              <h3 className="text-xl font-semibold mb-4 text-[#1a1a1a]">Selection Summary</h3>
              
              {selectedServices.length === 0 ? (
                <p className="text-[#999999] text-sm">No services selected yet</p>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    {selectedServices.map((service) => (
                      <div key={service.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span>{service.icon}</span>
                          <span className="text-[#666666]">{service.name}</span>
                        </div>
                        <span className="font-semibold text-[#1a1a1a]">{service.price} ETH</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="pt-4 border-t border-[#e0e0e0]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-[#1a1a1a]">Total:</span>
                      <span className="text-2xl font-bold text-[#1a1a1a]">
                        {selectedServices.reduce((sum, s) => sum + parseFloat(s.price), 0).toFixed(2)} ETH
                      </span>
                    </div>
                    <p className="text-xs text-[#666666]">Duration: 7 days</p>
                  </div>

                  <button
                    onClick={handleProceed}
                    disabled={!canProceed}
                    className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-all ${
                      canProceed
                        ? 'bg-gradient-to-r from-[#667eea] to-[#764ba2] hover:from-[#5568d3] hover:to-[#6a3d8f] shadow-lg'
                        : 'bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    Proceed to Checkout →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
