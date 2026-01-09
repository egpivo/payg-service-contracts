import contracts from '../../contracts.json';

// Fix TypeScript type issue
type ContractsConfig = {
  networks: {
    [key: string]: {
      chainId: number;
      rpcUrl: string;
      contracts: {
        PoolRegistry: string;
      };
    };
  };
};

const contractsConfig = contracts as ContractsConfig;

// Get contract addresses from contracts.json
// In production, you might want to select based on chainId
const getContracts = () => {
  // Default to localhost for development
  const network = contractsConfig.networks.localhost;
  return {
    PoolRegistry: network.contracts.PoolRegistry as `0x${string}`,
    // For demo: Use placeholder addresses for different registries
    // In production, these would be actual deployed contract addresses
    ArticleRegistry: (network.contracts as any).ArticleRegistry as `0x${string}` || '0x1111111111111111111111111111111111111111' as `0x${string}`,
    RentalRegistry: (network.contracts as any).RentalRegistry as `0x${string}` || '0x2222222222222222222222222222222222222222' as `0x${string}`,
  };
};

export const CONTRACT_ADDRESSES = getContracts();

// Helper to get registry address based on service ID
// Service IDs 101-199: ArticleRegistry
// Service IDs 201-299: RentalRegistry
export const getRegistryForService = (serviceId: string): `0x${string}` => {
  const id = parseInt(serviceId);
  if (id >= 101 && id < 200) {
    return CONTRACT_ADDRESSES.ArticleRegistry;
  } else if (id >= 201 && id < 300) {
    return CONTRACT_ADDRESSES.RentalRegistry;
  }
  // Default to PoolRegistry for unknown service IDs
  return CONTRACT_ADDRESSES.PoolRegistry;
};
