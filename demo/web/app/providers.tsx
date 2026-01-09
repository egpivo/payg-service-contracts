'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet, sepolia, localhost } from 'wagmi/chains';
import { injected, metaMask, walletConnect } from 'wagmi/connectors';
import { useState } from 'react';
import { isMockMode } from '@/config/demoMode';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

export const config = createConfig({
  chains: [localhost, sepolia, mainnet],
  connectors: isMockMode ? [] : [
    injected(),
    metaMask(),
    // walletConnect({ projectId }), // Uncomment if you have WalletConnect project ID
  ],
  transports: {
    [localhost.id]: http('http://localhost:8545'),
    [sepolia.id]: http(),
    [mainnet.id]: http(),
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Reduce retries for failed queries (like ERC20 symbol/decimals on non-token contracts)
        retry: 1,
        // Don't refetch on window focus for local development
        refetchOnWindowFocus: false,
        // Faster updates for local development
        staleTime: 1000,
        // Disable automatic refetching interval
        refetchInterval: false,
      },
      mutations: {
        // For localhost, retry more aggressively
        retry: 2,
        retryDelay: 500,
      },
    },
  }));

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
