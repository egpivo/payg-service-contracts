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
  };
};

export const CONTRACT_ADDRESSES = getContracts();
