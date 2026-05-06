# 11 开发执行计划（Development Execution Plan）

> 依据文档：`AGENTS.md`、`docs/08-development-roadmap.md`、`docs/09-acceptance-checklist.md`、`docs/10-github-issues.md`

## 一、项目当前阶段说明

当前项目已完成产品蓝图、技术架构、功能拆分与优先级规划（P0/P1/P2），并已形成可执行的 Issue 清单。现阶段进入**按 Issue 推进开发**阶段，重点是：

1. 以 `docs/10-github-issues.md` 为任务源推进研发。
2. 按 PR 驱动方式进行开发、Review、验收、上线。
3. 先完成 P0 上线闭环，再推进 P1 稳定性，最后处理 P2 优化项。

---

## 二、开发推进原则

1. 每次只处理一个 Issue。
2. 每个 Issue 独立生成一个 PR。
3. 不允许一次性开发多个无关功能。
4. 不允许无关重构。
5. 不允许修改与当前 Issue 无关的文件。
6. 所有开发必须遵守 `AGENTS.md` 和 `docs/` 下已确认的设计文档。
7. 所有 PR 必须经过 Review 和人工验收后才能合并。
8. 优先完成 P0，再处理 P1，最后处理 P2。
9. 所有开发 PR 默认合并到 `dev`。
10. `main` 只用于稳定上线版本。

---

## 三、P0 / P1 / P2 任务总览

> 状态字段统一：`未开始` / `开发中` / `待 Review` / `待验收` / `已合并` / `已上线`

### P0 任务

| 执行顺序 | Issue 标题 | 任务目标 | 依赖关系 | 建议分支名 | 建议 PR 标题 | 验收重点 | 当前状态 |
|---|---|---|---|---|---|---|---|
| 1 | 搭建学生端基础页面骨架（To C） | 建立学生端核心路由与页面骨架 | 无 | `feat/p0-client-shell` | `feat(client): scaffold student portal shell pages` | 页面可访问；loading/empty/error/success 完整 | 未开始 |
| 2 | 搭建机构端基础页面骨架（To B） | 建立机构端核心路由与页面骨架 | 无 | `feat/p0-agency-shell` | `feat(agency): scaffold agency portal shell pages` | 机构端核心页面可访问 | 未开始 |
| 3 | 支持机构代下单流程（Order API + 数据字段） | 机构可代下单并查询归属订单 | 建议依赖 2 | `feat/p0-agency-assisted-order` | `feat(order): add agency-assisted order flow` | 可区分 direct/agency，归属权限正确 | 未开始 |
| 4 | 打通统一任务时间线展示（学生/机构） | 联通订单与任务阶段展示 | 依赖 1、2、3 | `feat/p0-task-timeline` | `feat(task): implement unified timeline for client and agency` | 可见范围正确、无越权、阶段状态准确 | 未开始 |
| 5 | 双通道 E2E 回归（To C + To B） | 双链路回归可重复执行 | 依赖 1~4 | `test/p0-dual-channel-e2e` | `test(e2e): add toC and toB full-flow regression` | 双链路通过、失败可定位 | 未开始 |

### P1 任务

| 执行顺序 | Issue 标题 | 任务目标 | 依赖关系 | 建议分支名 | 建议 PR 标题 | 验收重点 | 当前状态 |
|---|---|---|---|---|---|---|---|
| 6 | 统一 API 返回 envelope 与错误码规范 | 统一响应与错误处理，降低前端兼容成本 | 建议依赖 P0 API 初步稳定 | `refactor/p1-api-envelope` | `refactor(api): unify response envelope and error codes` | 核心模块响应结构一致，错误码可追踪 | 未开始 |
| 7 | 任务状态机审计与回滚策略完善 | 提升任务流可维护性与风控能力 | 建议依赖 P0-4 | `feat/p1-task-audit-rollback` | `feat(task): enhance transition audit and rollback safeguards` | 状态变更可追溯，非法迁移可拦截 | 未开始 |
| 8 | 机构权限隔离与审计日志 | 强化 To B 数据隔离与审计留痕 | 建议依赖 P0-3 | `feat/p1-agency-access-audit` | `feat(security): add agency scope isolation and audit logs` | 非归属访问 403，越权日志完整 | 未开始 |
| 9 | 可观测性基线（日志/指标/告警） | 提升故障发现与定位效率 | 建议依赖 P0 全链路打通 | `chore/p1-observability` | `chore(obs): add logging metrics and alert baseline` | 关键故障可快速定位，告警可触发 | 未开始 |

### P2 任务

