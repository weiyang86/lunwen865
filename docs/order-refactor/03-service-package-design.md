# ORD-1 ServicePackage 模型设计

> 本文件仅定义前端领域模型与契约草案；ORD-1 不落库、不实现后端业务逻辑。

## 目标

- 用“套餐（ServicePackage）”承载论文辅导的产品化配置：包含哪些阶段、修改轮次、定金比例、预计周期等
- 作为 ORD-2/3/4 重构订单与阶段逻辑的配置来源

## 与现有后端的关系（ORD-1 结论）

- 现有电商订单：`prisma/schema.prisma` 的 `Order/Product/OrderItem` 仍是通用电商结构
- 现有论文流程：由 `Task` 驱动（`TaskStatus/TaskStage`）
- 当前后端**没有** `service_package` 表，也没有套餐模块

因此本段采取“渐进式拓展”：
- 前端先定义 `ServicePackage` 类型
- 后端仅新增模块空骨架（不挂载到 `AppModule`），为 ORD-2 接入做准备

## TypeScript 类型

对应文件：`apps/web/src/types/service-package.ts`

```ts
export interface ServicePackage {
  id: string;
  name: string;
  level: 'undergraduate' | 'master' | 'phd';
  description: string;
  basePrice: number;
  depositRatio: number;
  includedStages: StageType[];
  revisionRoundsLimit: number;
  estimatedDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

字段说明（关键项）：
- `depositRatio`：定金比例（0-1），ORD-1 仅建模；是否启用定金需结合现有支付模型确认
- `includedStages`：包含的阶段集合；阶段值与后端 `TaskStage` 字面一致（见 `01-backend-discovery.md`）
- `revisionRoundsLimit`：套餐内修改轮次上限（ORD-1 采用默认 3，待业务方确认）
- `estimatedDays`：预计总工期（天）

## 待后续段落（ORD-2/3/4）落地项

- 套餐数据来源：后端表 / 配置中心 / 静态配置（待定）
- 订单与任务关联：是否在 `Order` 增加 `taskId`，或新建“ThesisOrder”表（待 ORD-2 确认方案）
- 金额拆分：定金/尾款与阶段金额分摊（影响退款规则与对账）

