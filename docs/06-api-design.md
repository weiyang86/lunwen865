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

### Payment PR-3（Issue #109）
- 新增 `GET /api/orders/:id/payment-status`，用于支付结果页/轮询页查询订单支付状态。
- 支付成功后订单状态先更新为 `PAID`，不再直接更新为 `COMPLETED`；履约完成后再进入 `COMPLETED`。

### Payment PR-4（Issue #111）
- `POST /api/payments/wechat/notify`：微信支付回调按「验签 -> 解密 -> 金额校验 -> 结算」处理。
- 结算成功后会调用订单 `markPaid`，并写入 `PaymentLog.NOTIFY` 与回调审计日志。

### Payment PR-5（Issue #113）
- `POST /api/payment/notify/alipay`：支付宝异步通知按「验签 -> 状态判断 -> 金额校验 -> 结算」处理。
- 对非成功状态、金额不一致、订单不存在等分支写入 `PaymentCallbackLog`，结算成功写入 `PaymentLog.NOTIFY` 并调用订单 `markPaid`。

## 支付状态与 mock 权限补充（fix/payment-ui）

### GET /api/orders/:id/payment-status

- 鉴权：必须登录。
- 权限：普通用户仅可查询自己的订单；`ADMIN` / `SUPER_ADMIN` 可查询任意订单。
- 用途：微信 Native 扫码后前端轮询该接口，支付成功以后端订单状态为准，不以前端跳转结果为准。
- 返回字段：
  - `orderId`、`orderNo`
  - `orderStatus`：订单状态。
  - `paymentStatus`：支付归一状态，已支付时为 `PAID`。
  - `paid`、`paidAt`
  - `paidAmountCents`、`channel`、`method`、`outTradeNo`、`transactionId`、`expiresAt`
  - `taskId`
  - `redirectUrl`：站内相对路径；关联任务时为 `/tasks?taskId=...`，纯脑细胞购买为 `/account`，兜底 `/orders`。
  - `brainCellBalance`：该订单所属用户的脑细胞余额。

### mock / sandbox 支付接口权限

- `POST /api/payments/mock/success`
- `POST /api/payments/mock/fail`
- `POST /api/payment/sandbox/simulate-paid`

以上接口仅允许 `development` / `test` 环境中的 `ADMIN` / `SUPER_ADMIN` 使用；普通用户直接调用必须返回 `403`。生产环境不得使用 mock / sandbox 支付入账接口。

## 支付宝 Page/Wap 正式支付（fix-payment-alipay）

- `POST /api/payments/create` 当 `channel=alipay` 时仅支持真实支付宝跳转能力，不再返回 `mock-page-pay`：
  - PC 端传 `method=page`，后端调用 `alipay.trade.page.pay`，`product_code=FAST_INSTANT_TRADE_PAY`。
  - 手机浏览器传 `method=wap`，后端调用 `alipay.trade.wap.pay`，`product_code=QUICK_WAP_WAY`。
  - 返回体优先包含 `payUrl/paymentUrl`；若后续 SDK 返回表单 HTML，前端按受信后端响应提交表单，不以 `return_url` 作为支付成功依据。
- `POST /api/payments/alipay/notify` 为支付宝异步通知入口，兼容旧入口 `POST /api/payment/notify/alipay`；生产环境 `ALIPAY_NOTIFY_URL` 应配置为 `/api/payments/alipay/notify`。
  - 通知处理必须使用支付宝公钥验签，校验 `out_trade_no`、`trade_no`、`total_amount`、`trade_status`、`app_id` 与可选 `seller_id`。
  - 仅 `TRADE_SUCCESS` / `TRADE_FINISHED` 归一化为支付成功，成功后调用统一 `PaymentCallbackService` 做幂等到账。
  - 验签失败、金额不一致或支付记录不存在不得入账，并写入 `PaymentCallbackLog`。
- `POST /api/payment/orders/:orderId/status/refresh` 与 `POST /api/orders/:orderId/payment-status/refresh` 主动查单；支付宝订单通过 `alipay.trade.query` 归一化后走同一 `PaymentCallbackService`，重复查单不重复到账。

### Alipay SDK 初始化兼容说明（fix AlipayCtor）

- 后端初始化 `alipay-sdk` 时兼容 `module.AlipaySdk`、`module.default.AlipaySdk`、`module.default` 三种导出形态；若无法解析构造函数，仅返回安全的 export key 诊断信息，不输出应用私钥或支付宝公钥内容。

## 支付有效期与状态接口补充（fix-payment-expiry）

### 订单支付有效期

