# 14 下一步开发计划（Next Development Plan）

## 1. 目标定义（面向 dev 迭代）

目标：在不做无关重构前提下，优先完成 Client 主链路“可验收交付闭环”，并同步补齐 To B 最小不阻塞能力。

闭环标准：

登录 → 创建任务 → 题目生成/确认 → 开题生成/查看 → 正文生成/进度 → 下载交付物 → 客户确认验收

## 2. 优先级路线图（P0/P1）

## 2.1 P0（1~2 个迭代）

### P0-A 交付中心与下载闭环
- 目标：统一下载中心（按任务/阶段聚合，展示状态、失败原因、重试入口）。
- 影响范围：web、api、（可选）export 查询接口增强。
- 验收：客户可在单页面完成交付文件查看、下载、失败重试。

### P0-B 客户验收确认闭环
- 目标：新增“确认验收/申请修改”动作与状态。
- 影响范围：task/order 状态机、前端验收交互、管理端可见。
- 验收：验收结果可追踪，有审计记录，可回放。

### P0-C 主链路统一状态语义
- 目标：统一题目/开题/正文状态展示口径，减少跨页面理解成本。
- 影响范围：client timeline + workbench 状态映射。
- 验收：同一任务在各页面状态一致，无互相冲突文案。

### P0-D 异常恢复与失败兜底
- 目标：关键错误（鉴权失效、任务失败、导出失败）有统一可恢复路径。
- 验收：失败后有明确下一步动作，不出现“卡死状态”。

## 2.2 P1（稳定性）

### P1-A API 错误码与 Envelope 统一
- 目标：核心模块响应统一，前端去分散兼容逻辑。

### P1-B 状态机审计与补偿
- 目标：状态迁移可追溯、可回滚、可告警。

### P1-C To B 权限隔离强化
- 目标：机构数据严格归属访问，补齐审计与回归测试。

## 3. 建议 Issue 列表（可直接建单）

1. `feat(client-delivery): unify delivery center and download lifecycle`
2. `feat(client-acceptance): support confirm-and-request-revision flow`
3. `feat(client-timeline): normalize status semantics across stages`
4. `fix(client-recovery): add recoverable flows for common failures`
5. `refactor(api): standardize response envelope and error codes`
6. `feat(task-audit): add transition audit + compensation hooks`
7. `feat(agency-security): enforce agency scope isolation with audit`

## 4. 影响范围清单

- 前端（web）：Client 工作台、下载中心、验收交互、状态组件。
- 后端（api）：task/order/export 接口、状态机、错误码、审计。
- 数据库（prisma）：如新增验收记录或状态字段，需 migration。
- 部署（docker/infra）：若新增队列或环境变量，需更新 compose/.env.example。

## 5. 本地验证步骤模板（用于后续每个 PR）

1. 安装依赖：`pnpm install`
2. 启动依赖：`docker compose up -d --build`
3. 启动后端：`pnpm --filter api start:dev`
4. 启动前端：`pnpm --filter web dev`
5. 前端校验：`pnpm --filter web lint && pnpm --filter web test && pnpm --filter web build`
6. 后端校验：`pnpm --filter api lint && pnpm --filter api test && pnpm --filter api build`
7. 人工访问页：`/login`、`/tasks`、`/tasks?taskId=xxx&tab=topic|opening|outline|writing`、`/downloads`
8. 核心功能点：登录、任务创建、题目确认、开题生成、正文进度、下载、验收确认

## 6. Docker 与迁移说明模板

每个涉及后端/数据模型的 PR 必须明确：

1. 是否需要 `docker compose up -d --build`
2. 是否需要数据库迁移
3. 是否需要 seed
4. 是否新增环境变量
5. 是否更新 `.env.example`
6. 是否影响已有容器

## 7. 风险控制

1. 避免“文档与代码双大改”混在同一 PR。
2. 主链路改造时禁止顺手改动支付核心逻辑。
3. 状态机改动必须附带回滚方案与异常测试结果。
4. 涉及 To B 流程必须说明机构/学生/管理三视角影响。

## 8. 结论

建议将后续 2 个迭代聚焦在“交付中心 + 验收确认 + 状态统一 + 异常恢复”四件事，先拿下 Client 真正可验收闭环，再进入 P1 稳定性治理。
