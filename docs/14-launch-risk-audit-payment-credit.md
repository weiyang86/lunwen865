# 14 上线前重点代码审计：支付 / 脑细胞额度 / 任务扣费

> 审计日期：2026-05-20（UTC）  
> 审计范围：基于当前仓库**真实代码**，仅做分析，不改业务代码、不做迁移。

---

## 一、当前代码现状总览

## 1) 支付相关文件路径

### 后端
- `apps/api/src/modules/payment/payment.controller.ts`
- `apps/api/src/modules/payment/notify.controller.ts`
- `apps/api/src/modules/payment/payment.service.ts`
- `apps/api/src/modules/payment/providers/wechat-pay.provider.ts`
- `apps/api/src/modules/payment/providers/alipay.provider.ts`
- `apps/api/src/modules/payment/reconcile.service.ts`

### 前端
- `apps/web/app/(client)/orders/page.tsx`（当前使用沙箱模拟支付）

## 2) 订单相关文件路径

### 后端
- `apps/api/src/modules/order/order.controller.ts`
- `apps/api/src/modules/order/order.service.ts`
- `apps/api/src/modules/order/admin-order.controller.ts`
- `apps/api/src/modules/order/admin-order.service.ts`
- `apps/api/src/modules/admin/orders/orders.controller.ts`
- `apps/api/src/modules/admin/orders/orders.service.ts`
- `apps/api/src/modules/order/agency-order.controller.ts`
- `apps/api/src/modules/order/agency-order.service.ts`

### 前端
- `apps/web/app/(client)/orders/page.tsx`
- `apps/web/app/(client)/cart/page.tsx`

## 3) 商品 / 购物车相关文件路径

### 后端
- `apps/api/src/modules/product/product.controller.ts`
- `apps/api/src/modules/product/product.service.ts`

### 前端
- `apps/web/app/(client)/products/page.tsx`
- `apps/web/app/(client)/cart/page.tsx`
- `apps/web/src/lib/client/cart.ts`

## 4) 账户 / 脑细胞相关文件路径

### 后端
- `apps/api/src/modules/quota/quota.controller.ts`
- `apps/api/src/modules/quota/quota.service.ts`
- `apps/api/src/modules/quota/admin-quota.controller.ts`
- `apps/api/src/modules/quota/admin-quota.service.ts`
- `prisma/schema.prisma`（`UserQuota` / `QuotaLog` / `Product.brainCellAmount`）

### 前端
- `apps/web/app/(client)/account/page.tsx`
- `apps/web/app/(client)/orders/page.tsx`（显示脑细胞余额）

## 5) 论文任务节点相关文件路径

- 题目：`apps/api/src/modules/topic/*`
- 开题：`apps/api/src/modules/opening-report/*`
- 大纲：`apps/api/src/modules/outline/*`
- 正文：`apps/api/src/modules/writing/*`
- 任务状态：`apps/api/src/modules/task/*`
- 导出：`apps/api/src/modules/export/*`

## 6) AI 生成相关文件路径

- `apps/api/src/modules/llm/*`
- `apps/api/src/modules/topic/topic.service.ts`
- `apps/api/src/modules/opening-report/opening-report.service.ts`
- `apps/api/src/modules/outline/outline-generator.service.ts`
- `apps/api/src/modules/writing/services/writing-generator.service.ts`
- `apps/api/src/modules/reference/reference.service.ts`
- `apps/api/src/modules/polish/polish.service.ts`
- `apps/api/src/modules/polish/polish.processor.ts`

## 7) 权限校验相关文件路径

- 全局鉴权：`apps/api/src/app.module.ts`（`APP_GUARD`）
- JWT Guard：`apps/api/src/modules/auth/guards/jwt-auth.guard.ts`
- 角色 Guard：`apps/api/src/modules/auth/guards/roles.guard.ts`
- Public 装饰器：`apps/api/src/modules/auth/decorators/public.decorator.ts`
- 任务归属检查：`apps/api/src/modules/task/task.service.ts`（`assertTaskOwnership`）

---

## 二、当前支付链路分析

当前代码链路（实际实现）：

```text
商品(Product)
  -> 购物车(前端 localStorage，仅前端态)
  -> 下单 POST /orders（后端按 Product.priceCents 创建订单）
  -> 预支付 POST /payment/prepay（写入 outTradeNo/channel/method）
  -> 第三方回调 /payment/notify/wechat|alipay（或 sandbox simulate-paid）
  -> OrderService.markPaid() 事务内更新订单状态
  -> grantQuota() 发放脑细胞（quotaGranted 防重）
  -> 用户在任务/导出等场景消费额度
```

### 关键实现判断