- 新建订单默认 `expiresAt = createdAt + 10 分钟`，配置项为 `ORDER_PAYMENT_TTL_MINUTES`，默认值 10。
- `POST /api/payments/create` 仅允许 `pending/PENDING_PAYMENT` 且未过期订单发起支付；已过期返回“订单已过期，请重新下单”，已支付订单直接返回已支付状态，不重新拉起渠道支付。
- `alipay.return_url` 仅用于前端回到结果页，不直接改变订单状态；支付宝入账只能来自验签成功的异步通知或主动查单确认 `TRADE_SUCCESS / TRADE_FINISHED`。

### `GET /api/orders/:id/payment-status`

返回新增/统一字段：

```json
{
  "orderId": "xxx",
  "orderNo": "PAYxxx",
  "orderStatus": "PENDING | PAID | EXPIRED | CANCELLED",
  "paymentStatus": "PENDING | SUCCEEDED | CLOSED",
  "paid": false,
  "expired": false,
  "canPay": true,
  "expiredAt": "2026-06-02T00:10:00.000Z",
  "remainingSeconds": 520,
  "paidAt": null,
  "taskId": null,
  "redirectUrl": "/account",
  "message": "待支付"
}
```

- 普通用户只能查询自己的订单，管理员可查询任意订单。
- 若订单仍为待支付且当前时间超过 `expiresAt`，接口会懒标记为 `EXPIRED/CLOSED` 并返回 `expired=true`、`canPay=false`。
- `POST /api/orders/:id/payment-status/refresh` 会先尝试支付渠道主动查单；渠道未确认成功时，超时订单会被标记为已过期。

### 支付倒计时 UI 展示补充（fix-payment-expiry-ui）

- 用户订单列表 `GET /api/orders` / `GET /api/orders/my` 返回的每个订单应包含 `expiredAt`、`remainingSeconds`、`expired`、`canPay`、`paid`、`orderStatus`、`paymentStatus`。
- 前端展示倒计时必须以后端 `expiredAt` / `remainingSeconds` 为准，并将大小写不同的 `pending/PENDING`、`expired/EXPIRED` 等状态归一化后展示。
- 订单列表和支付弹框中，只有归一化后 paid/succeeded/completed 的订单可以显示“已完成”；`pending/cancelled/expired/closed` 不得显示“已完成”。

## 微信 ORDERPAID 主动查单结算（fix-payment-wechat）

- `POST /api/payment/prepay` / `POST /api/payments/create` 在微信 Native 下单遇到 `ORDERPAID` 时，不再把该错误直接透传给前端；后端会使用同一个 `outTradeNo/providerOrderNo` 调用微信查单。
- `POST /api/orders/:id/payment-status/refresh` 与 `POST /api/payment/orders/:id/status/refresh` 会在本地订单未 paid 时主动读取最新支付记录/订单 `outTradeNo`，对微信订单调用查单；仅 `trade_state=SUCCESS` 会进入统一 `PaymentCallbackService` 结算。
- 微信查单归一化字段包括 `channel=wechat`、`providerOrderNo`、`providerTradeNo/transaction_id`、`amount`、`paidAt`、`tradeStatus`、`success`、`raw`；`NOTPAY/USERPAYING/CLOSED/PAYERROR` 均不入账。
- `refresh/prepay` 若查单成功并完成结算，返回 `paid=true`、`paymentStatus=SUCCEEDED` 和站内 `redirectUrl`；若微信提示已支付但查单未成功，返回 `paid=false` 与明确 message，前端继续提示用户稍后刷新。

## 论文交付工作台升级建议 API（规划）

> 本节为后续 Issue 的接口契约草案。当前不要求一次性实现，落地时需保持现有订单、支付、任务、导出接口兼容。

### Academic Data：学术基础数据
#### C/B/管理通用查询
- `GET /api/academic/provinces`
  - Query：`keyword?`, `status?`
  - 返回：省份列表。
- `GET /api/academic/cities?provinceId=...`
  - 返回：城市列表。
- `GET /api/academic/universities`
  - Query：`provinceId?`, `cityId?`, `keyword?`, `page`, `pageSize`
  - 返回：高校分页列表。
- `GET /api/academic/universities/:id/colleges`
  - 返回：高校下学院/系列表。
- `GET /api/academic/disciplines/categories`
  - 返回：学科门类列表。
- `GET /api/academic/disciplines/first-level?categoryId=...`
  - 返回：一级学科列表。
- `GET /api/academic/majors`
  - Query：`firstLevelId?`, `universityId?`, `collegeId?`, `keyword?`, `page`, `pageSize`
  - 返回：专业/二级学科列表。

