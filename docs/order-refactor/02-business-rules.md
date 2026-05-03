# ORD-1 业务规则确认（Business Rules）

> 规则优先从后端代码推断；推断不出来的按默认值采用，并标注「待业务方确认」。

## 规则决策表

| # | 规则 | 推断方法 | 【后端现状】 | 【本任务采用】 | 【理由】 |
|---|------|----------|-------------|----------------|----------|
| 1 | 修改阶段是固定 N 轮还是无限？是否套餐分档？ | 看 `Task` 是否有 `maxRevisions/revisionCount` 等字段；或写作/修订表是否计数 | `prisma/schema.prisma` 的 `Task` 不含修改轮次字段；存在 `TaskStage.REVISION` 与 `TaskStatus.REVISION`，但没有轮次上限/计数的明确实现 | 默认套餐内 3 轮，超出由管理员手动追加（待业务方确认） | 后端无轮次字段，无法严格推断；先用可落地的默认值，为后续 ORD-2/3 的 UI 与契约提供基准 |
| 2 | 退款规则（按阶段比例 / 全额 / 违约金） | 看 `Refund/Payment` service 逻辑 | 退款在订单域：`Refund` 记录与 `OrderStatus.REFUNDING/REFUNDED`；未发现“按论文阶段比例”的实现 | 按“未交付阶段金额比例”退；已通过阶段不退（待业务方确认） | 后端现有退款逻辑与论文阶段未关联；本段只能给出推荐默认值，待后续在契约与实现中落地 |
| 3 | 是否允许跳过阶段 | 看 Task 状态机与阶段推进规则是否允许跨阶段 | `canAdvanceTo(current, target)` 允许 `target >= current`（可跨阶段推进）；但不会记录 `SKIPPED` 单独状态 | 允许跳过，由管理员操作，状态记为 `SKIPPED`（待业务方确认） | 后端可“跨阶段推进”，但缺少“被跳过”的显式记录；前端领域模型先保留 `skipped` 概念，后续 ORD-2/3 决定落库方式 |
| 4 | 一订单单老师还是多老师 | 看 Order 是否有 tutorId（单），或中间表（多） | 后端未发现 tutor/导师实体或关联字段；`Order` 与 `Task` 也无关联 | 一订单一主老师（沿用 `primaryTutorId` 单字段，待业务方确认） | 现状缺失导师模型，先采用最简模型以便后续渐进扩展；多导师可在 ORD-3/4 通过中间表扩展 |
| 5 | 交付物版本保留还是覆盖 | 看是否有 deliverable/file_version/版本号字段 | 论文域有明确版本概念：如 `OpeningReport.version`（`@@unique([taskId, version])`）、`Outline.version` 等；但订单域无“交付物”表 | 保留所有版本，version 自增（待业务方确认） | 后端在论文生成域已采用“版本递增”；领域建模沿用这一偏好更自然 |
| 6 | 截止日期：订单级 or 阶段级 | 看 dueDate 字段在 Order 还是 Task 上 | `Task.deadline` 存在（最终截止）；`Order.expiresAt` 更像“支付超时/关闭时间”；未见阶段级 dueDate 字段 | 订单级为最终截止，阶段级为软目标（仅展示用，逾期标黄）（待业务方确认） | 后端只有任务级 deadline 与订单支付级 expiresAt；阶段级目标需要后续新增字段或派生计算 |

## 关键说明（推断依据索引）

- Task 模型字段：`prisma/schema.prisma`（`model Task`）
- Task 枚举：`prisma/schema.prisma`（`enum TaskStatus`、`enum TaskStage`）
- 阶段推进规则：`apps/api/src/modules/task/state-machine/stage-rules.ts`
- 订单退款与状态：`prisma/schema.prisma`（`model Order/Refund`），以及
  - `apps/api/src/modules/admin/orders/orders.service.ts`（admin 退款发起/处理）
  - `apps/api/src/modules/payment/payment.service.ts`（退款创建与支付日志）

## 待业务方确认的疑点清单（ORD-2 前置）

1. “修改轮次”是否真的存在套餐限制？若有，是否按阶段（revision）计数还是全流程计数？
2. “退款比例”是否按阶段拆分金额？拆分依据来自套餐定义还是按人工配置？
3. “跳过阶段”是否必须可追溯（audit log）？是否允许回退到被跳过前的阶段？
4. 是否需要导师体系（导师档案、资质、排班、指派记录）？是否支持多导师协作？
5. “交付物”具体指哪些：开题报告/大纲/初稿/终稿/查重报告/润色稿？是否都版本化？
6. 截止日期的来源：用户下单选择日期？系统按套餐 estimatedDays 计算？还是管理员手动设置？

