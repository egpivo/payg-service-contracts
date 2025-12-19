# Rental Module Design Review

## 對比三個租賃場景的符合度分析

### 🥇 1. Venue / Space Rental（最適合）✅

**需求：**
- ✅ 時間型 access（完美對應 AccessLib）
- ✅ Subscription 很自然（monthly pass）
- ✅ Bundle 很合理（多場地聯盟）

**當前實現：**

#### ✅ SpaceSubscription.sol
- **時間型 access**: 使用 `AccessLib.computeExpiry()` 完美支持
  ```solidity
  uint256 expiry = AccessLib.computeExpiry(currentExpiry, block.timestamp, _accessDuration);
  ```
- **Subscription 模式**: 
  - `rentSpace()` - 租一次，在 access period 內可多次使用
  - 支持 renewal（從當前 expiry 延長）
  - 支持永久 access（duration = 0）
- **押金管理**: 完整的 deposit 系統
- **獨佔性**: `exclusive=true`，自動追蹤 `currentRenter` 和 `exclusiveUntil`

#### ✅ SpacePayPerUse.sol
- 按次付費模式（gas 高效）
- 適合短期使用場景

#### ✅ RentalBundle.sol
- **多場地聯盟**: 支持創建包含多個 rental 的 bundle
- **收入分配**: 自動平均分配給各 provider
- **時間管理**: 使用 `AccessLib.computeExpiry()` 管理 bundle access

**結論**: ✅ **完全符合** Venue/Space rental 需求

---

### 🥈 2. Equipment Rental（攝影 / Podcast）✅

**需求：**
- ✅ Pay-per-use
- ✅ Bundle = creator kit
- ✅ 不用處理 location

**當前實現：**

#### ✅ EquipmentPayPerUse.sol
- **Pay-per-use**: 完美實現，gas 高效
- **獨佔性可選**: 
  - `exclusive=true` - 實體設備（相機、麥克風）
  - `exclusive=false` - 數位/共享設備
- **無 location**: 沒有 location 字段，符合需求

#### ✅ RentalBundle.sol
- **Creator kit**: 可以將多個設備（相機 + 麥克風 + 燈光）打包成 bundle
- **一次付款**: 購買 bundle 後可訪問所有設備

**缺失：**
- ⚠️ 沒有 `EquipmentSubscription`（但可能不需要，設備通常是按次租用）

**結論**: ✅ **基本符合**，可考慮添加 EquipmentSubscription 用於長期租賃場景

---

### 🥉 3. Digital Rental（SaaS）✅

**需求：**
- GPU hours
- API credits
- Tool usage

**當前實現：**

#### ✅ DigitalPayPerUse.sol
- **Quantity-based 計費**: 支持按使用量計費（如 10 GPU hours, 100 API credits）
- **Pay-per-unit**: `useDigitalService(rentalId, quantity)` - 總成本 = pricePerUnit × quantity
- **非獨佔**: 多個用戶可同時使用（`exclusive=false`）
- **Gas 高效**: 無 accessExpiry 儲存寫入

#### ✅ DigitalSubscription.sol
- **Credit-based 訂閱**: 購買 credits，使用時消耗
  - `subscribeToService(rentalId, credits)` - 購買 credits
  - `useDigitalService(rentalId, quantity)` - 消耗 credits
- **Time-based 訂閱**: 購買時間段，期間內無限使用
  - 使用 `AccessLib.computeExpiry()` 管理時間
  - 支持 renewal 和永久 access
- **靈活模式**: 同一合約支持兩種訂閱模式

**結論**: ✅ **完全符合** Digital rental 需求

---

## 總結

| 場景 | 符合度 | 狀態 |
|------|--------|------|
| 🥇 Venue/Space | ✅ 100% | 完美支持 |
| 🥈 Equipment | ✅ 90% | 基本完整，可選添加 Subscription |
| 🥉 Digital | ✅ 100% | 完美支持 |

## 當前實現結構

```
contracts/modules/rentals/
├── RentalBase.sol              # 領域層：租賃語義
├── IRentalRegistry.sol         # 介面
├── RentalBundle.sol            # 組合包（協議層結算）
├── space/                     # 空間租賃服務
│   ├── SpacePayPerUse.sol
│   └── SpaceSubscription.sol
├── equipment/                  # 設備租賃服務
│   └── EquipmentPayPerUse.sol
└── digital/                    # 數位服務租賃 ✅ NEW
    ├── DigitalPayPerUse.sol    # Quantity-based 計費
    └── DigitalSubscription.sol # Credit/Time-based 訂閱
```

## 可選改進

### 1. 添加 EquipmentSubscription
用於長期設備租賃（如月租相機套裝）

### 3. 當前架構優勢
- ✅ 清晰的層次分離（core / domain / service）
- ✅ 獨佔性管理完善
- ✅ Bundle 支持跨服務組合
- ✅ AccessLib 完美支持時間型 access

## 結論

**當前實現完美支持所有三個租賃場景**：
- ✅ **Venue/Space rental** - 100% 符合（時間型 access、Subscription、Bundle）
- ✅ **Equipment rental** - 90% 符合（Pay-per-use、Bundle，可選添加 Subscription）
- ✅ **Digital rental** - 100% 符合（Quantity-based 計費、Credit/Time-based 訂閱）

所有核心功能已實現，架構清晰且可擴展。

