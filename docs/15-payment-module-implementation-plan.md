# 15 支付模块实施方案（代码审查 + 架构设计 + 上线审计）

> 文档目标：基于当前仓库真实代码，给出论文通系统“微信支付 + 支付宝支付”可落地方案。  
> 约束：本方案仅文档设计，不修改业务代码 / Prisma schema / migration。

---

## 0. 审查范围与依据

已阅读并对齐：
- `AGENTS.md`
- `docs/00`~`docs/11`
- `docs/14-launch-risk-audit-payment-credit.md`
- 代码：`apps/api/src/modules/order|payment|quota|task|topic|admin`、`apps/web/app/(client)|(admin)`、`prisma/schema.prisma`

---

## 1. 当前代码审查（按你要求逐项）

## 1.1 商品 / 脑细胞套餐

### 结论
- 存在 `Product` 模型（当前可视作脑细胞套餐）。
- 存在价格、脑细胞数量、上下架状态。
- **当前未发现**赠送脑细胞独立字段（仅 `brainCellAmount`）。
- 订单创建不信任前端金额：后端按 `product.priceCents` 与 `productSnapshot` 创建订单。
- 存在商品快照字段：`Order.productSnapshot`。

### 证据路径
- `prisma/schema.prisma`：`model Product`、`model Order`
- `apps/api/src/modules/order/order.service.ts`：`create()` 使用数据库商品价格与快照

## 1.2 订单模块

### 结论
- 存在 `Order` 模型。
- `orderNo` 有唯一约束。
- 存在 `userId`、`amountCents`、`status`、`paidAt`、`expiresAt`。
- 状态支持：`PENDING/PENDING_PAYMENT/PAID/FULFILLING/COMPLETED/CANCELLED/REFUNDING/REFUNDED/CLOSED`。
- 用户端查询仅可看自己的订单（`findOne` 比较 `order.userId === currentUser`）。
- 管理员可查看全部订单（`admin/orders` 控制器+服务）。

### 证据路径
- `prisma/schema.prisma`：`enum OrderStatus`、`model Order`
- `apps/api/src/modules/order/order.controller.ts`
- `apps/api/src/modules/order/order.service.ts`
- `apps/api/src/modules/admin/orders/orders.controller.ts`
- `apps/api/src/modules/admin/orders/orders.service.ts`

## 1.3 支付模块

### 结论
- **当前未发现独立 `PaymentRecord` 模型**，支付事件主要记录在 `PaymentLog` + `Order` 支付字段中。
- 支持 `channel` 与 `method` 枚举：`WECHAT/ALIPAY`，`WECHAT_NATIVE/WECHAT_H5/ALIPAY_PAGE/ALIPAY_WAP` 等。
- `Order` 中有 `outTradeNo`（唯一）与 `transactionId`（非唯一）。
- 支付回调日志：`PaymentLog` 的 `NOTIFY` 类型。
- 已有重复到账基础防护：`Order.quotaGranted` + `markPaid` 事务判定；但仍缺“独立支付记录模型 + providerTradeNo 强唯一”完整设计。

### 证据路径
- `prisma/schema.prisma`：`PaymentChannel`、`PaymentMethod`、`PaymentLogType`、`model PaymentLog`、`model Order`
- `apps/api/src/modules/payment/payment.service.ts`
- `apps/api/src/modules/payment/notify.controller.ts`
- `apps/api/src/modules/order/order.service.ts`

## 1.4 脑细胞额度模块

### 结论
- 用户余额在 `UserQuota.balance`（按 `quotaType` 维度）。
- 流水表为 `QuotaLog`（可视作 BrainCellLedger/CreditLedger）。
- 记录 `change/balanceAfter/reason/orderId/bizId/remark`；并已扩展追踪字段（基于当前仓库）如 `relatedTaskId`、`relatedGenerationRunId`、`idempotencyKey`。
- 充值、消费、退款、管理员增减均有路径；gift 是否独立规则当前未见完整业务闭环。
- “只改余额不记流水”在 `QuotaService` 主路径未发现，主要操作均写日志。

