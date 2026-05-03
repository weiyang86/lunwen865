# ORD-1 API 契约设计（仅文档，不实现）

> 说明：本文件只列出契约清单与“扩展字段”要求；ORD-1 不改 UI、不实现新接口逻辑、不修改既有路由。

## 1) 已存在接口（照原样列出）

### 1.1 Admin 订单管理

对应后端文件：`apps/api/src/modules/admin/orders/orders.controller.ts`

- 【已存在】GET `/admin/orders`
  - Query：`status/keyword/startDate/endDate/page/pageSize/sortBy/sortOrder`（以 DTO 为准）
  - 返回：分页列表（当前为电商订单视角，含 `orderNo/status/amount/.../_count.items`）

- 【已存在】GET `/admin/orders/stats`
  - Query：`startDate/endDate`

- 【已存在】GET `/admin/orders/:id`
  - 返回：订单详情（`order + user + items + refunds`）

- 【已存在】PATCH `/admin/orders/:id/status`
  - Body：`UpdateOrderStatusDto`（现状为电商订单状态机）

- 【已存在】POST `/admin/orders/:id/refunds`
  - Body：`CreateRefundDto`（金额/原因）

- 【已存在】PATCH `/admin/orders/refunds/:refundId`
  - Body：`ResolveRefundDto`（审核通过/拒绝/备注）

### 1.2 Admin 支付/退款台账

对应后端文件：`apps/api/src/modules/payment/admin-payment.controller.ts`

- 【已存在】GET `/admin/payment/logs/:orderId`
  - 返回：支付日志分页

- 【已存在】GET `/admin/payment/refunds/:id`
  - 返回：退款单详情

- 【已存在】POST `/admin/payment/refunds`
  - Body：`RefundDto`（orderId/amountCents/reason）

### 1.3 论文任务（用户侧）

对应后端文件：`apps/api/src/modules/task/task.controller.ts`

- 【已存在】GET `/tasks`、GET `/tasks/:id`、GET `/tasks/:id/detail`
- 【已存在】POST `/tasks`（创建任务）、POST `/tasks/:id/start|pause|resume|cancel|retry`
- 【已存在】GET `/tasks/:id/progress`

## 2) 本次重构所需新增/扩展（契约草案）

> 这些接口本段只做“契约设计”，不在 ORD-1 实现。后续 ORD-2/3/4 决定落地路径。

### 2.1 列表查询（新增筛选条件）

对应后端文件：`apps/api/src/modules/admin/orders/orders.controller.ts`

- 【需扩展返回字段】GET `/admin/orders`
  - 新增 Query（不破坏旧参数）：
    - `currentStage?: BackendTaskStage`
    - `tutorId?: string`
    - `dueDateBefore?: string`（ISO date）
  - 新增返回字段（不删除旧字段）：
    - `thesis?: ThesisInfo`（用于列表展示关键论文信息）
    - `currentStage?: BackendTaskStage`
    - `dueDate?: string`

示例（新增字段示例，旧字段略）：

```json
{
  "items": [
    {
      "id": "o_xxx",
      "orderNo": "PAY_2026...",
      "status": "FULFILLING",
      "thesis": { "title": "题目", "educationLevel": "MASTER" },
      "currentStage": "OUTLINE",
      "dueDate": "2026-06-30T00:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20
}
```

### 2.2 详情查询（返回完整 ThesisOrder）

对应后端文件：`apps/api/src/modules/admin/orders/orders.controller.ts`

- 【需扩展返回字段】GET `/admin/orders/:id`
  - 新增字段（不删除旧字段）：
    - `thesis: ThesisInfo`
    - `stages: OrderStage[]`
    - `primaryTutorId?: string`
    - `taskId?: string`

### 2.3 阶段操作（管理员）

对应后端文件：`apps/api/src/modules/admin/orders/orders.controller.ts`

- 【需新增】POST `/admin/orders/:id/stages/:stage/assign-tutor`
  - Body：`{ tutorId: string }`

- 【需新增】POST `/admin/orders/:id/stages/:stage/review/approve`
  - Body：`{ comments?: string }`

- 【需新增】POST `/admin/orders/:id/stages/:stage/review/reject`
  - Body：`{ comments: string }`

- 【需新增】POST `/admin/orders/:id/stages/:stage/skip`
  - Body：`{ reason?: string }`

- 【需新增】POST `/admin/orders/:id/stages/revision-rounds`
  - Body：`{ add: number; reason?: string }`

返回示例（统一返回更新后的 `stages` 摘要）：

```json
{
  "stages": [
    { "type": "TOPIC", "status": "TOPIC_APPROVED" },
    { "type": "OPENING", "status": "OPENING_PENDING_REVIEW" }
  ]
}
```

### 2.4 上传交付物

对应后端文件：`apps/api/src/modules/admin/orders/orders.controller.ts`

- 【需新增】POST `/admin/orders/:id/stages/:stage/deliverables`
  - Content-Type：`multipart/form-data`
  - Form：
    - `file`（可选）
    - `kind`（`text|file|link|json`）
    - `title?`
    - `content?`（text/json）
    - `url?`（link）

返回示例：

```json
{
  "deliverable": {
    "id": "d_xxx",
    "stage": "OUTLINE",
    "version": 2,
    "kind": "file",
    "fileName": "outline_v2.docx",
    "url": "https://...",
    "createdAt": "2026-05-01T00:00:00.000Z"
  }
}
```

### 2.5 申请退款（部分/全额）

对应后端文件：`apps/api/src/modules/admin/orders/orders.controller.ts`

- 【已存在】POST `/admin/orders/:id/refunds` 已支持按金额发起退款
- 【需扩展返回字段】如要按阶段退款，需要扩展 Body：
  - `stage?: BackendTaskStage`
  - `mode?: 'partial' | 'full'`

### 2.6 修改论文信息（thesis 字段）

对应后端文件：`apps/api/src/modules/admin/orders/orders.controller.ts`

- 【需新增】PATCH `/admin/orders/:id/thesis`
  - Body：`Partial<ThesisInfo>`
  - 返回：`{ thesis: ThesisInfo }`

## 3) 备注：后端落地顺序建议（不属于 ORD-1 实现）

- 先做“扩展返回字段”（不破坏旧 UI）→ 再做“新增筛选条件” → 最后做“阶段操作/交付物/按阶段退款”

