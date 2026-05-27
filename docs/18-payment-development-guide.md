# 18 支付配置开发指南（Issue #107）

## 目标
统一微信/支付宝配置读取方式，生产优先使用 secrets 挂载文件路径（`*_PATH`），同时兼容历史变量，避免一次性切换风险。

## 代码变更点
- `apps/api/src/config/payment.config.ts`
  - 新增 `pickEnv()`，按优先级读取环境变量。
  - 微信：`WECHAT_PAY_PRIVATE_KEY_PATH` 优先，回退 `WECHAT_PAY_PRIVATE_KEY`。
  - 支付宝：`ALIPAY_PRIVATE_KEY_PATH` 优先，回退 `ALIPAY_PRIVATE_KEY`。
  - 公钥与平台证书同理支持 `*_PATH` 优先回退旧变量。

- `apps/api/src/modules/payment/payment.service.ts`
  - `POST /payments/create` 已支持真实 `wechat/alipay` 通道下单：
    - wechat: `native` / `h5`
    - alipay: `page` / `wap`
  - 创建 `PaymentRecord` 后会写回 `channel/method/providerOrderNo/payUrl|qrCodeUrl/rawResponse`。

## 变量优先级

### 微信
1. `WECHAT_PAY_PRIVATE_KEY_PATH`
2. `WECHAT_PAY_PRIVATE_KEY`（兼容）

### 支付宝
1. `ALIPAY_PRIVATE_KEY_PATH`
2. `ALIPAY_PRIVATE_KEY`（兼容）

## 开发注意事项
1. 不在日志打印密钥内容。
2. 不提交 `.env.prod` 与 `secrets/`。
3. 本次仅配置加载统一，不改支付业务流程与订单状态机。

## Issue #110 补充（微信生产签名）
1. `wechat-pay.provider` 在生产下单前会读取商户私钥内容用于签名。
2. `privateKeyPath` 支持两种输入：
   - 证书内容（兼容）
   - 文件路径（推荐，配合 `/app/secrets` 挂载）
3. 当文件不可读时，接口会返回明确配置错误，避免静默失败。
