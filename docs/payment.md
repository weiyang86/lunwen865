# Payment 模块说明

## 1. 订单状态机（架构图）

```text
PENDING
  | 预下单成功（仅生成支付参数）
  | 支付回调/对账补偿 markPaid
  v
PAID ------------------------------.
  | 管理员发起退款                 |
  v                               |
REFUNDING                         |
  | 退款回调成功 / 沙箱即时成功    |
  |-- 部分退款 --> PAID ----------'
  '-- 全额退款 --> REFUNDED

PENDING --(过期关闭 cron)--> CANCELLED
```

说明：
- `markPaid` 幂等：同一 `outTradeNo` 重复回调不重复发放配额。
- 退款支持部分退款：部分退款后订单回到 `PAID`，全额退款才到 `REFUNDED`。

## 2. 沙箱模式

- 配置项：`PAYMENT_SANDBOX=true`
- 行为：
- `/payment/sandbox/simulate-paid` 可用（生产环境直接 403）
- 预下单/退款可返回 mock 数据
- notify 支持简化 body 解析，便于本地联调

## 3. 上线 Checklist（10 项）

- `PAYMENT_SANDBOX=false`
- 配置微信商户参数：`WECHAT_PAY_APPID`/`WECHAT_PAY_MCHID`/`WECHAT_PAY_SERIAL_NO`
- 配置微信密钥与证书路径：`WECHAT_PAY_PRIVATE_KEY_PATH`/`WECHAT_PAY_API_V3_KEY`
- 配置支付宝参数：`ALIPAY_APPID`/`ALIPAY_GATEWAY`
- 配置支付宝密钥路径：`ALIPAY_PRIVATE_KEY_PATH`/`ALIPAY_PUBLIC_KEY_PATH`
- 配置回调 URL：`WECHAT_PAY_NOTIFY_URL`/`ALIPAY_NOTIFY_URL`
- `main.ts` 已启用 `rawBody: true`
- 网关放通第三方回调来源 IP/域名，确保可访问 `/api/payment/notify/*`
- 启用日志采集与告警（`PAYMENT_NOTIFY_FAIL`、`RECONCILE_ERROR`）
- 生产数据库备份与回滚策略演练完成

## 4. 回调 URL 配置

- 微信支付回调：`https://<domain>/api/payment/notify/wechat`
- 支付宝回调：`https://<domain>/api/payment/notify/alipay`
- 微信退款回调：`https://<domain>/api/payment/notify/wechat/refund`
- 支付宝退款回调：`https://<domain>/api/payment/notify/alipay/refund`

要求：
- 回调路由必须不加 JWT 守卫。
- 验签失败返回 `FAIL`，三方会按策略重试。

## 5. 证书放置路径

- 微信私钥：`certs/wechat/apiclient_key.pem`
- 支付宝应用私钥：`certs/alipay/app_private_key.pem`
- 支付宝公钥：`certs/alipay/alipay_public_key.pem`

注意：
- `certs/` 已在 `.gitignore` 中忽略，证书文件禁止提交仓库。

## 6. 常见问题（FAQ）

### Q1：回调验签失败怎么办？
- 检查证书路径是否正确、证书内容是否最新、网关是否透传原始 body。
- 确认 `main.ts` 使用 `rawBody: true`，避免签名串被 JSON 中间件篡改。

### Q2：出现漏单（用户已支付，订单仍 PENDING）怎么办？
- 系统有 `ReconcileService` 每 5 分钟巡检 `PENDING` 订单并主动 query 三方补单。
- 检查 `outTradeNo` 是否落库、支付通道配置是否正确。

### Q3：重复回调会不会重复发配额？
- 不会。`markPaid` 已实现事务幂等，二次回调返回 `alreadyPaid=true`。
