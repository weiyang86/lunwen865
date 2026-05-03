# ORD-1 状态映射表（Backend ↔ Frontend）

## 1) TaskStatus → StageStatus

结论：本次前端领域模型中的 `StageStatus` **与后端 Prisma `TaskStatus` 字面一致**，无需映射函数。

对应后端枚举定义：`prisma/schema.prisma`（`enum TaskStatus`）  
对应前端类型定义：`apps/web/src/types/order.ts`（`export type BackendTaskStatus` / `StageStatus`）

```asciidoc
后端 TaskStatus               ←→  前端 StageStatus
-------------------------------------------------
INIT                          ←→  INIT
TOPIC_GENERATING              ←→  TOPIC_GENERATING
TOPIC_PENDING_REVIEW          ←→  TOPIC_PENDING_REVIEW
TOPIC_APPROVED                ←→  TOPIC_APPROVED
OPENING_GENERATING            ←→  OPENING_GENERATING
OPENING_PENDING_REVIEW        ←→  OPENING_PENDING_REVIEW
OPENING_APPROVED              ←→  OPENING_APPROVED
OUTLINE_GENERATING            ←→  OUTLINE_GENERATING
OUTLINE_PENDING_REVIEW        ←→  OUTLINE_PENDING_REVIEW
OUTLINE_APPROVED              ←→  OUTLINE_APPROVED
WRITING                       ←→  WRITING
WRITING_PAUSED                ←→  WRITING_PAUSED
MERGING                       ←→  MERGING
FORMATTING                    ←→  FORMATTING
REVIEW                        ←→  REVIEW
REVISION                      ←→  REVISION
DONE                          ←→  DONE
FAILED                        ←→  FAILED
CANCELLED                     ←→  CANCELLED
```

因此：`web/src/utils/order-status.ts` 的映射工具在 ORD-1 **不需要创建**。

## 2) TaskStage → StageType

结论：`StageType` 与后端 Prisma `TaskStage` 字面一致。

对应后端枚举定义：`prisma/schema.prisma`（`enum TaskStage`）  
对应前端类型定义：`apps/web/src/types/order.ts`（`export type BackendTaskStage` / `StageType`）

```asciidoc
后端 TaskStage                ←→  前端 StageType
-------------------------------------------------
TOPIC                         ←→  TOPIC
OPENING                       ←→  OPENING
OUTLINE                       ←→  OUTLINE
WRITING                       ←→  WRITING
MERGING                       ←→  MERGING
FORMATTING                    ←→  FORMATTING
REVIEW                        ←→  REVIEW
REVISION                      ←→  REVISION
```