#### 管理端维护
- `POST /api/admin/academic/provinces`
- `PATCH /api/admin/academic/provinces/:id`
- `POST /api/admin/academic/cities`
- `PATCH /api/admin/academic/cities/:id`
- `POST /api/admin/academic/universities`
- `PATCH /api/admin/academic/universities/:id`
- `POST /api/admin/academic/universities/:id/colleges`
- `PATCH /api/admin/academic/colleges/:id`
- `POST /api/admin/academic/disciplines/categories`
- `PATCH /api/admin/academic/disciplines/categories/:id`
- `POST /api/admin/academic/disciplines/first-level`
- `PATCH /api/admin/academic/disciplines/first-level/:id`
- `POST /api/admin/academic/majors`
- `PATCH /api/admin/academic/majors/:id`
- `POST /api/admin/academic/import`
  - 用途：批量导入学校、学院、专业。
  - 要求：必须返回成功数、失败数、失败行原因；不得静默丢弃错误。

### Task Academic Profile：任务学术上下文
- `GET /api/tasks/:taskId/academic-profile`
  - 权限：任务所有者、所属机构成员、任务 assignee、管理员。
  - 返回：学校、学院、专业、学历层次、论文类型、研究方向、导师要求、格式要求。
- `PUT /api/tasks/:taskId/academic-profile`
  - Body：`provinceId?`, `cityId?`, `universityId?`, `collegeId?`, `majorId?`, `universityMajorId?`, `educationLevel`, `thesisType`, `researchDirection?`, `advisorRequirements?`, `formatRequirementText?`
  - 要求：写入快照字段；更新后记录审计日志。
- `PUT /api/admin/tasks/:taskId/academic-profile`
  - 管理端纠偏接口，可修改任意任务但必须提交 `reason`。
- `PUT /api/agency/tasks/:taskId/academic-profile`
  - 机构端仅允许修改所属机构任务，并受任务状态限制。

### Thesis Skill：论文 Skill 中心
#### 管理端
- `GET /api/admin/thesis-skills`
  - Query：`stage?`, `status?`, `keyword?`, `page`, `pageSize`。
- `POST /api/admin/thesis-skills`
  - Body：`code`, `name`, `description?`, `stage`。
- `PATCH /api/admin/thesis-skills/:id`
- `POST /api/admin/thesis-skills/:id/versions`
  - Body：`version`, `inputSchema`, `outputSchema`, `qualityRules`, `modelConfig`, `promptRefId?`, `releaseNote?`。
- `POST /api/admin/thesis-skill-versions/:versionId/publish`
- `POST /api/admin/thesis-skill-versions/:versionId/disable`
- `POST /api/admin/thesis-skill-versions/:versionId/scopes`
  - Body：学历层次、论文类型、学校、专业、阶段、优先级等适用范围。

#### 运行与查询
- `POST /api/tasks/:taskId/skills/:stage/run`
  - Body：`skillVersionId?`, `input`, `idempotencyKey`。
  - 返回：`skillRunId`, `status`, `estimatedCost?`。
  - 要求：如不传 `skillVersionId`，后端按任务上下文和 Scope 匹配；必须写入运行记录。
- `GET /api/tasks/:taskId/skill-runs`
  - Query：`stage?`, `status?`。
- `GET /api/admin/skill-runs/:id`
  - 管理端排障查看输入摘要、输出摘要、质量检查结果和错误信息；敏感字段需脱敏。

### Thesis Workbench：论文文档工作台
- `GET /api/tasks/:taskId/workbench`
  - 返回：任务基础信息、学术上下文、阶段文档列表、当前阶段、合规提示、可用导出模板摘要。
- `GET /api/tasks/:taskId/documents`
  - Query：`stage?`。
- `POST /api/tasks/:taskId/documents`
  - Body：`stage`, `title`, `source?`。
- `GET /api/tasks/:taskId/documents/:documentId`
  - 返回：文档元信息、章节树、当前版本、导师意见状态。
- `POST /api/tasks/:taskId/documents/:documentId/chapters`
  - Body：`parentId?`, `title`, `content?`, `sortOrder?`。
- `PATCH /api/tasks/:taskId/documents/:documentId/chapters/:chapterId`
  - Body：`title?`, `content?`, `sortOrder?`, `status?`, `expectedVersion`。
  - 要求：使用乐观锁或更新时间校验，避免覆盖他人修改。
- `POST /api/tasks/:taskId/documents/:documentId/merge`
  - 用途：按大纲/章节内容生成合稿。
- `POST /api/tasks/:taskId/documents/:documentId/versions`
  - Body：`source`, `changeSummary?`。
- `GET /api/tasks/:taskId/documents/:documentId/versions`
- `POST /api/tasks/:taskId/documents/:documentId/versions/:versionId/rollback`
  - Body：`reason`。