### 证据路径
- `prisma/schema.prisma`：`model UserQuota`、`model QuotaLog`
- `apps/api/src/modules/quota/quota.service.ts`
- `apps/api/src/modules/quota/admin-quota.service.ts`

## 1.5 AI 生成扣费模块

### 结论
- `AiGenerationRun` 已存在（最小版）。
- 题目生成已接入“成功扣费、失败不扣费（run 失败）”。
- 开题/大纲/摘要/正文目前**未全量统一接入** run+扣费事务策略。
- 与支付充值共用 `UserQuota + QuotaLog` 账本（这是正确方向）。
- 重复点击生成风险在非题目节点仍存在（当前未见统一幂等键体系全覆盖）。

### 证据路径
- `prisma/schema.prisma`：`model AiGenerationRun`
- `apps/api/src/modules/topic/topic.service.ts`
- `apps/api/src/modules/opening-report/*`、`outline/*`、`writing/*`（未见同等扣费闭环）

## 1.6 前端页面

### 用户端
- 套餐购买页：有（`(client)/products`）。
- 订单确认页：**当前未发现独立确认页**（购物车直接创建订单）。
- 支付方式选择页：**当前未发现独立页**。
- 微信扫码页：**当前未发现**。
- 支付宝跳转页：**当前未发现**。
- 支付结果页：**当前未发现独立结果页**。
- 我的订单页：有（`(client)/orders`）。
- 余额与流水页：余额有（`(client)/account`）；流水明细页**当前未发现独立页**。

### 后台端
- 后台订单管理页：有。
- 后台支付记录页：**当前未发现独立页**。
- 后台脑细胞流水页：后端有 `admin/quota/logs`；前端独立页**当前未发现**。
- 后台支付回调日志页：**当前未发现**。

### 证据路径
- `apps/web/app/(client)/products/page.tsx`
- `apps/web/app/(client)/cart/page.tsx`
- `apps/web/app/(client)/orders/page.tsx`
- `apps/web/app/(client)/account/page.tsx`
- `apps/web/app/(admin)/admin/orders/page.tsx`

## 1.7 权限与安全

### 结论
- 用户越权访问订单：主路径已防护（`findOne` 对比 `userId`）。
- 任务相关多数接口有 `assertTaskOwnership`。
- 管理员接口有 `JwtAuthGuard + RolesGuard`。
- 支付回调有验签设计（微信 `verifySign`，支付宝 `checkNotifySign`）。
- 前端篡改金额/脑细胞数量：订单金额以后端商品为准，风险较低。
- 风险点：仍需加强 providerTradeNo/transactionId 全局一致性约束与回调日志可观测性。

---

## 2. 目标支付架构（可落地，兼容现栈）

## 2.1 模块分层

1. `OrderService`
- 创建订单（仅后端商品配置定价）
- 查询订单（归属校验）
- 状态流转（pending/paid/expired/cancelled...）
- 过期关闭任务

2. `PaymentService`
- 创建支付记录（第一期可由 `PaymentLog` 过渡，目标是独立 `PaymentRecord`）
- 路由到支付适配器
- 查询支付状态、关闭支付
- 统一回调入口调用 `PaymentCallbackService`

3. `PaymentProviderAdapter`（统一接口）
- `createPayment(order, method, context)`
- `handleCallback(rawBody, headers, query)`
- `queryPayment(paymentRecord)`
- `closePayment(paymentRecord)`

4. `MockPayAdapter`
- dev/test 环境专用
- 仅开发或管理员测试入口可触发

5. `WechatPayAdapter`
- Native + H5
- 验签、解密、查单、关单

6. `AlipayAdapter`
- Page + Wap
- 验签、查单、关单

7. `PaymentCallbackService`
- 回调落日志、验签归一化、金额校验、幂等、到账编排

8. `BrainCellGrantService`
- 支付成功发脑细胞
- 写充值流水
- 防重复到账（同订单只发一次）

9. `PaymentCallbackLog`
- 存原始 headers/body/query
- 存验签结果与处理结果
- 存错误原因便于客服排障

---

