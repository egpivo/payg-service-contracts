# Local Development Setup Guide

## 连接到本地 Anvil 网络（MetaMask）

### 步骤 1：启动 Anvil 节点

在一个终端中运行：

```bash
# 使用零 gas 费用（推荐）
make anvil-free

# 或者使用默认设置
make anvil
```

你会看到类似这样的输出：

```
Available Accounts
==================
(0) 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
(1) 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (10000 ETH)
...

Private Keys
==================
(0) 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
(1) 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
...

Network
==================
Listen Address: 127.0.0.1:8545
Chain ID: 31337
```

### 步骤 2：在 MetaMask 中添加本地网络

#### 方法 A：通过 MetaMask UI 添加

1. **打开 MetaMask 扩展**

2. **点击网络选择器**（通常在顶部显示 "Ethereum Mainnet" 或其他网络名称）

3. **点击 "Add Network" 或 "添加网络"**

4. **选择 "Add a network manually" 或 "手动添加网络"**

5. **填写以下信息**：

   ```
   Network Name: Localhost 8545
   RPC URL: http://localhost:8545
   Chain ID: 31337
   Currency Symbol: ETH
   Block Explorer URL: (留空或使用 https://localhost:8545)
   ```

6. **点击 "Save" 或 "保存"**

7. **切换到 Localhost 8545 网络**

#### 方法 B：通过 MetaMask 设置页面添加

1. **点击 MetaMask 扩展图标**

2. **点击右上角的设置图标（齿轮）**

3. **选择 "Networks" 或 "网络"**

4. **点击 "Add Network" 或 "添加网络"**

5. **填写上述网络信息并保存**

### 步骤 3：导入测试账户

Anvil 启动时会显示多个测试账户和对应的私钥。你可以导入这些账户来获得测试 ETH：

1. **在 MetaMask 中点击账户图标**（右上角）

2. **选择 "Import Account" 或 "导入账户"**

3. **选择 "Private Key" 或 "私钥"**

4. **粘贴 Anvil 输出的私钥**（例如：`0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`）

5. **点击 "Import" 或 "导入"**

6. **确认账户已导入，余额应显示为 10000 ETH**

### 步骤 4：验证连接

1. **确保 MetaMask 显示的网络是 "Localhost 8545"**

2. **检查 Chain ID**：
   - 在 MetaMask 的网络名称下方应该显示 Chain ID: 31337
   - 或者在浏览器控制台运行 `window.ethereum.chainId` 应该返回 `"0x7a69"`（31337 的十六进制）

3. **检查账户余额**：
   - 导入的账户应该显示 10000 ETH

### 步骤 5：启动 Web UI

在另一个终端中：

```bash
make web-dev
```

然后在浏览器中打开 http://localhost:3000

### 故障排除

#### 问题：MetaMask 无法连接到本地网络

**解决方案**：
- 确保 Anvil 正在运行（`make anvil-free`）
- 检查 RPC URL 是否正确：`http://localhost:8545`
- 确保没有其他程序占用 8545 端口
- 尝试重启 MetaMask 扩展

#### 问题：Chain ID 不匹配

**解决方案**：
- 确保 Chain ID 设置为 `31337`（不是字符串，是数字）
- 如果之前添加过，删除并重新添加网络
- 清除浏览器缓存并重新加载

#### 问题：交易失败或 gas 费用很高

**解决方案**：
- 确保使用 `make anvil-free` 启动 Anvil（零 gas 费用）
- 如果使用 `make anvil`，gas 费用可能不为零但应该很低
- 检查网络是否真的是 Localhost 8545

#### 问题：账户余额为 0

**常见原因和解决方案**：

1. **确保导入正确的私钥**：
   - 使用 Anvil 启动时显示的私钥，不是地址
   - 标准 Anvil 第一个账户私钥：`0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
   - 对应的地址应该是：`0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`

2. **刷新 MetaMask**：
   - 在 MetaMask 中点击账户名称
   - 选择 "Account details" 或"账户详情"
   - 点击 "Refresh list" 或"刷新列表"
   - 或者直接切换网络（切换到其他网络再切回来）

3. **清除 MetaMask 缓存**：
   - 关闭并重新打开 MetaMask 扩展
   - 或者在浏览器中硬刷新页面（Cmd+Shift+R 或 Ctrl+Shift+R）

4. **验证账户地址**：
   - 在 MetaMask 中查看导入账户的地址
   - 确认地址以 `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` 开头（如果使用第一个账户）
   - 如果地址不匹配，说明私钥不对，需要重新导入

5. **重新导入账户**：
   - 如果地址不匹配，删除账户并重新导入正确的私钥
   - 确保复制完整的私钥（包括 `0x` 前缀）

6. **检查 Anvil 是否运行**：
   - 确保 `make anvil-free` 正在运行
   - 检查终端输出是否显示账户信息

### 快速检查清单

- [ ] Anvil 正在运行（`make anvil-free`）
- [ ] MetaMask 已添加 Localhost 8545 网络
- [ ] MetaMask 当前网络是 Localhost 8545
- [ ] Chain ID 显示为 31337
- [ ] 已导入至少一个测试账户
- [ ] 账户余额显示为 10000 ETH
- [ ] Web UI 正在运行（`make web-dev`）

完成以上步骤后，你就可以在本地环境中进行开发和测试了，所有交易的 gas 费用都将是 0 ETH！