1. **订单金额以后端商品价格为准**（不是前端传金额），有防篡改基础。  
2. **支付成功回调走后端**，不是纯前端“支付成功”即发额度。  
3. `markPaid` + `grantQuota` 在事务内执行，且 `order.quotaGranted` 防止重复发放。  
4. 订单状态枚举较完整（`PENDING/PENDING_PAYMENT/PAID/FULFILLING/COMPLETED/CANCELLED/REFUNDING/REFUNDED/CLOSED`）。  
5. 退款流程有 `Refund`、`PaymentLog`、状态更新与脑细胞回滚逻辑。  

### 仍存在的关键风险

- `transactionId` 在 `Order` 中**无唯一约束**，第三方交易号全局去重能力不足。  
- `NotifyController` 捕获异常后返回 `FAIL`，但缺统一重试策略与告警。  
- 当前前端 C 端页面主要使用 `/payment/sandbox/simulate-paid`，真实支付链路的端到端产品化不足。  

---

## 三、当前脑细胞额度链路分析

当前代码链路（实际实现）：

```text
余额来源
  = 订单支付成功后 grantQuota(PURCHASE)
  + 管理员发放 ADMIN_GRANT
  + 用户兑换脑细胞->目标额度（exchangeFromBrainCell）

额度记录
  -> UserQuota(balance,totalIn,totalOut)
  -> QuotaLog(change,balanceAfter,reason,orderId,bizId,remark)

节点生成/消费
  -> 各模块先 ensureOrExchangeFromBrainCell(...) 进行额度检查
  -> 成功时 quotaService.consume(...) 写流水并扣减

失败退回
  -> 当前仅退款链路明确回滚脑细胞
  -> AI 生成失败后的“自动退回”机制未形成统一实现

用户账单
  -> 用户可查 /quota/me 与 /quota/logs
  -> 管理员可查 /admin/quota/logs 与 stats
```

### 判断

- 有独立余额表 + 流水表，基本账务能力存在。  
- 扣减使用 `updateMany + balance>=amount`，可防止并发下扣成负数。  
- `consume` 支持 `bizId` 幂等，但**很多生成链路未传 bizId**，导致重复触发时无法统一防重。  

---

## 四、当前论文节点扣费分析

| 节点 | 当前是否扣费 | 当前扣费位置 | 是否有额度校验 | 是否有扣费流水 | 是否有失败退回 | 重复扣费风险 | 风险等级 |
|---|---|---|---|---|---|---|---|
| 选题 | 未发现明确扣费 | 未发现 | 未发现 | 未发现 | 未发现 | 中（免费刷接口风险） | P1 |
| 开题报告 | 未发现明确扣费 | 未发现 | 未发现 | 未发现 | 未发现 | 中 | P1 |
| 大纲/目录 | 未发现明确扣费 | 未发现 | 未发现 | 未发现 | 未发现 | 中 | P1 |
| 摘要 | 当前未发现独立摘要模块收费点 | 未发现 | 未发现 | 未发现 | 未发现 | 中 | P2 |
| 正文生成 | 未发现明确 consume 扣费调用（写作链路） | 未发现 | 部分阶段仅状态检查 | 未发现统一流水 | 未发现 | 高（重复生成成本失控） | P0 |
| 导出 | 有（1次 EXPORT） | `export.processor` 消费 | 有（create 前 ensure） | 有 QuotaLog | 失败退回未统一 | 中 | P1 |
| 任务创建 bootstrap | 有（1次 PAPER_GENERATION） | `task.service` | 有 | 有 QuotaLog | 失败是否补偿依赖事务边界 | 中 | P1 |
| 润色 polish | 有 | `polish.processor` consume | 有（ensureOrExchange） | 有 | 失败退回策略不统一 | 中 | P1 |

> 说明：上表严格按当前代码可见调用判断；“未发现”表示本次审计未在仓库当前实现中发现明确扣费代码，而非业务上不需要。

---

## 五、发现的问题清单（P0 / P1 / P2）

## P0（上线前必须修复）

1. **正文/核心生成链路缺统一且可审计的扣费执行点**（至少在写作链路中未看到稳定 `consume + bizId` 方案）。
2. **生成链路缺统一幂等键策略**（重复点击/重放请求可能重复扣费或重复生成）。
3. **缺统一的“生成失败扣费回滚/不扣费”规则落地**（不同模块不一致）。
4. **交易号唯一性不足**：`transactionId` 无唯一约束，支付对账与重复回调识别存在风险。

## P1（上线前建议修复）

