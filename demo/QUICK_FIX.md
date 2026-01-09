# 快速修复：MetaMask 余额显示 0

## 立即尝试这些步骤（按顺序）

### 步骤 1：确认你导入的账户地址

**在 MetaMask 中查看你的账户地址**：
1. 点击右上角的账户名称（显示 "Imported Account 1" 的地方）
2. 查看显示的地址
3. 完整的地址应该以 `0x` 开头，有 42 个字符

**标准账户 1 的地址应该是**：
```
0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

**如果地址不匹配** → 跳到步骤 4

**如果地址匹配但余额是 0** → 继续步骤 2

### 步骤 2：刷新 MetaMask

方法 A - 切换网络：
1. 点击 MetaMask 中的网络选择器（显示 "Localhost 8545" 的地方）
2. 选择 "Ethereum Mainnet"
3. 等待 2 秒
4. 再切换回 "Localhost 8545"
5. 检查余额是否更新

方法 B - 重启扩展：
1. 完全关闭浏览器标签页
2. 在浏览器扩展管理页面禁用 MetaMask
3. 重新启用 MetaMask
4. 打开新标签页，检查余额

方法 C - 硬刷新：
1. 在包含 MetaMask 的页面上按 `Cmd+Shift+R` (Mac) 或 `Ctrl+Shift+R` (Windows/Linux)
2. 或者清除浏览器缓存后重新加载

### 步骤 3：验证 Anvil 连接

在终端运行：
```bash
./demo/check_account.sh
```

这会告诉你：
- Anvil 是否运行
- 账户在 Anvil 中的实际余额
- Chain ID 是否正确

### 步骤 4：重新导入账户（如果地址不匹配）

1. **删除当前账户**：
   - 点击账户名称
   - 点击 "Account details" 或 "账户详情"
   - 点击 "Remove Account" 或 "移除账户"
   - 确认删除

2. **重新导入正确私钥**：
   - 点击账户图标（右上角圆形图标）
   - 选择 "Import Account" 或 "导入账户"
   - 选择 "Private Key" 或 "私钥"
   - **复制粘贴这个私钥**（确保完整）：
     ```
     0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
     ```
   - 点击 "Import"

3. **验证地址**：
   - 导入后，点击账户名称
   - 地址应该是：`0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
   - 如果地址匹配，切换到 "Localhost 8545" 网络
   - 余额应该显示 10000 ETH

### 步骤 5：检查 MetaMask 网络配置

如果以上都不行，检查网络配置：

1. 在 MetaMask 中点击网络选择器
2. 点击 "Localhost 8545" 网络设置（齿轮图标）
3. 检查以下设置：
   - Network Name: `Localhost 8545`
   - RPC URL: `http://localhost:8545`
   - Chain ID: `31337`（必须是数字，不是字符串）
   - Currency Symbol: `ETH`
4. 如果有任何不匹配，编辑并保存

### 步骤 6：重启 Anvil（最后手段）

如果以上都不行：

1. 停止当前 Anvil（在终端按 `Ctrl+C`）
2. 重新启动：
   ```bash
   make anvil-free
   ```
3. 使用新启动时显示的私钥重新导入账户

## 常见错误检查清单

- [ ] 使用了私钥而不是地址（私钥是 66 个字符，包括 `0x`）
- [ ] 私钥完整（没有遗漏开头或结尾的字符）
- [ ] 复制粘贴时没有额外的空格或换行
- [ ] MetaMask 连接到 "Localhost 8545" 网络
- [ ] Chain ID 是 `31337`（数字）
- [ ] Anvil 正在运行（`make anvil-free`）
- [ ] 账户地址匹配标准地址

## 如果还是不行

请提供以下信息：

1. MetaMask 中显示的账户地址（完整地址）
2. MetaMask 中显示的网络名称和 Chain ID
3. 运行 `./demo/check_account.sh` 的输出
4. Anvil 终端输出的前几行（显示账户信息的部分）





