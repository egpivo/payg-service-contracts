import contracts from '../../contracts.json';
import { isMockMode } from './demoMode';

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

const getContracts = () => {
  if (isMockMode) {
    return {
      PoolRegistry: '0x1111111111111111111111111111111111111111' as `0x${string}`,
      ArticleRegistry: '0x1111111111111111111111111111111111111111' as `0x${string}`,
      RentalRegistry: '0x2222222222222222222222222222222222222222' as `0x${string}`,
    };
  }
  
  const network = contractsConfig.networks.localhost;
  return {
    PoolRegistry: network.contracts.PoolRegistry as `0x${string}`,
    ArticleRegistry: (network.contracts as any).ArticleRegistry as `0x${string}` || (network.contracts as any).PoolRegistry as `0x${string}` || '0x1111111111111111111111111111111111111111' as `0x${string}`,
    RentalRegistry: (network.contracts as any).RentalRegistry as `0x${string}` || (network.contracts as any).PoolRegistry as `0x${string}` || '0x2222222222222222222222222222222222222222' as `0x${string}`,
  };
};

export const CONTRACT_ADDRESSES = getContracts();

export const getRegistryForService = (serviceId: string): `0x${string}` => {
  return CONTRACT_ADDRESSES.PoolRegistry;
};