1. 支付通知、退款通知缺统一告警与对账巡检闭环。  
2. 前端真实支付流程未产品化，仍偏沙箱调试路径。  
3. 节点扣费规则未形成统一配置中心（规则散落/缺失）。  
4. 管理后台虽可查订单与额度，但“按 runId/orderNo 一键穿透排障”能力不足。  
5. 接口限流/防刷机制未在关键生成接口明确看到。

## P2（上线后优化）

1. 账务 BI 与自助对账报表。  
2. 自动异常工单（付款成功未到账/重复扣费）联动。  
3. 更细粒度的“章节级成本核算”与可视化。

---

## 六、重点风险判断（必答）

| 风险项 | 判断 |
|---|---|
| 支付成功重复发放额度 | **部分可控**：`quotaGranted` + 事务可防重，但交易号唯一性和通知幂等仍需增强 |
| AI 生成重复扣费 | **存在风险**：幂等键未全链路统一，且多节点未统一 `bizId` |
| AI 失败后不退费 | **存在风险**：未见全链路统一“失败退回或成功后扣费”策略 |
| 用户余额可能为负数 | **基础可控**：`balance>=amount` 防并发负数；但个别逻辑若绕过该模式仍有隐患 |
| 前端参数篡改低价购买/多发额度 | **低价风险较低**：后端按 product 价格建单；但仍需加强服务端字段白名单与签名检查 |
| 用户越权访问他人任务 | **多数接口已校验**：大量使用 `assertTaskOwnership`；仍需做全量接口清单回归 |
| 后台无法追溯账务问题 | **部分可追溯**：有订单/支付日志/额度日志；但缺统一关联键与排障视图 |

---

## 七、推荐目标设计（最小可行）

> 不是大重构，而是上线可用的目标形态。

1. **Order**
   - 保留现有模型，强化状态流转约束。
   - 增加 `paymentConfirmedAt`（可选）用于对账定位。

2. **PaymentRecord（可映射现有 PaymentLog + Order 支付字段）**
   - 强制唯一：`outTradeNo`、`transactionId(非空时唯一)`。
   - 明确事件：prepay/notify/query/refund。

3. **BrainCellBalance（现有 UserQuota）**
   - `@@unique(userId, quotaType)` 保持。
   - 所有变更必须经服务层事务。

4. **BrainCellLedger（现有 QuotaLog）**
   - 强制每次消费写 `bizId`（节点+taskId+runId）。
   - 保留 `orderId`、`reason`、`balanceAfter`。

5. **AiGenerationRun（建议新增，当前未发现）**
   - 字段：`runId/taskId/stage/status/model/inputHash/outputHash/error/tokenUsage/costQuota`。
   - 与 QuotaLog 通过 `bizId=runId` 关联。

6. **ThesisTaskStage（现有 TaskStatus/TaskStage）**
   - 状态推进与扣费动作绑定（状态机 hook）。

7. **IdempotencyKey（建议新增）**
   - 支持支付回调、生成请求、重试请求。
   - 唯一键：`scope + key`。

8. **CreditRule（建议新增配置）**
   - 每节点扣费规则：是否扣费、扣费时机（提交前/成功后）、失败是否退回。

---

## 八、最小上线修复方案（不做过度设计）

## 1) 支付成功如何安全发放脑细胞

- 仅以**支付回调验签成功**或主动查单成功作为发放触发。  
- `markPaid` 事务内：状态更新 + `quotaGranted` 原子置位 + `QuotaLog(PURCHASE)`。  
- 增加 `transactionId` 唯一约束（后续迁移任务）。  
- 重复回调直接幂等返回 success，不重复发放。

## 2) AI 生成如何安全扣减脑细胞

- 统一在“生成 run 创建”处执行额度校验。  
- 统一在“run 成功”时执行 `consume`（或先冻结后结算，二选一）。  
- 所有消费必须带 `bizId=runId`。

## 3) 生成失败如何退回或不扣费

- 建议最小方案：**成功后扣费**（失败不扣费），减少退费复杂度。  
- 若已先扣费，则失败必须补一条 `REFUND/ROLLBACK` 流水并回补余额。

## 4) 重复点击和重复回调如何幂等

- 前端按钮防抖只是辅助手段，核心在后端：  
  - 支付回调：`outTradeNo + transactionId` 幂等。  
  - 生成请求：`Idempotency-Key` 或 `runId` 幂等。  
  - `quotaService.consume` 必传 `bizId`。

## 5) 后台如何查询账务流水

- 管理后台增加“订单号/交易号/runId 一键串联”查询：  
  - Order -> PaymentLog -> QuotaLog -> GenerationRun。  
- 优先保证投诉场景三类定位：  
  - 付款未到账、重复扣费、生成失败扣费。

---

## 九、后续 GitHub Issue 拆分建议

