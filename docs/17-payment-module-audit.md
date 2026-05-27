# 17 支付模块审计与生产级完善方案（基于当前仓库）

> 审计日期：2026-05-27（UTC）
> 
> 审计范围：
> - `prisma/schema.prisma`
> - `apps/api/src/modules/payment/**`
> - `apps/api/src/modules/order/**`
> - `apps/api/src/modules/auth/**`
> - `apps/web/**`（重点支付/订单页面）
> - `docker-compose.prod.yml`
> - `deploy/api.Dockerfile`
> - `deploy/web.Dockerfile`
> - `.env.example`
> - `docs/**`

---

## 1. 当前支付模块已有接口

### 1.1 用户侧支付创建/驱动接口
- `POST /payments/create`
  - 鉴权：`JwtAuthGuard`
  - 用途：创建支付记录（`PaymentRecord`）并按 channel/method 走 mock 或真实通道占位逻辑。
  - 当前状态：仅 `mock` 通道真正可用；`wechat/alipay` 会返回“当前通道未配置或未启用”。
- `POST /payments/mock/success`
  - 鉴权：`JwtAuthGuard`
  - 用途：development 环境下模拟支付成功，驱动订单 `markPaid`。
- `POST /payments/mock/fail`
  - 鉴权：`JwtAuthGuard`
  - 用途：development 环境下模拟支付失败，更新 `PaymentRecord.status=FAILED`。
- `POST /payment/prepay`
  - 鉴权：`JwtAuthGuard`
  - 用途：老链路预下单，内部可调用微信/支付宝 provider；目前方法支持受限（微信仅 native、支付宝仅 page）。
- `POST /payment/sandbox/simulate-paid`
  - 鉴权：`JwtAuthGuard`
  - 用途：沙箱模拟 paid。

### 1.2 支付回调接口（公开）
- `POST /payments/wechat/notify`
- `POST /payment/notify/alipay`
- `POST /payment/notify/wechat/refund`
- `POST /payment/notify/alipay/refund`

> 以上回调控制器被 `@Public()` 放开，依赖签名校验与业务校验防护。

### 1.3 关联订单接口（支付前后依赖）
- `POST /orders` 创建订单（初始 `PENDING`）
- `GET /orders` / `GET /orders/my` 查询订单
- `GET /orders/:id` 查询订单详情
- `POST /orders/:id/cancel` 取消订单

---

## 2. 当前支付模块已有数据库模型

### 2.1 订单与支付主表
- `Order`
  - 关键字段：`status`、`amountCents`、`paidAmountCents`、`channel`、`method`、`outTradeNo`、`transactionId`、`quotaGranted`、`expiresAt`。
  - 索引：`status/sourceType/agencyId/expiresAt` 等。
- `PaymentRecord`
  - 关键字段：`paymentNo`、`channel`、`method`、`status`、`providerTradeNo`、`providerOrderNo`、`payUrl`、`qrCodeUrl`、`notifyRaw`、`notifyVerified`、`idempotencyKey`。
  - 作用：更细粒度记录一次支付发起与回调状态。

### 2.2 审计与回调日志
- `PaymentCallbackLog`
  - 记录回调原文、验签结果、归一化状态、处理状态、错误信息。
- `PaymentLog`
  - 事件流模型：`CREATE / PREPAY / NOTIFY / QUERY / CLOSE / REFUND_APPLY / REFUND_NOTIFY / ERROR`。

### 2.3 退款模型
- `Refund`
  - 关键字段：`refundNo`、`status`、`outRefundNo`、`refundId`、`reason`、`rejectReason`、`resolvedAt`、`errorMessage`。

### 2.4 枚举
- `OrderStatus`：`PENDING/PENDING_PAYMENT/PAID/FULFILLING/COMPLETED/CANCELLED/REFUNDING/REFUNDED/CLOSED`
- `PaymentChannel`：`WECHAT/ALIPAY`
- `PaymentMethod`：`WECHAT_NATIVE/WECHAT_JSAPI/WECHAT_H5/ALIPAY_PAGE/ALIPAY_WAP`
- `RefundStatus`：`PENDING/APPROVED/REJECTED/SUCCESS/FAILED`

---

## 3. 当前微信支付能力

### 已具备
1. Provider 层封装：`wechatpay-node-v3` 接入代码结构已存在。
2. Native/H5 预下单方法均已实现（含 sandbox mock 返回）。
3. 支付回调验签 + 解密 + 归一化数据能力已实现。
4. 回调日志落库（`PaymentCallbackLog`）与支付记录状态更新（`PaymentRecord`）逻辑已存在。

