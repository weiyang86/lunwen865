# 13 剩余功能分析（Remaining Feature Analysis）

## 1. 分析范围与依据

本次结论基于以下内容交叉分析：

- 蓝图与规划：`docs/00` ~ `docs/12`（含项目总览、产品设计、功能架构、API 与开发计划）。
- 当前仓库代码：`apps/web`、`apps/api`、`prisma/schema.prisma`、`docker-compose.yml`、根 `package.json`。
- 重点链路：Client 主链路（登录→任务→题目→开题→正文→交付→验收）。

## 2. 当前 Client 主链路完成度判断

链路：

客户登录
→ 创建论文任务
→ 查看任务列表
→ 进入题目生成
→ 生成论文题目
→ 确认题目
→ 生成开题报告
→ 查看开题报告
→ 生成论文正文
→ 查看正文进度
→ 下载交付物
→ 客户确认验收

### 2.1 逐环节状态

| 环节 | 状态 | 证据 | 结论 |
|---|---|---|---|
| 客户登录 | 已实现（MVP） | 前端登录/注册页与 token 持久化、后端 auth 模块已存在 | 可用，但仍需统一错误码与会话策略 |
| 创建论文任务 | 已实现（MVP） | `POST /tasks/bootstrap` + 客户侧任务创建表单 | 可创建任务，字段与蓝图仍有差异 |
| 查看任务列表 | 已实现（MVP） | 客户任务列表页调用 `/tasks` | 可查看本人任务 |
| 进入题目生成 | 已实现（MVP） | 任务列表可跳转带 `taskId` 的工作区 | 可进入工作区 |
| 生成论文题目 | 已实现（MVP） | Topic workbench 调用 `/tasks/:id/topics/generate` | 能发起生成 |
| 确认题目 | 已实现（MVP） | Topic workbench 调用 select/unselect 接口 | 支持确认/取消 |
| 生成开题报告 | 已实现（MVP） | Opening workbench 调用 `/tasks/:id/opening-report/generate` | 可发起生成 |
| 查看开题报告 | 已实现（MVP） | Opening workbench 可加载报告 | 支持查看与刷新 |
| 生成论文正文 | 已实现（Beta） | Writing workbench 调用 writing start/resume/retry | 能跑通，稳定性待增强 |
| 查看正文进度 | 部分实现 | 有 timeline 与 writing session 查询，但缺统一“交付视图” | 技术可见，产品态不足 |
| 下载交付物 | 部分实现 | 有 export/download 入口，但体验与权限策略未产品化 | 需下载中心与可见性策略 |
| 客户确认验收 | 未实现 | 未见明确验收状态机/确认接口/页面动作 | 属于 P0 缺口 |

### 2.2 主链路总体结论

- **后端能力层：约 70%~80%**（任务、题目、开题、正文、导出均有实现基础）。
- **前端产品层：约 55%~65%**（已可操作，但仍偏“工作台原型”，非完整交付产品体验）。
- **业务闭环层：约 50%**（“验收确认、交付中心、异常兜底、统一状态口径”仍缺失）。

## 3. 已完成功能（与文档目标对齐）

1. Client 登录/注册、鉴权态持久化已有基础实现。
2. 任务 Bootstrap（`/tasks/bootstrap`）与任务列表已可用。
3. 题目生成、重生成、选题确认链路具备前后端接口。
4. 开题报告生成与查看可联通。
5. 正文生成（含 resume/retry/导出）已有技术实现。
6. Task timeline、agency task timeline 与订单关联查询已有接口能力。
7. Prisma 层包含较完整论文生产数据结构与状态枚举基础。

## 4. 未完成功能（按优先级）

## 4.1 P0（上线阻塞）

1. **客户确认验收闭环缺失**
   - 缺“客户确认完成/驳回修改”的业务动作与状态流。
   - 缺对应接口、审计、前端入口与结果页。

2. **下载交付中心产品化不足**
   - 当前更多是“任务内导出/下载按钮”，缺统一下载中心（版本、状态、失败原因、重试策略）。

3. **链路统一状态口径不足**
   - 文档强调统一状态可视化，但当前不同 workbench 口径分散（topic/opening/writing）。

4. **异常处理与可恢复流程不完整**
   - 关键失败场景（生成失败、导出失败、权限失败）缺统一引导与恢复路径。

## 4.2 P1（稳定性与治理）

1. API 返回 envelope 与错误码统一落地不完整。
2. 状态机审计与回滚策略有基础但需强化（非法迁移拦截、补偿、观测）。
3. To B 机构权限隔离仍需系统化验收（机构、学生、管理三视角联动文档和验证）。
4. 可观测性（指标/告警）与部署验收脚本仍不足。

## 4.3 P2（体验优化）

1. 渠道转化看板、机构绩效分析。
2. Prompt 治理流程完善。
3. 管理端重页面性能与查询体验优化。

## 5. 代码与文档不一致点

1. **分支流程与仓库现状不一致**
   - 文档多处要求基于 `dev` 分支开发；当前仓库仅见 `work` 本地分支，未见 `dev`。

2. **“前台不足”与“Client 已有原型”并存**
   - `docs/00` 指出 C/B 前台不足；代码里已存在较完整 client 任务工作台原型，文档可补充“已具备原型但未达产品化上线标准”。

3. **P0 定义存在版本漂移**
   - `docs/10` 更偏“骨架先行”；`docs/12` 已改为“Client 可用业务闭环优先”。建议统一以 `docs/12` 为当前执行口径。

4. **验收清单与当前可执行命令不一致风险**
   - 根 `package.json` 仍是极简脚本，实际子应用命令需以 workspace 配置为准。建议在执行文档补充“以各子应用 package.json 为准”。

## 6. To B 三方影响说明（机构/学生/管理）

> 针对“Client 主链路优先”策略的影响：

- **机构视角**：短期需确保机构最小链路不阻塞（代下单归属、进度可见、越权拦截）。
- **学生视角**：应优先保证登录、任务创建、题目/开题/正文、下载与验收确认闭环可用。
- **管理视角**：需同步具备状态审计、异常干预、交付追踪和验收争议处理能力。

## 7. 建议后续 Issue 拆分

### 7.1 P0（建议先做）

1. `feat(client-delivery): build unified delivery center and download lifecycle`
2. `feat(client-acceptance): add customer acceptance confirm/reject workflow`
3. `feat(client-timeline): unify topic opening writing progress semantics`
4. `fix(client-errors): standardize failure handling and retry guidance`

### 7.2 P1

5. `refactor(api): unify envelope and business error codes`
6. `feat(task): strengthen state-transition audit and compensation`
7. `feat(security): finalize agency scope isolation with audit logs`
8. `chore(obs): add minimal metrics and alert baseline`

## 8. 风险与结论

- 当前系统已从“纯后台阶段”进入“Client 可跑通阶段”，但尚未完成“可验收交付产品”阶段。
- 若直接宣称 P0 完成，最大风险在于：**客户验收动作缺失 + 下载中心未产品化 + 异常恢复体验不足**。
- 建议以“主链路可用 Beta”定位当前状态，按本文件 P0 清单继续推进。

