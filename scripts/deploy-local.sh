#!/bin/bash

# Deploy PoolRegistry to local Anvil network
# Usage: ./scripts/deploy-local.sh

set -e

echo "=== 部署 PoolRegistry 到本地 Anvil 网络 ==="
echo ""

# Check if Anvil is running
if ! lsof -i :8545 > /dev/null 2>&1; then
    echo "错误: Anvil 未运行！"
    echo "请先运行: make anvil-free"
    exit 1
fi

echo "1. 编译合约..."
forge build --quiet

echo ""
echo "2. 部署 PoolRegistry 合约..."

# Deploy using the first Anvil account (0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266)
DEPLOYER_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

# Deploy contract (--broadcast is needed to actually send the transaction)
DEPLOY_OUTPUT=$(forge create \
    --rpc-url http://localhost:8545 \
    --private-key $DEPLOYER_PRIVATE_KEY \
    --broadcast \
    contracts/composition/pools/PoolRegistry.sol:PoolRegistry 2>&1)

echo "$DEPLOY_OUTPUT"
echo ""

# Extract contract address from output
CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -i "Deployed to:" | awk '{print $3}')

if [ -z "$CONTRACT_ADDRESS" ]; then
    echo "错误: 无法获取合约地址"
    exit 1
fi

echo "3. 合约部署成功！"
echo "   地址: $CONTRACT_ADDRESS"
echo ""

echo "4. 更新 contracts.json..."

# Update contracts.json using Python (more reliable than sed)
python3 << EOF
import json
import sys

contract_address = "$CONTRACT_ADDRESS"

try:
    with open('demo/contracts.json', 'r') as f:
        config = json.load(f)
    
    config['networks']['localhost']['contracts']['PoolRegistry'] = contract_address
    
    with open('demo/contracts.json', 'w') as f:
        json.dump(config, f, indent=2)
    
    print(f"✓ contracts.json 已更新")
    print(f"  PoolRegistry: {contract_address}")
except Exception as e:
    print(f"错误: 无法更新 contracts.json: {e}")
    sys.exit(1)
EOF

echo ""
echo "5. 注册演示服务..."

# Register demo services in PoolRegistry
# Service 101: Rare Art Collection (0.5 ETH)
# Service 201: Luxury Hotel Space (0.33 ETH)  
# Service 202: Premium Security Service (0.17 ETH)

cast send $CONTRACT_ADDRESS \
    "registerService(uint256,uint256)" \
    101 \
    $(cast --to-wei 0.5 ether) \
    --rpc-url http://localhost:8545 \
    --private-key $DEPLOYER_PRIVATE_KEY \
    --broadcast > /dev/null 2>&1

cast send $CONTRACT_ADDRESS \
    "registerService(uint256,uint256)" \
    201 \
    $(cast --to-wei 0.33 ether) \
    --rpc-url http://localhost:8545 \
    --private-key $DEPLOYER_PRIVATE_KEY \
    --broadcast > /dev/null 2>&1

cast send $CONTRACT_ADDRESS \
    "registerService(uint256,uint256)" \
    202 \
    $(cast --to-wei 0.17 ether) \
    --rpc-url http://localhost:8545 \
    --private-key $DEPLOYER_PRIVATE_KEY \
    --broadcast > /dev/null 2>&1

echo "   ✓ 服务 101 (Rare Art Collection) 已注册"
echo "   ✓ 服务 201 (Luxury Hotel Space) 已注册"
echo "   ✓ 服务 202 (Premium Security Service) 已注册"

echo ""
echo "=== 部署完成 ==="
echo ""
echo "下一步:"
echo "1. 刷新 Web UI 页面 (http://localhost:3000)"
echo "2. 重新连接钱包"
echo "3. 点击 'Run Demo Flow' 开始使用"

