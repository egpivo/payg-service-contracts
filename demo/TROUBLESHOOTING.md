# 故障排除指南：账户余额为 0

## 问题：导入账户后余额仍然显示为 0 ETH

### 快速检查步骤

1. **确认 Anvil 正在运行**
   ```bash
   # 检查端口是否被占用
   lsof -i :8545
   
   # 如果 Anvil 没有运行，启动它
   make anvil-free
   ```

2. **确认网络连接正确**
   - MetaMask 应显示 "Localhost 8545"
   - Chain ID 应为 31337

3. **使用正确的私钥**

   **标准 Anvil 测试账户（推荐使用第一个）**：
   
   账户 1：
   - **地址**：`0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
   - **私钥**：`0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
   - **余额**：10000 ETH
   
   账户 2：
   - **地址**：`0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
   - **私钥**：`0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`
   - **余额**：10000 ETH

4. **验证账户地址是否匹配**
   
   导入私钥后，在 MetaMask 中查看账户地址：
   - 点击账户名称
   - 查看账户地址
   - 如果使用第一个账户，地址应该是 `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
   - 如果地址不匹配，说明私钥错误

### 解决方案

#### 方案 1：刷新 MetaMask（最简单）

1. 在 MetaMask 中切换到其他网络（如 Mainnet）
2. 再切换回 "Localhost 8545"
3. 余额应该会更新

或者：

1. 关闭 MetaMask 扩展
2. 重新打开 MetaMask
3. 切换到 "Localhost 8545" 网络

#### 方案 2：重新导入账户（如果地址不匹配）

1. 在 MetaMask 中：
   - 点击账户名称（右上角）
   - 选择 "Account details" 或 "账户详情"
   - 点击 "Remove Account" 或 "移除账户"
   - 确认删除

2. 重新导入账户：
   - 点击账户图标
   - 选择 "Import Account" 或 "导入账户"
   - 选择 "Private Key" 或 "私钥"
   - **仔细复制粘贴私钥**：`0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
   - 点击 "Import"

3. 验证地址：
   - 导入后查看账户地址
   - 应该是 `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

#### 方案 3：检查 Anvil 输出

1. 查看运行 `make anvil-free` 的终端
2. 找到 "Private Keys" 部分
3. 使用第一个私钥（索引 0）
4. 确保私钥完整（以 `0x` 开头，64 个十六进制字符）

#### 方案 4：重启 Anvil

如果以上都不行：

1. 停止当前的 Anvil（在终端中按 Ctrl+C）
2. 重新启动：
   ```bash
   make anvil-free
   ```
3. 使用新启动时显示的私钥重新导入账户

### 验证余额的方法

使用命令行验证账户余额：

```bash
# 检查账户 1 的余额
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","latest"],"id":1}' \
  http://localhost:8545
```

如果返回的余额不是 `0x0`，说明账户在 Anvil 中有余额，问题在 MetaMask。

### 常见错误

1. **错误**：复制了地址而不是私钥
   - **解决**：使用私钥（以 `0x` 开头的 66 个字符），不是地址（以 `0x` 开头的 42 个字符）

2. **错误**：私钥不完整
   - **解决**：确保复制完整的私钥，包括 `0x` 前缀

3. **错误**：导入了其他网络的账户
   - **解决**：确保使用的是当前运行的 Anvil 实例显示的私钥

4. **错误**：MetaMask 连接到错误的网络
   - **解决**：确认网络是 "Localhost 8545"，Chain ID 是 31337

### 如果仍然无法解决

1. 完全重启浏览器
2. 清除浏览器缓存
3. 重新安装 MetaMask 扩展（最后手段）