## 3. 数据模型“最小改造建议”（仅建议，不改库）

## 3.1 Product / CreditPackage
- 现有 `Product` 已可承载第一期；建议补充 `bonusBrainCellAmount`（可选）。

## 3.2 Order
- 现有已较完整；建议补充：
  - `currency`（默认 CNY）
  - `status` 口径统一映射到支付域（pending/paid/expired/cancelled/failed/refunded）

## 3.3 PaymentRecord（建议新增）
- 用于替代“仅 PaymentLog 事件流”不足：
  - `paymentNo/orderId/userId/channel/method/amount/status`
  - `providerTradeNo/providerOrderNo/providerBuyerId`
  - `payUrl/qrCodeUrl/clientPayload`
  - `notifyRaw/notifyVerified/notifyReceivedAt`
  - `idempotencyKey/paidAt`

## 3.4 PaymentCallbackLog（建议新增）
- 保存每次回调原始请求和处理状态，支持审计与故障追溯。

## 3.5 BrainCellLedger（现 `QuotaLog` 继续承载）
- 现有可用，建议统一 reason/type 字典：`recharge/gift/consume/refund/adjust`。
- 建议补齐 `relatedPaymentId` 关联（当前未发现该字段）。

## 3.6 唯一约束建议
- 必须唯一：`orderNo`、`paymentNo`（新增后）、`providerTradeNo`（非空时）。
- 幂等唯一建议：
  - `idempotencyKey`
  - 或 `relatedOrderId + type=recharge` 的业务唯一约束。

---

## 4. 状态机设计

## 4.1 订单状态机
- `pending`：订单创建完成待支付。
- `paid`：回调/查单确认成功到账后。
- `expired`：超过 `expiresAt` 且未支付（定时任务）。
- `cancelled`：用户主动取消（未支付）。
- `failed`：支付失败且确认无法恢复（第一期可映射 pending/cancelled，先预留）。
- `refunded`：第一期预留。

## 4.2 支付状态机（PaymentRecord 目标）
- `created`：创建支付记录。
- `pending`：已向通道发起支付。
- `succeeded`：回调/查单确认成功。
- `failed`：明确失败。
- `closed`：超时或人工关闭。
- `refunded`：第一期预留。

---

## 5. 微信支付方案（一期）

## 5.1 wechat/native（PC）
1. 创建订单（pending）
2. `POST /payments/create` 选择 wechat/native
3. 后端下单返回 `code_url`
4. 前端渲染二维码
5. 前端轮询订单/支付状态
6. 微信异步回调 `notify_url`
7. 后端验签+解密+金额/订单校验+幂等到账

## 5.2 wechat/h5（Mobile）
1. 创建订单
2. 选择 wechat/h5
3. 后端返回 `mweb_url`
4. 前端跳转收银台
5. 返回结果页后必须查后端状态
6. 以回调或主动查询结果为准

## 5.3 微信环境变量建议（占位）
- `WECHAT_PAY_APP_ID`
- `WECHAT_PAY_MCH_ID`
- `WECHAT_PAY_API_V3_KEY`
- `WECHAT_PAY_PRIVATE_KEY`
- `WECHAT_PAY_CERT_SERIAL_NO`
- `WECHAT_PAY_PLATFORM_CERT`
- `WECHAT_PAY_NOTIFY_URL`

## 5.4 微信安全要求
- 禁止提交密钥/证书
- 必须验签 + 解密
- 校验 `out_trade_no/transaction_id/amount/trade_state=SUCCESS`
- 支持主动查单兜底

---

## 6. 支付宝支付方案（一期）

## 6.1 alipay/page（PC）
1. 创建订单
2. 选择 alipay/page
3. 后端返回跳转 URL 或 form
4. 前端跳转收银台
5. 支付宝异步通知
6. 后端验签+金额/订单校验+幂等到账

## 6.2 alipay/wap（Mobile）
1. 创建订单
2. 选择 alipay/wap
3. 后端返回 wap URL/form
4. 前端跳转
5. 返回结果页后查询后端订单状态
6. 最终以异步通知/主动查询为准

