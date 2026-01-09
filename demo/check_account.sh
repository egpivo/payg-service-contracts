#!/bin/bash

echo "=== 诊断 Anvil 连接问题 ==="
echo ""

# 检查 Anvil 是否运行
echo "1. 检查 Anvil 是否运行..."
if lsof -i :8545 > /dev/null 2>&1; then
    echo "   ✓ Anvil 正在运行（端口 8545 被占用）"
else
    echo "   ✗ Anvil 未运行！请运行: make anvil-free"
    exit 1
fi

echo ""
echo "2. 检查标准账户信息..."
echo ""
echo "账户 1（推荐使用）："
echo "  地址: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
echo "  私钥: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
echo ""

# 检查余额
echo "3. 检查账户余额..."
balance=$(curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","latest"],"id":1}' \
  http://localhost:8545 | python3 -c "import sys, json; data=json.load(sys.stdin); balance_wei=int(data['result'],16); print(balance_wei/1e18)" 2>/dev/null)

if [ ! -z "$balance" ]; then
    echo "   ✓ 账户 1 在 Anvil 中的余额: $balance ETH"
else
    echo "   ✗ 无法连接到 Anvil"
    exit 1
fi

echo ""
echo "4. 检查 Chain ID..."
chain_id=$(curl -s -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  http://localhost:8545 | python3 -c "import sys, json; data=json.load(sys.stdin); print(int(data['result'],16))" 2>/dev/null)

if [ ! -z "$chain_id" ]; then
    echo "   ✓ Chain ID: $chain_id (应该是 31337)"
    if [ "$chain_id" != "31337" ]; then
        echo "   ⚠ 警告：Chain ID 不是 31337！"
    fi
else
    echo "   ✗ 无法获取 Chain ID"
fi

echo ""
echo "=== 下一步操作 ==="
echo ""
echo "在 MetaMask 中："
echo "1. 查看你导入账户的地址（点击账户名称）"
echo "2. 如果地址不是 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266，说明私钥不对"
echo "3. 删除账户并重新导入正确的私钥"
echo ""
echo "如果地址正确但余额还是 0："
echo "1. 在 MetaMask 中切换到其他网络（如 Mainnet）"
echo "2. 再切换回 'Localhost 8545'"
echo "3. 关闭并重新打开 MetaMask 扩展"
echo "4. 刷新浏览器页面（Cmd+Shift+R 或 Ctrl+Shift+R）"





