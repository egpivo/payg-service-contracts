# 修复交易挂起问题

## 问题原因

交易挂起并失败 (`status: 0 (failed)`) 是因为：

1. Demo 配置中使用的服务 registry 地址是占位符（`0x1234...`, `0x0987...`）
2. 这些地址上没有部署任何合约
3. `createPool` 函数会检查服务是否存在，如果服务不存在，交易会失败

### 关于 RPC 错误（symbol/decimals）

你可能会在终端看到 `symbol()` 和 `decimals()` 的 RPC 错误。这些错误是**无害的**：
- 某些库会自动检测合约是否为 ERC20 代币
- `PoolRegistry` 不是 ERC20 代币，所以调用会失败
- 这些错误**不会**导致交易挂起，只是会产生噪音

我们已经配置了 `QueryClient` 来减少这些错误的日志。

## 解决方案

### 已完成的修复

1. ✅ **注册了 Demo 服务**：在 `PoolRegistry` 上注册了服务 101, 201, 202
2. ✅ **更新了代码**：`demo/web/app/page.tsx` 现在使用 `CONTRACT_ADDRESSES.PoolRegistry` 作为所有服务的 registry
3. ✅ **更新了部署脚本**：`scripts/deploy-local.sh` 现在会自动注册这些服务

### 为什么使用 PoolRegistry 作为 Registry？

`PoolRegistry` 继承自 `PayAsYouGoBase`，而 `PayAsYouGoBase` 实现了 `IServiceRegistry` 接口。所以 `PoolRegistry` 本身就可以：
- 作为服务注册表（registry）
- 注册服务（通过 `registerService`）
- 作为 pool 的成员服务使用

对于 demo 来说，这是一个完美的解决方案，因为：
- 不需要部署额外的合约
- 所有服务都在同一个合约上
- 简化了 demo 配置

### 下一步操作

1. **重新运行部署脚本**（如果需要）：
   ```bash
   make deploy-local
   ```
   这会自动注册服务 101, 201, 202

2. **刷新浏览器**：
   - 硬刷新页面 (`Cmd+Shift+R` 或 `Ctrl+Shift+R`)
   - 重新连接钱包

3. **重试 Demo Flow**：
   - 点击 "Run Demo Flow"
   - 交易现在应该会成功

### 验证服务是否已注册

你可以运行以下命令验证：

```bash
# 检查服务 101
cast call 0x5FbDB2315678afecb367f032d93F642f64180aa3 "getService(uint256)" 101 --rpc-url http://localhost:8545

# 应该返回类似：
# 0x0000000000000000000000000000000000000000000000000de0b6b3a7640000 (price: 1 ETH)
# 000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266 (provider)
# 0000000000000000000000000000000000000000000000000000000000000001 (exists: true)
```

### 如果交易仍然失败

1. 检查服务是否已注册（使用上面的命令）
2. 检查合约地址是否正确（`demo/contracts.json`）
3. 检查是否在正确的网络（Localhost 8545）
4. 检查 MetaMask 是否连接并切换到正确的网络