## 6.3 支付宝环境变量建议（占位）
- `ALIPAY_APP_ID`
- `ALIPAY_PRIVATE_KEY`
- `ALIPAY_PUBLIC_KEY`
- `ALIPAY_GATEWAY`
- `ALIPAY_NOTIFY_URL`
- `ALIPAY_RETURN_URL`
- `ALIPAY_SELLER_ID`（可选）

## 6.4 支付宝安全要求
- 禁止提交私钥/公钥
- 异步通知必须验签
- 校验 `out_trade_no/trade_no/total_amount/trade_status`
- 校验 `app_id`/`seller_id`
- 支持主动查单

---

## 7. 统一回调幂等与到账设计

## 7.1 回调接收与落日志
- 先写 `PaymentCallbackLog`（即使验签失败也记录）

## 7.2 验签失败策略
- 验签失败：标记 `verified=false`，`processStatus=ignored`，不到账

## 7.3 结果归一化结构
- `channel/providerOrderNo/providerTradeNo/amount/paidAt/tradeStatus/success`

## 7.4 业务校验
- 订单存在、支付记录存在并归属正确
- 金额一致
- `providerTradeNo` 未被他单占用
- 订单未到账（或可幂等返回）

## 7.5 事务到账（单事务）
1. PaymentRecord -> succeeded
2. Order -> paid
3. UserQuota -> increment
4. QuotaLog -> recharge
5. CallbackLog -> processed

## 7.6 幂等规则
- 重复回调返回 success，但不重复到账
- 同订单只允许一次 recharge
- 同 `providerTradeNo` 只绑定一条支付记录
- `idempotencyKey` 推荐：`channel + providerTradeNo`

## 7.7 异常处理
- 金额不一致/订单不存在/tradeNo 串单：全量记录异常，不到账

---

## 8. 主动查询支付状态

1. 场景：用户结果页等待超时、回调迟到、网关抖动
2. 前端结果页轮询后端 `order payment-status`
3. 后端调用微信/支付宝 query API
4. 查到成功后走同一 `PaymentCallbackService` 幂等到账
5. 查询与回调共用一套幂等键
6. 超时未支付订单由定时任务关闭

---

## 9. 前端最小可用页面方案（设计）

> 以下为“建议页面”，并非当前已全部存在。

### 用户端
1. 套餐购买页（已有基础）
2. 订单确认页（建议新增最小页）
3. 支付方式选择页（native/h5/page/wap）
4. 微信扫码支付页（二维码 + 轮询）
5. 微信 H5 跳转中转页
6. 支付宝跳转处理中转页
7. 支付结果页（只信后端状态）
8. 我的订单页（已有）
9. 脑细胞余额与流水页（余额已有，流水建议补）

### 后台端
1. 套餐管理（已有 product 管理基础）
2. 订单管理（已有）
3. 支付记录页（建议新增）
4. 脑细胞流水页（建议新增）
5. 回调日志页（建议新增）

---

## 10. API 建议清单（仅设计，不实现）

## 用户端
- `GET /api/credit-packages`（P0）
- `POST /api/orders`（P0）
- `GET /api/orders/my`（P0）
- `GET /api/orders/:id`（P0）
- `POST /api/payments/create`（P0）
- `GET /api/payments/:id`（P1）
- `GET /api/orders/:id/payment-status`（P1）
- `GET /api/brain-cells/balance`（P0）
- `GET /api/brain-cells/ledger`（P0）

## 回调
- `POST /api/payments/wechat/notify`（P0）
- `POST /api/payments/alipay/notify`（P0）

## 后台
- `GET/POST/PATCH /api/admin/credit-packages`（P1）
- `GET /api/admin/orders`（P0）
- `GET /api/admin/payments`（P0）
- `GET /api/admin/brain-cell-ledgers`（P0）
- `GET /api/admin/payment-callback-logs`（P0）

## 开发测试
- `POST /api/dev/payments/mock/success`（P0 开发必需）
- `POST /api/dev/payments/mock/fail`（P0 开发必需）

---