| 执行顺序 | Issue 标题 | 任务目标 | 依赖关系 | 建议分支名 | 建议 PR 标题 | 验收重点 | 当前状态 |
|---|---|---|---|---|---|---|---|
| 10 | 渠道转化与机构绩效看板 | 输出机构维度转化与效率分析 | 依赖 P1 指标基础 | `feat/p2-channel-dashboard` | `feat(admin): add channel conversion dashboard` | 指标口径清晰、可筛选 | 未开始 |
| 11 | 机构结算与对账模块（规划内） | 打通 To B 商业化结算闭环 | 依赖 P0-3、P1-6 | `feat/p2-agency-settlement` | `feat(agency): add settlement and reconciliation baseline` | 账单可生成、对账状态可追踪 | 未开始 |
| 12 | 管理后台重页面性能优化（订单/任务） | 降低重页面查询与渲染成本 | 建议依赖 P0/P1 稳定后实施 | `perf/p2-admin-heavy-pages` | `perf(admin): optimize heavy pages for orders and tasks` | P95 改善、无功能回归 | 未开始 |

---

## 四、推荐开发顺序

### 1）P0 顺序（必须先做）

1. **P0-1 学生端页面骨架**：先提供 To C 承载层。
2. **P0-2 机构端页面骨架**：并行建立 To B 承载层。
3. **P0-3 机构代下单流程**：To B 核心业务入口，依赖机构端入口。
4. **P0-4 统一任务时间线**：依赖订单/页面骨架与代下单流程。
5. **P0-5 双通道 E2E**：最后做端到端闭环验证。

### 2）P1 顺序

6. P1-6 API 统一响应与错误码
7. P1-7 任务状态机审计与回滚
8. P1-8 机构权限隔离与审计日志
9. P1-9 可观测性基线

> 顺序原因：先统一协议，再补审计和观测，减少重复改动。

### 3）P2 顺序

10. P2-10 渠道转化看板
11. P2-11 机构结算与对账
12. P2-12 管理后台性能优化

> 任务拆分建议：P2-11（机构结算与对账）规模较大，建议拆分为：
> - 11A 账单生成与查询
> - 11B 对账状态流转
> - 11C 管理端审核与导出

---

## 五、最小上线任务集合

### 1）可进入测试部署（Staging）
- P0-1 学生端基础页面骨架
- P0-2 机构端基础页面骨架
- P0-3 机构代下单流程
- P0-4 统一任务时间线

### 2）正式上线前必须完成
- P0-1 ~ P0-4
- P0-5 双通道 E2E 回归通过
- `docs/09-acceptance-checklist.md` 中功能/权限/安全/部署关键项通过

### 3）可延后到 P1 / P2
- P1-6 ~ P1-9
- P2-10 ~ P2-12

---

## 六、PR 推进流程

每个 Issue 标准流程：

1. 创建 GitHub Issue。
2. Codex 基于 `dev` 创建开发分支。
3. Codex 完成代码并生成 PR 到 `dev`。
4. 使用 `@codex review` 审查。
5. 修复 P0 / P1 问题。
6. 人工本地验收。
7. 合并到 `dev`。
8. 阶段测试后创建 `release` 分支。
9. `release` 验收通过后合并 `main`。

---

## 七、本地 Trae 验证流程

每个 PR 本地验证步骤：

1. `git fetch origin`
2. `git checkout <pr-branch>`（或 `git switch <pr-branch>`）
3. `docker compose up -d --build`
4. 启动 NestJS 后端（例如：`pnpm --filter api start:dev`）
5. 启动 Next.js 前端（例如：`pnpm --filter web dev`）
6. 验证页面路径（按 PR 描述列出的页面逐项验证）
7. 验证接口路径（按 PR 描述列出的接口逐项验证）
8. 运行 lint / test / build（前后端分别执行）
9. 记录验收结果（通过项、失败项、阻塞项、复现步骤）

---

## 八、上线前检查节点

> 基于 `docs/09-acceptance-checklist.md` 整理。

### 1）功能验收
- 学生/机构登录可用。
- 学生自助下单与机构代下单可用。
- 订单与任务正确关联。
- 任务状态推进与修改流程闭环。
- 导出与退款流程可用。

### 2）UI 验收
- 学生端/机构端/管理端关键页具备 loading/empty/error/success。
- 表单错误提示清晰。
- 列表筛选、分页、批量操作可用。
- 渠道来源与归属展示清晰。

### 3）权限验收
- 鉴权与越权拦截有效。
- 机构账号无法访问非归属数据。

### 4）接口异常验收
- 参数校验错误返回一致。
- 业务错误码可追踪。
- 支付回调异常可识别并支持重试。

### 5）数据验收
- 订单来源（direct/agency）写入正确。
- 任务状态流转记录完整。
- 审计数据可追踪。

### 6）构建验收
- 前端 lint/test/build 通过。
- 后端 lint/test/build 通过。

### 7）Docker 验收
- `docker compose up -d --build` 可正常启动。
- 相关容器服务健康。

### 8）部署验收
- `staging/prod` 环境变量模板齐全。
- 可部署、可回滚。
- 数据库迁移流程可复现。

### 9）安全验收
- 敏感信息不写入日志。
- 支付回调验签与幂等通过。
- 高危操作具备审计日志。

---

## 九、需要人工确认

1. P2-11（机构结算与对账）是否纳入近期版本，或继续保持 P2。
2. 机构代下单支付主体与发票主体最终规则。
3. 机构在任务时间线中的可见边界（是否可见正文全文）。
4. P1-6（API 统一）采用全量改造还是分模块渐进。

