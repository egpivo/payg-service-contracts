import contracts from '../../contracts.json';
import { isMockMode } from './demoMode';

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
  // In mock mode, use dummy addresses (they won't be used anyway)
  if (isMockMode) {
    return {
      PoolRegistry: '0x1111111111111111111111111111111111111111' as `0x${string}`,
      ArticleRegistry: '0x1111111111111111111111111111111111111111' as `0x${string}`,
      RentalRegistry: '0x2222222222222222222222222222222222222222' as `0x${string}`,
    };
  }
  
  // Default to localhost for development
  const network = contractsConfig.networks.localhost;
  return {
    PoolRegistry: network.contracts.PoolRegistry as `0x${string}`,
    // For demo: Use PoolRegistry itself as the registry (it implements IServiceRegistry)
    // In production, these would be actual deployed contract addresses
    ArticleRegistry: (network.contracts as any).ArticleRegistry as `0x${string}` || (network.contracts as any).PoolRegistry as `0x${string}` || '0x1111111111111111111111111111111111111111' as `0x${string}`,
    RentalRegistry: (network.contracts as any).RentalRegistry as `0x${string}` || (network.contracts as any).PoolRegistry as `0x${string}` || '0x2222222222222222222222222222222222222222' as `0x${string}`,
  };
};

export const CONTRACT_ADDRESSES = getContracts();

// Helper to get registry address based on service ID
// Service IDs 101-199: ArticleRegistry
// Service IDs 201-299: RentalRegistry
// For demo: Use PoolRegistry itself as registry (it implements IServiceRegistry)
export const getRegistryForService = (serviceId: string): `0x${string}` => {
  // For demo: All services are registered in PoolRegistry, so use it as the registry
  // In production, you would use actual ArticleRegistry and RentalRegistry addresses
  return CONTRACT_ADDRESSES.PoolRegistry;
  
  // Production code (commented out for demo):
  // const id = parseInt(serviceId);
  // if (id >= 101 && id < 200) {
  //   return CONTRACT_ADDRESSES.ArticleRegistry;
  // } else if (id >= 201 && id < 300) {
  //   return CONTRACT_ADDRESSES.RentalRegistry;
  // }
  // return CONTRACT_ADDRESSES.PoolRegistry;
};
