# 05 数据模型（Data Model）

## 1. 核心实体
- User
- Agency（机构）
- AgencyStaff（机构成员，可并入 User+Membership）
- Lead（推单线索）
- Task
- Order
- Payment/PaymentLog/Refund
- Product/Category/Store
- TopicCandidate/OpeningReport/Outline/WritingSession
- TopicCandidateRevision（题目候选版本历史）
- Reference
- ExportTask
- Prompt
- Quota/QuotaLog

## 2. 字段设计初稿（摘要）
### User
- id, phone, email, password, role, status, quota, createdAt

### Agency
- id, name, code, contactName, contactPhone, status, createdAt

### AgencyMembership
- id, agencyId, userId, roleInAgency, status, createdAt

### Lead
- id, agencyId, studentName, studentPhone, major, educationLevel, status, convertedOrderId, createdAt

### Task
- id, userId, assigneeId, schoolId, status, currentStage, title, deadline

### Order
- id, userId, agencyId?, sourceType(direct/agency), status, amount, paymentChannel, taskId, createdAt

### Payment
- id, orderId, channel, method, outTradeNo, payerType(student/agency), status, paidAt

### Refund
- id, orderId, amount, status, reason, resolvedAt

## 3. 实体关系（简化）
- User 1-N Order
- Agency 1-N AgencyMembership
- Agency 1-N Lead
- Agency 1-N Order（可选）
- User 1-N Task
- Order 1-0..1 Task
- Task 1-N Topic/Opening/Writing/Reference
- Task 1-N AdminLog

## 4. 后续需要确认的数据
- Agency 与 User 的绑定方式（独立账号还是复用 User）。
- 机构代下单的支付主体、合同主体、发票主体。
- Order 与 Task 的强绑定策略（是否允许一个订单多任务）。
- 退款与配额回滚的一致性规则。
- 导出文件保存周期、存储位置与清理策略。

### 补充（2026-05-20）
- 新增 `AiGenerationRun`：用于记录 AI 生成执行与扣费关联。
- `QuotaLog` 新增追踪字段：`relatedTaskId`、`relatedStageKey`、`relatedGenerationRunId`、`idempotencyKey`、`balanceBefore`。

### 补充（2026-05-25）
- 新增 `TopicCandidateRevision`：用于记录题目候选的版本历史（AI 生成、自定义选定、导师意见更改、手动更改）。

### 补充（2026-06-03）：订单支付有效期
- 订单支付有效期复用现有 `Order.expiresAt` 字段，不新增 Prisma 字段；对外接口使用 `expiredAt` 作为兼容别名返回同一时间。
- 默认支付有效期为 10 分钟，可通过 `ORDER_PAYMENT_TTL_MINUTES` 调整；旧变量 `ORDER_EXPIRE_MINUTES` 仅作为兼容兜底。
- 待支付订单超时后按现有 `OrderStatus.CLOSED` 落库，并在支付状态接口/前端展示为 `EXPIRED / 已过期`。
- 只有渠道异步通知验签成功或主动查单确认支付成功，且支付成功时间不晚于 `expiresAt`，才允许进入统一结算；未支付或超时订单不得发放脑细胞。