### Issue 1
- **标题**：`fix(payment): enforce notify idempotency and transaction uniqueness`
- **问题背景**：支付回调虽有基础幂等，但交易号唯一与对账约束不足。
- **目标**：确保重复回调不重复发额度，交易号可全局追踪。
- **涉及文件**：`payment.service.ts`、`notify.controller.ts`、`order.service.ts`、`prisma/schema.prisma`
- **实现内容**：补唯一约束与幂等检查、失败告警。
- **验收标准**：同一回调重复 10 次只发放一次。
- **本地验证**：脚本重复调用 notify，检查 `quotaLog` 仅一条 PURCHASE。
- **风险等级**：P0

### Issue 2
- **标题**：`feat(quota): require bizId for all generation consumption`
- **背景**：扣费幂等依赖 bizId，但当前未统一。
- **目标**：所有生成扣费必须带 bizId。
- **涉及文件**：`quota.service.ts`、`topic/opening/outline/writing/export/polish` 服务层。
- **实现内容**：统一扣费适配器。
- **验收标准**：重复请求不重复扣费。
- **本地验证**：并发同一 runId 调用，仅扣一次。
- **风险等级**：P0

### Issue 3
- **标题**：`feat(ai-billing): define success-charge policy for thesis stages`
- **背景**：节点扣费规则不统一。
- **目标**：明确“成功扣费、失败不扣”并落地。
- **涉及文件**：任务/题目/开题/大纲/正文服务。
- **实现内容**：统一策略与日志。
- **验收标准**：失败不产生消费流水。
- **本地验证**：模拟 LLM 超时/异常。
- **风险等级**：P0

### Issue 4
- **标题**：`feat(audit): add generation run ledger for complaint tracing`
- **背景**：账务链路缺 run 级追踪。
- **目标**：可按 runId 追溯输入/输出/扣费。
- **涉及文件**：`llm` 与各生成模块、后台查询接口。
- **实现内容**：新增 run 记录与关联查询。
- **验收标准**：可定位“失败但扣费”投诉。
- **本地验证**：手工跑一条生成 + 查询。
- **风险等级**：P1

### Issue 5
- **标题**：`feat(admin): finance troubleshooting console`
- **背景**：后台缺一站式账务排障。
- **目标**：支持 orderNo/transactionId/runId 多维检索。
- **涉及文件**：`admin/orders`、`admin/quota`、新聚合接口。
- **实现内容**：聚合查询 + 时间线展示。
- **验收标准**：客服 3 分钟内定位问题。
- **本地验证**：构造 3 类投诉样本。
- **风险等级**：P1

---

## 十、上线前验收清单（可执行）

- [ ] 支付成功：真实回调后订单状态为 `COMPLETED/PAID`，额度只发一次。
- [ ] 支付失败：订单保持可识别失败/待支付状态，无额度发放。
- [ ] 重复回调：连续重复通知不重复发放额度。
- [ ] 余额不足：生成接口返回清晰错误，不进入生成。
- [ ] AI 生成成功：生成成功后有对应消费流水（或符合成功后扣费策略）。
- [ ] AI 生成失败：不扣费或有明确退回流水。
- [ ] 重复点击生成：同一幂等键不重复扣费。
- [ ] 正文按章节生成：章节重试不重复扣同一笔费用。
- [ ] 后台人工调整额度：有 ADMIN_GRANT/ADMIN_DEDUCT 流水和 remark。
- [ ] 用户账单查询：`/quota/logs` 可见充值/消费/退款记录。
- [ ] 管理员订单查询：可查看订单、支付日志、退款、额度变动关联。

---

## 结论（明确）

当前系统距离“可安全上线”仍缺以下 **P0 能力**：

1. **生成链路统一扣费与幂等（bizId/runId）**。  
2. **生成失败扣费一致性策略（失败不扣或自动退回）并落地**。  
3. **支付回调与交易号的强幂等/强唯一约束**。  
4. **正文等核心高成本节点的重复触发防重机制**。  

在上述 P0 未补齐前，系统存在“重复扣费 / 重复发放 / 投诉难排障”的上线风险。


## 2026-05-20 P0 修复进展（代码已落地）

- 已新增 `AiGenerationRun`（最小版）用于记录题目生成 run 状态、输入输出快照、错误信息。
- 已增强 `QuotaLog` 追踪字段（relatedTaskId / relatedStageKey / relatedGenerationRunId / idempotencyKey / balanceBefore）。
- 已在题目生成链路实现：生成成功后扣减 1 脑细胞并记录流水；生成失败标记 run 失败且不扣费。
- 已在订单支付落库环节增加 transactionId 重复占用校验，降低重复回调串单风险。
