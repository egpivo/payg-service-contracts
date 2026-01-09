# 快速修复：交易挂起问题

## 立即解决方案

如果交易一直显示 "Pending..."，请尝试：

### 方法 1：刷新页面（推荐）

1. **硬刷新浏览器**：`Cmd+Shift+R` (Mac) 或 `Ctrl+Shift+R` (Windows)
2. 这会清除所有前端状态
3. 重新连接钱包
4. 重试 Demo Flow

### 方法 2：检查 MetaMask

1. 打开 MetaMask
2. 查看 "Activity" 标签
3. 检查是否有待确认的交易
   - 如果有，确认或拒绝它
   - 如果没有，说明交易可能已经被取消

### 方法 3：使用重置按钮

如果你在 "Creating Pool" 阶段，页面底部应该有一个 "Cancel / Reset" 链接：
1. 点击 "Cancel / Reset"
2. 这会重置 demo 状态
3. 重新点击 "Run Demo Flow"

### 方法 4：清除浏览器缓存

1. 打开开发者工具（F12）
2. 在 Console 中输入：
   ```javascript
   localStorage.clear()
   sessionStorage.clear()
   location.reload()
   ```

## 常见原因

交易挂起通常是因为：

1. **用户在 MetaMask 中取消了交易确认**
   - MetaMask 弹出确认窗口
   - 用户点击了 "Reject" 或关闭了窗口
   - 但前端状态没有更新

2. **交易实际上失败了但没有被检测到**
   - 服务未注册（已修复）
   - 合约调用失败
   - 但错误没有被正确处理

3. **网络问题**
   - Anvil 节点停止响应
   - 网络连接问题

## 验证步骤

1. **检查 Anvil 是否运行**：
   ```bash
   lsof -i :8545
   ```

2. **检查合约是否部署**：
   ```bash
   cat demo/contracts.json
   # 确认 PoolRegistry 地址不是 0x0000...
   ```

3. **检查服务是否注册**：
   ```bash
   cast call 0x5FbDB2315678afecb367f032d93F642f64180aa3 "getService(uint256)" 101 --rpc-url http://localhost:8545
   # 应该返回非零值
   ```

## 预防措施

我们已经添加了：
- ✅ 错误处理（`isCreateError`, `isPurchaseError`）
- ✅ 重置按钮（在创建过程中）
- ✅ 活动状态跟踪

如果问题持续，请检查：
1. Anvil 是否正在运行
2. 合约是否已部署
3. 服务是否已注册
4. MetaMask 是否连接到正确的网络（Localhost 8545）