### 受限/未完成
1. 新链路 `/payments/create` 未打通真实微信（仅 mock 真可用）。
2. `refund()` 明确返回未启用异常。
3. `query()` 仅返回 `PENDING` 占位。
4. 证书参数在代码中以“路径/字符串混用”方式传入，生产可用性需二次确认（见风险章节）。

---

## 4. 当前支付宝支付能力

### 已具备
1. Provider 层封装：`alipay-sdk` 接入结构已存在。
2. `pagePay/wapPay` 已实现（含 sandbox mock URL）。
3. 异步通知验签 + 归一化能力已实现。

### 受限/未完成
1. 新链路 `/payments/create` 未打通真实支付宝（仅 mock 可用）。
2. `refund()` 明确未启用。
3. `query()` 仅返回 `PENDING` 占位。

---

## 5. 当前前端支付页面

### C 端页面
1. `/payments/checkout`
   - 可选择微信/支付宝；移动端自动切换 method（wechat:h5/native, alipay:wap/page）。
   - 直接调 `/payments/create`。
2. `/payments/wechat-qrcode`
   - 展示二维码 URL 文本；每 3 秒轮询 `/orders/{id}/payment-status`。
3. `/payments/result`
   - 拉取 `/orders/{id}/payment-status` 显示支付状态。

### 管理端页面
1. `/admin/payments`
2. `/admin/payment-callback-logs`

### 发现问题
- 前端依赖的 `/orders/:id/payment-status` 在已审计 `order.controller.ts` 中未见对应路由，存在前后端契约不一致风险。
- 二维码页仅展示字符串，未看到正式二维码组件与状态态（loading/empty/error）完善逻辑。

---

## 6. 当前订单与支付状态流转

### 6.1 当前落地主流转（代码行为）
1. 创建订单：`Order.status = PENDING`。
2. 发起支付：
   - `/payments/create` 会新增 `PaymentRecord(status=CREATED)`；mock 通道可继续推进。
   - `/payment/prepay` 会写 `outTradeNo/channel/method` 并落 `PaymentLog(PREPAY)`。
3. 支付成功：调用 `orderService.markPaid()`。
4. `markPaid()` 目前将订单直接更新为 `COMPLETED`，并写入支付字段后发放配额。
5. 退款申请：`createRefund()` 会先将订单置为 `REFUNDING`，后续根据回调或人工处理置 `REFUNDED`/回退。

### 6.2 与文档/枚举目标态差异
- 枚举存在 `PAID/FULFILLING/COMPLETED` 多阶段，但支付成功后直接进入 `COMPLETED`，将“支付完成”与“履约完成”合并，弱化生产可观测性与售后边界。

---

## 7. 当前缺失能力

1. **真实通道未打通（P0）**：`/payments/create` 对微信/支付宝直接报未启用。
2. **统一支付链路未收敛（P0）**：`/payments/create` 与 `/payment/prepay` 双轨并存，存在行为差异。
3. **退款通道未启用（P0）**：微信/支付宝 provider 的 `refund()` 均未完成。
4. **主动查单/补偿不足（P1）**：`query()` 占位实现，`reconcile` 可用性有限。
5. **状态机不精细（P1）**：支付成功即 `COMPLETED`，不利于订单生产环节治理。
6. **幂等与防重加强空间（P1）**：已有 transactionId 防重，但需补全“支付单层面”幂等键策略与唯一约束策略验证。
7. **前后端接口契约不齐（P1）**：前端调用 `payment-status`，后端控制器未见对应路由。
8. **生产监控告警缺口（P1）**：未见 Prometheus 指标、通道错误率告警、回调积压告警等。

---

## 8. 生产环境风险点

1. **密钥/证书注入模型不清晰**：
   - `.env.example` 以内容型变量命名（`WECHAT_PAY_PRIVATE_KEY`/`ALIPAY_PRIVATE_KEY`），
   - `SettingsService` + provider 又使用 `privateKeyPath/publicKeyPath` 语义。
   - 若值是“内容”而 SDK 期望“文件路径”，生产启动或签名会失败。
2. **订单状态过早完成**：支付成功后置 `COMPLETED`，易导致履约、售后、财务口径冲突。
3. **双链路并存导致行为漂移**：`/payments/create` 与 `/payment/prepay` 支持范围不同。
4. **生产禁用 mock 但前端默认走 create**：若未启用真实通道，线上会大面积支付失败。
5. **回调路径不统一**：`/payments/wechat/notify` 与 `/payment/notify/alipay` 风格不一致，易配置错误。
6. **退款能力未实装**：运营可发起退款流程，但实际第三方退款不可执行。
7. **轮询接口缺失风险**：前端依赖 `payment-status` 可能 404。
8. **部署阶段迁移耦合启动**：`api` 启动命令内执行 `prisma migrate deploy`，若迁移失败直接阻断 API 启动。

