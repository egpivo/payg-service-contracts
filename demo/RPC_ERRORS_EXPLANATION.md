# RPC 错误说明

## 你看到的错误

```
RPC request failed:
  Request: EthCall(... data: Some(0x95d89b41) ...)
  Error: Execution error: execution reverted

RPC request failed:
  Request: EthCall(... data: Some(0x313ce567) ...)
  Error: Execution error: execution reverted
```

这些错误是：
- `0x95d89b41` = `symbol()` 函数（ERC20 标准）
- `0x313ce567` = `decimals()` 函数（ERC20 标准）

## 原因

某些库（如 MetaMask、wagmi 或浏览器扩展）可能会自动尝试检测合约是否为 ERC20 代币，通过调用 `symbol()` 和 `decimals()` 函数。

但是 `PoolRegistry` **不是** ERC20 代币合约，所以这些调用会失败（execution reverted）。

## 是否会导致交易挂起？

**不会**。这些错误：
- ✅ 不会阻止交易发送
- ✅ 不会导致交易挂起
- ✅ 只是会在控制台/终端产生噪音

**真正导致交易挂起的原因是**：
- ❌ 服务未注册（已修复）
- ❌ 交易在链上失败但没有正确检测到失败状态

## 修复

虽然这些错误不会导致功能问题，但我们已经：
1. ✅ 配置了 `QueryClient` 减少重试次数（`retry: 1`）
2. ✅ 关闭了窗口焦点时的自动重新查询（`refetchOnWindowFocus: false`）

这样可以：
- 减少错误日志
- 提升性能
- 减少不必要的 RPC 调用

## 总结

这些 RPC 错误是**无害的**，不会影响功能。真正的交易挂起问题已经通过注册服务解决了。