## 11. 环境变量与密钥管理

1. `.env.example` 需包含：微信/支付宝支付占位 + mock 开关。
2. 绝对不能提交：私钥、平台证书、APIv3Key、真实商户号密钥。
3. 本地优先 MockPay；仅测试环境接沙箱参数。
4. 生产环境通过 Secret 管理（容器注入 env 或文件挂载）。
5. 私钥文件读取需使用安全路径并限制权限。
6. 日志严禁输出密钥明文。

---

## 12. P0 / P1 / P2 风险清单

## P0（收费上线前必须）
- 订单金额以后端商品配置为准
- 回调验签与金额校验
- 幂等到账（重复回调不重复发脑细胞）
- 订单/支付/流水归属校验
- 后台可查订单、支付、流水、回调日志

## P1（建议上线前）
- 结果页轮询体验
- 主动查单兜底
- 订单过期关闭完善
- 后台筛选与导出

## P2（上线后）
- 退款
- 优惠券/会员/分销
- 多通道容灾与对账导入

---

## 13. 明确结论（必须）

1. **当前支付模块距离上线仍缺 P0 能力**：
   - 独立 `PaymentRecord` 与 `PaymentCallbackLog` 体系未完整落地；
   - 微信/支付宝真实支付的统一回调幂等到账链路未端到端闭环；
   - 后台“支付记录+回调日志”可视化排障页面当前未发现。

2. **微信支付上线前最少要完成 PR**：`PR-1`、`PR-2`、`PR-3`、`PR-5`、`PR-6`（至少后台查询最小页）。

3. **支付宝支付上线前最少要完成 PR**：`PR-1`、`PR-2`、`PR-4`、`PR-5`、`PR-6`。

4. **建议路线**：强烈建议先用 **MockPay** 打通“下单→支付→到账→扣费→审计日志”闭环，再接微信/支付宝真实通道，可显著降低联调和账务风险。


## PR-2 实施进度（Issue #92）
- 已补齐 `PaymentProviderAdapter` 核心方法：createPayment/handleCallback/queryPayment/closePayment。
- 已新增 `MockPayAdapter` 并接入 `PaymentService`。
- 已新增 `POST /api/payments/create`，并对订单归属、pending 状态、channel/method 做校验。
- wechat/alipay 当前保持未启用策略：返回明确错误，避免误接真实支付。


## PR-3 实施进度（Issue #93）
- 已实现 Wechat Native/H5 发起支付，写入 PaymentRecord（channel/method/status/providerOrderNo/qrCodeUrl|payUrl/rawRequest/rawResponse）。
- 已新增微信回调入口 `POST /api/payments/wechat/notify`，支持验签解密与结果归一化。
- 已增加回调日志模型 `PaymentCallbackLog`（记录 rawHeaders/rawBody/rawQuery/verified/normalizedStatus/processStatus/errorMessage/receivedAt/processedAt）。
- 明确：本 PR 不做最终脑细胞到账，到账由 PR-5 统一处理。


## PR-4 实施进度（Issue #94）
- 已实现 Alipay Page/Wap 发起支付，写入 PaymentRecord（channel/method/status/providerOrderNo/payUrl/rawRequest/rawResponse）。
- 已新增支付宝异步通知入口 `POST /api/payments/alipay/notify`，支持验签与结果归一化。
- 回调处理支持字段校验（out_trade_no/trade_no/total_amount）与金额一致性校验，不做到账。
- 明确：本 PR 不做最终脑细胞到账，到账由 PR-5 统一处理。


## PR-5 实施进度（Issue #95）
- 已新增 `PaymentCallbackService` 统一处理回调到账与幂等。
- 微信/支付宝/Mock success 已接入统一到账服务。
- 保持不做退款与复杂财务对账；本 PR 聚焦支付到账核心 P0。


## PR-6 实施进度（Issue #96）
- 已交付用户端最小支付闭环页面（订单确认/支付方式/微信扫码/支付结果）。
- 已交付后台支付记录与回调日志查询页面。
- 目标：支持定位付款未到账、重复到账、金额不一致、回调失败。
