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

## Issue #112 补充（支付宝 page/wap 预下单）
1. `alipay.provider` 生产下会对 `privateKeyPath/publicKeyPath` 执行“内容或路径”双模式加载：
   - 若为 PEM 文本，直接使用；
   - 若为文件路径，则读取文件内容后初始化 SDK（推荐 secrets 挂载路径）。
2. `POST /payments/create` 在 `channel=alipay` 时统一返回 `payUrl`，并补充 `paymentUrl` 别名字段，兼容已有前端跳转逻辑。

## Issue #114 补充（C 端支付页体验）
1. `/payments/checkout` 补充了缺失订单号、请求失败、提交中状态展示，避免静默失败。
2. `/payments/wechat-qrcode` 使用二维码组件渲染链接，并补充 loading/error/手动刷新与结果页跳转入口。
3. `/payments/result` 增加支付状态轮询与状态文案，支持从待支付自动刷新到成功结果。

## Issue #115 补充（支付查单与对账补偿）
1. `wechat-pay.provider.query()` 增加真实查单实现（生产环境按 outTradeNo 向 SDK 查单，成功态返回交易号/金额/支付时间）。
2. `alipay.provider.query()` 增加 `alipay.trade.query` 调用，解析 `TRADE_SUCCESS/TRADE_FINISHED` 为已支付结果。
3. `reconcile` 会复用 provider 查单结果进行漏单补偿，未支付保持 `PENDING`，避免误结算。

## Issue #116 补充（微信/支付宝退款）
1. `wechat-pay.provider.refund()` 已支持真实退款调用（生产），按 `out_refund_no + amount(refund/total)` 发起退款；sandbox 返回模拟 refundId。
2. `alipay.provider.refund()` 已支持 `alipay.trade.refund` 调用，使用 `out_request_no` 作为幂等退款请求号；sandbox 返回模拟 refundId。
3. `PaymentService.createRefund()` 继续统一驱动两通道退款申请，并保留 `REFUND_APPLY/REFUND_NOTIFY` 日志链路用于审计。