### Advisor Revision：导师意见修改记录
- `POST /api/tasks/:taskId/advisor-revisions`
  - Body：`documentId?`, `chapterId?`, `advisorComment`, `attachments?`。
- `GET /api/tasks/:taskId/advisor-revisions`
  - Query：`status?`, `documentId?`。
- `POST /api/tasks/:taskId/advisor-revisions/:id/resolve`
  - Body：`changeSummary`, `afterSnapshot?`, `documentVersionId?`。
- `POST /api/tasks/:taskId/advisor-revisions/:id/reopen`
  - Body：`reason`。

### Format Template：格式模板引擎
#### 管理端
- `GET /api/admin/format-templates`
  - Query：`type?`, `stage?`, `status?`, `universityId?`, `majorId?`, `page`, `pageSize`。
- `POST /api/admin/format-templates`
  - Body：`code`, `name`, `type`, `stage?`, `formatRules`, `fileTemplateUrl?`, `description?`。
- `PATCH /api/admin/format-templates/:id`
- `POST /api/admin/format-templates/:id/scopes`
- `POST /api/admin/format-templates/:id/disable`
- `POST /api/admin/format-templates/parse-requirements`
  - Body：`formatRequirementText`, `taskId?`。
  - 返回：`formatRequirementJson`, `confidence`, `unresolvedItems`。

#### 导出接入
- `GET /api/tasks/:taskId/export-templates`
  - Query：`stage?`。
  - 返回：按优先级排序的可用模板，标记默认模板。
- `POST /api/tasks/:taskId/exports`
  - Body 扩展：`documentVersionId`, `stage`, `templateId?`, `formatRequirementText?`, `formatRequirementJson?`, `format`。
  - 要求：保留旧导出参数兼容；新参数存在时以文档版本和模板规则生成导出任务。

### Compliance：合规提示与引用核验
- `GET /api/tasks/:taskId/compliance-notices`
- `POST /api/tasks/:taskId/compliance-notices/:noticeId/acknowledge`
- `GET /api/tasks/:taskId/references/verification-summary`
  - 返回：已核验、待核验、缺失字段、疑似伪造风险项数量。

### 权限与错误码补充
- 学生端仅能访问自己的任务工作台。
- 机构端仅能访问所属机构订单/任务，并且不能跨机构读取学校模板中的非公开配置。
- 管理端高危动作（回滚版本、禁用模板、发布 Skill）必须写审计日志。
- 新增错误码建议：`ACADEMIC_*`, `SKILL_*`, `WORKBENCH_*`, `FORMAT_TEMPLATE_*`, `COMPLIANCE_*`。

## Academic-01 学术基础数据接口（Issue #137 已实现）

### 公开查询 API（用于论文任务创建表单联动）
- `GET /api/academic/provinces`：查询启用省份。
- `GET /api/academic/cities?provinceId=`：按省份查询启用城市。
- `GET /api/academic/schools?provinceId=&cityId=&keyword=&page=&pageSize=`：查询启用高校。
- `GET /api/academic/colleges?schoolId=&page=&pageSize=`：按高校查询启用学院。
- `GET /api/academic/majors?schoolId=&collegeId=&educationLevel=&keyword=&page=&pageSize=`：按高校/学院/学历层次查询启用专业。
- `GET /api/academic/disciplines/categories`：查询启用学科门类。
- `GET /api/academic/disciplines/level-ones?categoryId=`：按门类查询启用一级学科。
- `GET /api/academic/disciplines/level-twos?levelOneId=`：按一级学科查询启用二级学科/具体专业。

### 后台管理 API
- 高校：`GET /api/admin/academic/schools`、`POST /api/admin/academic/schools`、`PATCH /api/admin/academic/schools/:id`、`DELETE /api/admin/academic/schools/:id`。
- 学院：`GET /api/admin/academic/colleges`、`POST /api/admin/academic/colleges`、`PATCH /api/admin/academic/colleges/:id`、`DELETE /api/admin/academic/colleges/:id`。
- 专业：`GET /api/admin/academic/majors`、`POST /api/admin/academic/majors`、`PATCH /api/admin/academic/majors/:id`、`DELETE /api/admin/academic/majors/:id`。
- 学科目录：`GET /api/admin/academic/disciplines`、`POST/PATCH/DELETE /api/admin/academic/disciplines/categories`、`POST/PATCH/DELETE /api/admin/academic/disciplines/level-ones`、`POST/PATCH/DELETE /api/admin/academic/disciplines/level-twos`。
- `DELETE` 接口为软禁用，实际将 `status` 更新为 `INACTIVE`；重新启用通过对应 `PATCH` 接口传 `status=ACTIVE`。
