# Foundry Scripts

這個目錄包含用於安裝和執行 Foundry 測試的腳本。

## 腳本說明

### `install-foundry.sh`
安裝 Foundry 工具鏈（forge, cast, anvil, chisel）和 forge-std 測試庫。

**使用方法：**
```bash
./scripts/install-foundry.sh
```

或者使用 npm：
```bash
npm run foundry:install
```

或者使用 make：
```bash
make foundry-install
```

### `test-foundry.sh`
執行 Foundry 測試。

**基本使用方法：**
```bash
./scripts/test-foundry.sh
```

**進階選項：**
```bash
# 執行所有測試
./scripts/test-foundry.sh

# 執行特定測試（使用匹配模式）
./scripts/test-foundry.sh --match-test test_renewal

# 執行特定合約的測試
./scripts/test-foundry.sh --match-contract ArticleSubscription

# 詳細輸出
./scripts/test-foundry.sh -vv

# 顯示 gas 報告
./scripts/test-foundry.sh --gas-report

# 組合使用
./scripts/test-foundry.sh --match-test test_overpay --gas-report -vv
```

**使用 npm：**
```bash
# 執行所有測試
npm run foundry:test

# 詳細輸出
npm run foundry:test:verbose

# Gas 報告
npm run foundry:test:gas
```

**使用 make：**
```bash
# 執行所有測試
make foundry-test

# 詳細輸出
make foundry-test-verbose

# Gas 報告
make foundry-test-gas
```

## 快速開始

1. **安裝 Foundry：**
   ```bash
   ./scripts/install-foundry.sh
   ```

2. **執行測試：**
   ```bash
   ./scripts/test-foundry.sh
   ```

## 注意事項

- 如果 `forge` 命令未找到，腳本會自動嘗試使用 `~/.foundry/bin/forge`
- 如果 `forge-std` 庫未安裝，腳本會自動安裝
- 確保腳本有執行權限：`chmod +x scripts/*.sh`

