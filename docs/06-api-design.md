# 06 接口设计（API Design）

## 1. 接口分组
- Auth：登录注册、刷新、登出
- User：个人信息、绑定、配额
- Agency：机构信息、成员、权限
- Lead：机构推单线索
- Product/Store/Category：商品域
- Order：下单、查询、售后
- Payment：预支付、回调、退款
- Task：任务流转与详情
- Admin：用户/订单/任务/仪表盘
- Prompt：提示词资产
- Export/Reference/Writing：论文生产子域

## 2. 核心接口清单（示例）
### 通用
- `POST /api/auth/login`
- `GET /api/auth/me`

### C 端
- `POST /api/orders`
- `GET /api/orders/me`
- `GET /api/tasks/:id`
- Topic（选题）
  - `POST /api/tasks/:taskId/topics/generate`
  - `POST /api/tasks/:taskId/topics/regenerate`
  - `POST /api/tasks/:taskId/topics/custom-select`（题目已确定，直接选定）
  - `PATCH /api/tasks/:taskId/topics/:candidateId`（更改候选题目，写入版本历史）
  - `GET /api/tasks/:taskId/topics/:candidateId/revisions`（查询版本历史）

### B 端（机构）
- `GET /api/agency/me`
- `POST /api/agency/leads`
- `GET /api/agency/leads`
- `POST /api/agency/orders`
- `GET /api/agency/orders`

### 管理端
- `GET /api/admin/orders`
- `POST /api/admin/orders/:id/refunds`
- `GET /api/admin/tasks`（支持 query: `bizType=CONSUMER|AGENCY`，用于区分散客任务与机构任务）
- `POST /api/payment/prepay`
- `POST /api/payment/notify/*`

## 3. 请求参数规范
- Query：分页统一 `page/pageSize`，时间统一 ISO8601。
- Body：创建类接口必须校验必填字段；状态变更需 `reason`。
- Header：统一 `Authorization: Bearer <token>`。
- 机构接口必须带机构归属上下文（从 token 解析，不允许前端伪造）。

## 4. 返回结构规范
建议统一 envelope：
```json
{ "code": 0, "message": "ok", "data": {} }
```

## 5. 错误处理规范
- 4xx：客户端参数/权限问题
- 5xx：服务端异常
- 业务错误码：按模块分段（AUTH_*, AGENCY_*, ORDER_*, TASK_*）
- 所有错误需包含：`code`, `message`, `requestId`（建议）

## 6. 需要人工确认
- 是否已全量统一返回 envelope（当前前端有兼容逻辑，但需接口核对）。
- 机构推单与代下单的权限边界与审批流。
- 支付回调验签失败的错误码与重试策略。

### P0 增补接口/数据约定（2026-05-20）
- 额度流水补充追踪字段：`relatedTaskId`、`relatedStageKey`、`relatedGenerationRunId`、`idempotencyKey`、`balanceBefore`。
- 新增 AI 生成运行记录：`AiGenerationRun`（记录 stage/action/status/cost/input/output/error）。


### Payment PR-2（Issue #92）
- 新增 `POST /api/payments/create`，支持 channel: `mock|wechat|alipay`，method: `mock|native|h5|page|wap`。
- Issue #108 后：`wechat/alipay` 在配置完整时可发起真实预支付；`mock` 仍仅用于开发调试。
- 支付金额以后端订单 `totalAmount/amountCents` 为准，不信任前端。
- 新增 mock 驱动接口：`POST /api/payments/mock/success`、`POST /api/payments/mock/fail`（仅 development）。
