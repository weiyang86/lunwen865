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