---

## 9. 微信支付参数与 secrets 文件对应关系

> 当前部署通过 `docker-compose.prod.yml` 挂载 `./secrets:/app/secrets:ro`，建议统一“环境变量只存路径，密钥文件走 secrets 挂载”。

| 逻辑参数 | 当前代码读取键 | 建议 secrets 文件 | 建议 env 值示例 |
|---|---|---|---|
| appid | `payment.wechat.appid` | 无（普通字符串） | `WECHAT_PAY_APP_ID=wx***` |
| mchid | `payment.wechat.mchid` | 无 | `WECHAT_PAY_MCH_ID=***` |
| serialNo | `payment.wechat.serialNo` | 无 | `WECHAT_PAY_CERT_SERIAL_NO=***` |
| apiV3Key | `payment.wechat.apiV3Key` | 可放 env 或 secrets manager | `WECHAT_PAY_API_V3_KEY=***` |
| privateKeyPath | `payment.wechat.privateKeyPath` | `/app/secrets/wechat/apiclient_key.pem` | `WECHAT_PAY_PRIVATE_KEY_PATH=/app/secrets/wechat/apiclient_key.pem` |
| notifyUrl | `payment.wechat.notifyUrl` | 无 | `WECHAT_PAY_NOTIFY_URL=https://xxx/api/payments/wechat/notify` |

> 说明：`WECHAT_PAY_PRIVATE_KEY`（内容型）与 `*_PATH`（路径型）必须二选一并统一到代码配置映射，避免混乱。

---

## 10. 支付宝参数与 secrets 文件对应关系

| 逻辑参数 | 当前代码读取键 | 建议 secrets 文件 | 建议 env 值示例 |
|---|---|---|---|
| appId | `payment.alipay.appId` | 无 | `ALIPAY_APP_ID=***` |
| gateway | `payment.alipay.gateway` | 无 | `ALIPAY_GATEWAY=https://openapi.alipay.com/gateway.do` |
| privateKeyPath | `payment.alipay.privateKeyPath` | `/app/secrets/alipay/app_private_key.pem` | `ALIPAY_PRIVATE_KEY_PATH=/app/secrets/alipay/app_private_key.pem` |
| publicKeyPath | `payment.alipay.publicKeyPath` | `/app/secrets/alipay/alipay_public_key.pem` | `ALIPAY_PUBLIC_KEY_PATH=/app/secrets/alipay/alipay_public_key.pem` |
| notifyUrl | `payment.alipay.notifyUrl` | 无 | `ALIPAY_NOTIFY_URL=https://xxx/api/payment/notify/alipay` |
| returnUrl | `payment.alipay.returnUrl` | 无 | `ALIPAY_RETURN_URL=https://xxx/payments/result` |

---

## 11. 建议开发任务拆分

### Task A（P0）统一支付创建主链路
- 目标：以 `/payments/create` 作为唯一支付入口，打通 wechat/alipay 真实下单，移除或降级老 prepay 链路。

### Task B（P0）打通第三方回调与订单状态机
- 目标：回调后先进入 `PAID`（而非 `COMPLETED`），再由履约模块推进 `FULFILLING/COMPLETED`。

### Task C（P0）落地真实退款能力
- 目标：完成 wechat/alipay `refund()`，支持异步退款回调与状态闭环。

### Task D（P1）支付查询与对账补偿
- 目标：完善 provider `query()` + 定时 reconcile，覆盖“回调丢失、延迟到账”。

### Task E（P1）配置与密钥治理
- 目标：统一 PATH 型配置、完善 `.env.example`、补充 secrets 目录规范文档。

### Task F（P1）前后端契约修复
- 目标：补齐 `payment-status` 接口或调整前端调用，补充 UI 的 loading/empty/error。

### Task G（P1）可观测性与告警
- 目标：增加支付成功率、回调失败率、退款失败率、回调延迟指标与告警。

---

## 12. 每个任务对应修改文件

### Task A
- `apps/api/src/modules/payment/payment.service.ts`
- `apps/api/src/modules/payment/payment.controller.ts`
- `apps/api/src/modules/payment/dto/create-payment.dto.ts`
- `apps/api/src/modules/payment/providers/wechat-pay.provider.ts`
- `apps/api/src/modules/payment/providers/alipay.provider.ts`
- `docs/06-api-design.md`

### Task B
- `apps/api/src/modules/order/order.service.ts`
- `apps/api/src/modules/payment/payment.service.ts`
- `apps/api/src/modules/payment/notify.controller.ts`
- `prisma/schema.prisma`（如需新增状态字段/索引）
- `docs/06-api-design.md`
- `docs/05-data-model.md`

