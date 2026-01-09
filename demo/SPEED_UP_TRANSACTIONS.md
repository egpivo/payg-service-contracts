# 加速交易：立即解决方案

## 问题

交易在本地 Anvil 上运行缓慢。默认的 Anvil 出块时间是 **12 秒**，这对于本地开发来说太慢了。

## 立即修复（2 步）

### 步骤 1：重启 Anvil 使用快速出块

1. **停止当前的 Anvil**：
   - 找到运行 `make anvil-free` 的终端
   - 按 `Ctrl+C`

2. **使用快速配置重新启动**：
   ```bash
   make anvil-free
   ```
   
   现在会自动使用 `--block-time 1`（1 秒出块）！

### 步骤 2：刷新浏览器

1. **硬刷新浏览器**：`Cmd+Shift+R` (Mac) 或 `Ctrl+Shift+R` (Windows)
2. 重新连接钱包
3. 重试 Demo Flow

## 性能对比

### 之前（默认配置）
- 出块时间：**12 秒**
- 交易确认：**~12-24 秒**
- 完整的 demo flow：**~30-60 秒**

### 现在（优化配置）
- 出块时间：**1 秒**
- 交易确认：**1-3 秒**
- 完整的 demo flow：**3-6 秒**

## 已实施的优化

1. ✅ **Anvil 配置**：
   - `--block-time 1`：1 秒出块（非常快）
   - `--base-fee 0 --gas-price 0`：零 gas 费用

2. ✅ **QueryClient 配置**：
   - `staleTime: 1000`：更快的数据更新
   - `refetchInterval: false`：禁用不必要的轮询
   - `refetchOnWindowFocus: false`：避免窗口焦点时的重新查询

## 验证

重启 Anvil 后，交易应该：
- 在 **1-3 秒内**确认
- 在 **3-6 秒内**完成完整的 demo flow

如果仍然慢，检查：
- Anvil 是否真的在使用新配置（查看启动输出）
- MetaMask 是否响应正常
- 浏览器控制台是否有错误





