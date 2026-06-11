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

## Skill-01 论文 Skill 中心接口（Issue #138 已实现）

### Skill 管理 API（后台）
- `GET /api/admin/thesis-skills`：按 `keyword`、`stage`、`status` 分页查询 Skill。
- `POST /api/admin/thesis-skills`：创建 Skill。
- `GET /api/admin/thesis-skills/:id`：查询 Skill 详情，包含版本与绑定摘要。
- `PATCH /api/admin/thesis-skills/:id`：更新 Skill。
- `DELETE /api/admin/thesis-skills/:id`：软禁用 Skill（`status=DISABLED`）。

### Skill 版本 API
- `GET /api/admin/thesis-skills/:id/versions`：查询 Skill 版本列表。
- `POST /api/admin/thesis-skills/:id/versions`：创建 Skill 版本，可传 `isActive=true` 直接激活。
- `GET /api/admin/thesis-skills/versions/:versionId`：查询版本详情。
- `PATCH /api/admin/thesis-skills/versions/:versionId`：更新版本。
- `POST /api/admin/thesis-skills/versions/:versionId/activate`：激活版本；服务端会先取消同 Skill 下其它 active 版本。

### Skill 绑定 API
- `GET /api/admin/thesis-skills/:id/bindings`：查询 Skill 适用范围绑定。
- `POST /api/admin/thesis-skills/:id/bindings`：创建适用范围绑定。
- `PATCH /api/admin/thesis-skills/bindings/:bindingId`：更新绑定。
- `DELETE /api/admin/thesis-skills/bindings/:bindingId`：软禁用绑定。

### Skill 测试运行与运行记录 API
- `POST /api/admin/thesis-skills/:id/test-run`：传入 `inputPayload`、阶段、学历层次、论文类型、学校/专业/学科条件，服务端匹配版本并生成 mock-preview 运行记录。
- `GET /api/admin/thesis-skills/runs`：按 `skillId`、`stage`、`status` 分页查询运行记录。
- `GET /api/admin/thesis-skills/runs/:id`：查询运行记录详情，包含输入、输出、质量检查、模型信息、token 估算和错误信息。

### Skill 匹配规则
- 首期 `resolveBestSkill` 根据 stage、educationLevel、thesisType、schoolId、majorId、disciplineCategoryId、disciplineLevelOneId、disciplineLevelTwoId 过滤可用绑定。
- 匹配优先级：具体学校/专业/学科/学历/论文类型越多越优先；`priority` 越高越优先；无绑定命中时回退到对应 stage 的启用 Skill active 版本。

## Task-01 论文任务学术上下文接口（Issue #139 已实现）

### 学生端任务接口
- `POST /api/tasks/bootstrap`：在原 `title`、`topic`、`major`、`educationLevel`、`wordCountTarget` 基础上，新增可选 `provinceId`、`cityId`、`academicSchoolId`、`collegeId`、`majorId`、`disciplineCategoryId`、`disciplineLevelOneId`、`disciplineLevelTwoId`、`thesisType`、`researchDirection`、`advisorRequirement`、`formatTemplateId`。
- `POST /api/tasks`：支持同样学术上下文字段；若传入 `majorId` 且未传学科字段，服务端会从 `AcademicMajor` 自动带出学科门类、一级学科和二级学科。
- `PATCH /api/tasks/:id`：支持更新学术上下文字段、学历层次、研究方向和导师要求；旧任务缺失 Academic 字段不影响更新 title、topic、wordCountTarget。
- `GET /api/tasks/:id`、`GET /api/tasks/:id/detail`：返回 `academicContext`、`schoolName`、`majorName`、`disciplineCategoryName`、`disciplineLevelOneName`、`disciplineLevelTwoName` 以及关联对象摘要。

### 后台任务接口
- `GET /api/admin/tasks`：列表返回 `schoolName`、`majorName`、`educationLevel`、`thesisType`，并支持 `academicSchoolId`、`majorId`、`educationLevel`、`thesisType` 筛选。
- `PATCH /api/admin/tasks/:id/academic-context`：后台维护任务学术上下文，支持 Academic 高校、学院、专业、学科、学历层次、论文类型、研究方向、导师要求、格式模板 ID。
- 兼容说明：API 入参采用 `academicSchoolId` 表示 Academic-01 高校；`Task.schoolId` 仍代表 legacy `School`，保留给历史导出模板和旧任务兼容。

### AI / Skill 上下文
- `TaskService.buildGenerationContext(taskId, stage?, userRequirement?)` 返回统一 `ThesisGenerationContext`：`taskId`、`taskTitle`、地区/学校/学院/专业/学科名称、`educationLevel`、`thesisType`、`stage`、`researchDirection`、`advisorRequirement`、`userRequirement`。
- 后续 Task/AI 接入 Skill-01 时，应将该上下文映射给 `resolveBestSkill` 的 stage、educationLevel、thesisType、schoolId、majorId、disciplineCategoryId、disciplineLevelOneId、disciplineLevelTwoId 条件。

## Workbench-01 论文文档工作台接口（Issue #140 已实现）