### Task C
- `apps/api/src/modules/payment/providers/wechat-pay.provider.ts`
- `apps/api/src/modules/payment/providers/alipay.provider.ts`
- `apps/api/src/modules/payment/payment.service.ts`
- `apps/api/src/modules/payment/notify.controller.ts`
- `docs/06-api-design.md`

### Task D
- `apps/api/src/modules/payment/reconcile.service.ts`
- `apps/api/src/modules/payment/providers/wechat-pay.provider.ts`
- `apps/api/src/modules/payment/providers/alipay.provider.ts`
- `apps/api/src/modules/payment/payment-callback.service.ts`

### Task E
- `.env.example`
- `apps/api/src/modules/settings/settings.service.ts`
- `apps/api/src/config/*`（若存在配置映射）
- `docker-compose.prod.yml`
- `docs/04-technical-architecture.md`

### Task F
- `apps/api/src/modules/order/order.controller.ts`（或新增 payment-status controller）
- `apps/api/src/modules/order/order.service.ts`
- `apps/web/app/(client)/payments/checkout/page.tsx`
- `apps/web/app/(client)/payments/wechat-qrcode/page.tsx`
- `apps/web/app/(client)/payments/result/page.tsx`
- `docs/07-ui-design-guidelines.md`

### Task G
- `apps/api/src/modules/payment/**`（日志/metrics）
- `deploy/api.Dockerfile`（如需 metrics 依赖）
- `docker-compose.prod.yml`（如需 sidecar/exporter）
- `docs/09-acceptance-checklist.md`

---

## 13. 每个任务验收标准

### Task A
- 微信/支付宝在生产配置完整时均可返回可支付 payload。
- `mock` 仅在 development 可用，production 不可调用。
- 同一订单重复创建支付单遵循幂等策略并有清晰返回。

### Task B
- 回调成功后订单状态变更为 `PAID`（不直接 `COMPLETED`）。
- 履约系统独立推进到 `FULFILLING/COMPLETED`。
- 回调重放 3 次不会重复发放配额。

### Task C
- 微信/支付宝退款可成功发起并完成异步状态更新。
- 部分退款与全额退款均可闭环，订单状态正确。
- 退款失败具备可追踪错误码与重试策略。

### Task D
- 在“无回调”场景下，对账任务能在阈值时间内自动补偿为正确状态。
- 对账任务失败会写入错误日志并可告警。

### Task E
- `.env.example` 与 `SettingsService` 字段语义一致（PATH vs CONTENT）。
- `docker-compose.prod.yml` 中 secrets 挂载路径与代码读取路径一致。
- 任一通道缺少关键配置时，启动或调用阶段给出明确错误。

### Task F
- C 端支付页流程可走通（checkout → qrcode/h5/page → result）。
- `payment-status` 接口返回结构稳定；页面具备 loading/empty/error。
- 刷新页面后状态可正确恢复。

### Task G
- 至少具备 4 个核心指标：支付发起、成功率、回调失败率、退款失败率。
- 关键阈值告警（如 5 分钟回调失败率 > X%）可触发。

---

## 14. 推荐 PR 拆分方案

### PR-1（docs/payment-audit）
- 内容：本审计文档 + 风险清单 +任务拆分。
- 范围：仅 `docs/17-payment-module-audit.md`。

### PR-2（feat/payment-create-unify）
- 内容：统一 `/payments/create` 真实通道接入，prepay 兼容或下线策略。
- 影响：后端支付模块 + API 文档。

### PR-3（refactor/order-payment-state-machine）
- 内容：支付成功改为 `PAID`，履约阶段与支付阶段解耦。
- 影响：订单服务、支付回调、可能的数据模型和迁移。

### PR-4（feat/refund-provider-integration）
- 内容：微信/支付宝退款完整接入。
- 影响：支付 provider、退款回调、运维验证脚本。

### PR-5（feat/payment-reconcile-and-observability）
- 内容：查单补偿 + 指标告警。
- 影响：reconcile、日志、部署配置。

### PR-6（feat/client-payment-experience-hardening）
- 内容：前端支付闭环与状态接口契约修复（含 loading/empty/error）。
- 影响：web 支付页 + api 查询接口。

---

## 补充：To B 机构流程三方影响说明

1. **机构视角**：支付主体可能为机构代付，需支持 `sourceType=AGENCY` 下的对账、退款责任主体、审计追踪。
2. **学生视角**：即使机构代付，也应在学生订单页看到明确支付状态与履约状态区分。
3. **管理视角**：需在管理端区分“支付完成/履约完成/退款中”，避免财务与交付口径混淆。

