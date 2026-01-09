# Anvil 重啟指南：解決 Demo UI 執行過慢問題

## 快速解決方案

如果 Demo UI 執行過久，最簡單的方法是重啟 Anvil 並使用優化配置：

### 方法 1：使用重啟命令（推薦）

```bash
make anvil-restart
```

這個命令會：
1. 自動停止現有的 Anvil 進程
2. 使用優化配置重新啟動（0.5秒出塊，零 gas 費用）

### 方法 2：手動重啟

1. **停止當前的 Anvil**：
   - 找到運行 Anvil 的終端
   - 按 `Ctrl+C` 停止

2. **重新啟動 Anvil**：
   ```bash
   make anvil-free
   ```
   這會使用快速配置啟動（0.5秒出塊）

### 方法 3：完全清理後重啟

如果上述方法無效，可以完全清理：

```bash
# 1. 停止所有 Anvil 進程
lsof -ti:8545 | xargs kill -9

# 2. 等待幾秒
sleep 2

# 3. 重新啟動
make anvil-free
```

## 性能優化配置

我們已經優化了 Anvil 配置：

### 當前配置（`make anvil-free`）
- **出塊時間**：0.5 秒（非常快）
- **Gas 費用**：0（免費交易）
- **Base Fee**：0

### 性能對比

| 配置 | 出塊時間 | 交易確認時間 | 完整 Demo Flow |
|------|---------|-------------|----------------|
| 默認 (`make anvil`) | 12 秒 | ~12-24 秒 | ~30-60 秒 |
| 優化 (`make anvil-free`) | 0.5 秒 | 0.5-1.5 秒 | **1-3 秒** |

## 驗證步驟

重啟後，請驗證：

1. **檢查 Anvil 是否正常運行**：
   ```bash
   curl http://localhost:8545 -X POST -H "Content-Type: application/json" \
     --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
   ```
   應該返回一個區塊號

2. **檢查出塊時間**：
   - 在 Anvil 終端中，應該看到每 0.5 秒產生一個新區塊
   - 區塊號應該快速增加

3. **刷新瀏覽器**：
   - 硬刷新：`Cmd+Shift+R` (Mac) 或 `Ctrl+Shift+R` (Windows)
   - 重新連接錢包
   - 重試 Demo Flow

## 前端優化

前端已經配置了性能優化：

- ✅ QueryClient 配置：
  - `staleTime: 1000`：更快的数据更新
  - `refetchInterval: false`：禁用不必要的輪詢
  - `refetchOnWindowFocus: false`：避免窗口焦點時的重新查詢

## 常見問題

### Q: 重啟後仍然很慢？

**檢查清單**：
1. ✅ 確認使用的是 `make anvil-free` 而不是 `make anvil`
2. ✅ 檢查 Anvil 啟動輸出，確認顯示 "Block Time: 0.5 seconds"
3. ✅ 確認 MetaMask 連接到正確的網絡（Localhost 8545）
4. ✅ 清除瀏覽器緩存並硬刷新

### Q: 端口被占用？

```bash
# 查看占用 8545 端口的進程
lsof -i :8545

# 強制停止
lsof -ti:8545 | xargs kill -9
```

### Q: 交易一直 Pending？

1. 檢查 MetaMask 中是否有待確認的交易
2. 確認 Anvil 正在運行
3. 刷新瀏覽器頁面
4. 重新連接錢包

## 進一步優化

如果需要更快的速度，可以手動調整出塊時間：

```bash
# 使用 0.1 秒出塊（極快，但可能不穩定）
anvil --base-fee 0 --gas-price 0 --block-time 0.1
```

**注意**：過快的出塊時間可能會導致某些應用程序出現問題，0.5 秒是一個很好的平衡點。