### 学生端文档 API
- `GET /api/thesis-tasks/:taskId/document`：查询任务文档，返回任务学术上下文摘要、文档基础信息、章节树、导师意见；无文档时返回 `document=null`、`canInit=true`。
- `POST /api/thesis-tasks/:taskId/document/init`：初始化任务主文档；已有文档时直接返回已有文档，避免重复创建。
- `PATCH /api/thesis-documents/:documentId`：更新文档标题、摘要、关键词、状态。
- `POST /api/thesis-documents/:documentId/sections`：新增章节，支持 `parentId`、`sectionType`、`title`、`content`、`sortOrder`、`level`、`sourceStage`、`sourceGenerationRunId`。
- `PATCH /api/thesis-document-sections/:sectionId`：保存章节标题、类型、内容、排序、层级；内容变化时生成 revision、递增 `currentVersion` 并重算字数。
- `DELETE /api/thesis-document-sections/:sectionId`：软删除章节；首期会同时软删除直接子章节并重算文档字数。
- `POST /api/thesis-documents/:documentId/merge-stage-content`：合并阶段内容，支持 `stage`、`generationRunId`、`mode=APPEND|REPLACE_SECTION|SMART_MERGE`、`sectionId`；`SMART_MERGE` 首期按追加降级。
- `GET /api/thesis-documents/:documentId/revisions`：分页查询修改记录，支持 `sectionId` 筛选。
- `POST /api/thesis-documents/:documentId/advisor-comments`：新增导师修改要求，可绑定章节。
- `PATCH /api/thesis-advisor-comments/:commentId`：更新导师意见文本或状态，支持 `RESOLVED`、`IGNORED`。

### 后台文档 API
- `GET /api/admin/thesis-documents/tasks/:taskId`：管理员/导师查看任务论文文档基础信息、章节树和导师意见。
- `GET /api/admin/tasks/:id`：任务详情同步返回 `thesisDocument` 摘要，便于后台判断是否已初始化、文档字数、版本、最近更新时间和意见数量。

### 权限与兼容
- 学生端接口通过任务归属校验，学生只能访问自己的任务文档。
- 后台接口使用 `JwtAuthGuard + RolesGuard`，允许 `ADMIN`、`SUPER_ADMIN`、`TUTOR` 查看。
- 原 `/downloads` 下载页面保留，工作台导出按钮首期跳转下载中心；Export-01 再接入结构化文档导出。

## Export-01 论文格式模板与导出 API（Issue #141 已实现）

### 后台格式模板 API
- `GET /api/admin/thesis-format-templates`：分页查询模板，支持 `keyword`、`schoolId`、`collegeId`、`majorId`、`educationLevel`、`thesisType`、`stage`、`status`。
- `POST /api/admin/thesis-format-templates`：创建格式模板。
- `GET /api/admin/thesis-format-templates/:id`：查看模板详情与规则。
- `PATCH /api/admin/thesis-format-templates/:id`：更新模板基础信息、适用范围、默认状态、版本和启停状态。
- `DELETE /api/admin/thesis-format-templates/:id`：软禁用模板，保留历史导出关联。

### 后台模板规则 API
- `GET /api/admin/thesis-format-templates/:id/rules`：查询模板规则。
- `POST /api/admin/thesis-format-templates/:id/rules`：新增模板规则，`ruleValue` 为 Json。
- `PATCH /api/admin/thesis-format-rules/:ruleId`：更新规则类型、key、Json 值、说明和排序。
- `DELETE /api/admin/thesis-format-rules/:ruleId`：删除规则。

### 学生端导出 API
- `GET /api/thesis-tasks/:taskId/export-options`：返回任务摘要、文档状态、可导出阶段、可导出格式、匹配模板、默认模板和告警；无 `ThesisDocument` 时 `canExport=false`。
- `POST /api/thesis-tasks/:taskId/export-jobs`：创建新版导出任务；DOCX 会从论文文档章节树生成 Word 文件；PDF 首期返回“PDF 导出将在后续版本开放”。
- `GET /api/thesis-export-jobs/:jobId`：查询导出任务状态、进度、文件信息和失败原因。
- `GET /api/thesis-export-jobs/:jobId/download`：下载生成文件，校验任务归属，不暴露服务器绝对路径。
- `GET /api/thesis-tasks/:taskId/export-jobs`：查询当前任务新版导出历史。

### 后台导出任务 API
- `GET /api/admin/thesis-export-jobs`：分页查询新版导出任务，支持状态、用户、任务、阶段筛选。
- `GET /api/admin/thesis-export-jobs/:id`：查看导出任务详情、模板、文档、用户和文件记录。
- `POST /api/admin/thesis-export-jobs/:id/retry`：重试失败导出任务。

### 兼容说明
- 旧版 `/api/export`、`/api/export/:id/download` 和 `ExportTask` 不删除，下载中心继续展示旧版下载记录。
- 新版导出中心默认使用 `ThesisDocument`，后续 Export-02 可扩展 PDF 真实导出、模板 DOCX 上传、自动目录、页眉页脚和图表目录。
