# 10 GitHub Issues 拆分清单

> 基于 `docs/08-development-roadmap.md` 拆分，可直接复制到 GitHub Issue。

## [P0-1A] 学生端路由与布局骨架（To C）

**背景**
P0-1 已确认需要拆分，先落地学生端可扩展的路由与基础布局壳层。

**目标**
搭建学生端核心路由分组与全局布局（不耦合具体业务接口）。

**开发范围**
- 新建学生端路由分组与导航布局。
- 页面骨架入口：登录注册、商品、订单、任务、下载、账户。

**不做范围**
- 不接真实支付与任务数据。
- 不做复杂视觉升级。

**涉及文件或目录**
- `apps/web/app/(client)/**`
- `apps/web/src/components/client/**`

**验收标准**
- 学生端核心入口页面可访问。
- 路由与布局可承接后续模块。

**风险点**
- 后续接口字段变化导致页面结构返工。

**建议分支名**
`feat/p0-client-shell-routing`

**建议 PR 标题**
`feat(client): scaffold student routing and layout shell`

## [P0-1B] 学生端页面状态组件（loading/empty/error/success）

**背景**
P0-1 拆分的第二部分，保证所有核心页面具备统一状态反馈。

**目标**
补齐学生端关键页面的 loading/empty/error/success 状态组件与占位逻辑。

**开发范围**
- 状态组件抽象与复用。
- 在学生端核心页面接入状态组件。

**不做范围**
- 不做业务数据写回。

**涉及文件或目录**
- `apps/web/src/components/client/**`
- `apps/web/src/features/client/**`

**验收标准**
- 核心页面均具备 4 类状态。
- 状态切换逻辑可被手工验证。

**风险点**
- 页面状态标准不一致导致体验割裂。

**建议分支名**
`feat/p0-client-shell-states`

**建议 PR 标题**
`feat(client): add standard loading empty error success states`

## [P0-2A] 机构端路由与导航骨架（To B）

**背景**
P0-2 可选拆分已确认有效，先建立机构端路由与导航承载。

**目标**
完成机构端可扩展导航与基础路由壳层。

**开发范围**
- 新建机构端路由分组。
- 机构工作台导航和布局骨架。

**不做范围**
- 不做线索/代下单业务联调。

**涉及文件或目录**
- `apps/web/app/(agency)/**`
- `apps/web/src/components/agency/**`

**验收标准**
- 机构端主入口可访问。
- 导航结构覆盖后续业务入口。

**风险点**
- 后续权限模型细化后导航可能调整。

**建议分支名**
`feat/p0-agency-shell-routing`

**建议 PR 标题**
`feat(agency): scaffold agency routing and navigation shell`

## [P0-2B] 机构端业务页面骨架（线索/代下单/进度）

**背景**
基于 P0-2A 的壳层，补齐机构核心业务页面骨架。

**目标**
完成线索管理、代下单、进度追踪页面骨架。

**开发范围**
- 线索列表与详情骨架。
- 代下单页面骨架。
- 进度追踪页面骨架。

**不做范围**
- 不做机构结算与报表。

**涉及文件或目录**
- `apps/web/src/features/agency/**`
- `apps/web/src/components/agency/**`

**验收标准**
- 机构关键业务页面可访问。
- 信息架构符合线索/代下单/进度协同。

**风险点**
- 与后端接口字段未对齐时需二次调整。

**建议分支名**
`feat/p0-agency-shell-pages`

**建议 PR 标题**
`feat(agency): scaffold lead order progress page shells`

## [P0-3A] 订单来源与归属数据字段扩展

**背景**
P0-3 拆分第一步，先落地 `direct/agency` 来源与归属字段。

**目标**
完成订单来源与机构归属的数据模型扩展。

**开发范围**
- 扩展订单来源字段与机构归属字段。
- 必要的数据迁移与兼容处理。

**不做范围**
- 不做 API 业务逻辑。

**涉及文件或目录**
- `prisma/schema.prisma`
- `prisma/migrations/**`
- `apps/api/src/modules/order/**`

**验收标准**
- 可正确写入/读取来源与归属字段。
- 历史数据兼容不报错。

**风险点**
- 迁移兼容风险。

**建议分支名**
`feat/p0-order-source-model`

**建议 PR 标题**
`feat(order): add direct agency source and ownership fields`

## [P0-3B] 机构代下单 API（创建/列表）

**背景**
在字段完成后，落地机构代下单业务接口。

**目标**
新增机构代下单创建和列表查询 API。

**开发范围**
- `POST /api/agency/orders`
- `GET /api/agency/orders`

**不做范围**
- 不做机构分账/结算。

**涉及文件或目录**
- `apps/api/src/modules/order/**`
- `apps/api/src/modules/agency/**`

**验收标准**
- 机构可创建并查询本机构订单。
- 订单来源字段正确。

**风险点**
- 与已有下单流程兼容风险。

**建议分支名**
`feat/p0-agency-order-api`

**建议 PR 标题**
`feat(order): add agency assisted order create and list APIs`

## [P0-3C] 机构订单归属权限校验

**背景**
P0-3 拆分第三步，确保机构仅访问归属资源。

**目标**
落地机构订单查询与操作的归属权限校验。

**开发范围**
- 机构归属判断逻辑。
- 非归属访问拒绝与日志。

**不做范围**
- 不做全量审计平台对接。

**涉及文件或目录**
- `apps/api/src/modules/auth/**`
- `apps/api/src/modules/order/**`
- `apps/api/src/modules/agency/**`

**验收标准**
- 非归属访问返回 403。
- 归属访问正常。

**风险点**
- 漏加校验导致越权。

**建议分支名**
`feat/p0-agency-order-scope`

**建议 PR 标题**
`feat(security): enforce agency order ownership scope`

## [P0-4A] 后端任务时间线读取接口

**背景**
P0-4 拆分第一步，先提供统一时间线读取能力。

**目标**
提供订单关联任务阶段时间线 API。

**开发范围**
- 订单详情任务摘要。
- 任务阶段时间线读取接口。

**不做范围**
- 不做前端页面接入。

**涉及文件或目录**
- `apps/api/src/modules/task/**`
- `apps/api/src/modules/order/**`

**验收标准**
- 能读取完整阶段时间线。
- 状态映射准确。

**风险点**
- 状态映射与前端展示不一致。

**建议分支名**
`feat/p0-task-timeline-api`

**建议 PR 标题**
`feat(task): add unified timeline query APIs`

## [P0-4B] 学生端任务时间线接入

**背景**
基于时间线 API，在 To C 页面接入展示。

**目标**
学生可查看归属订单任务阶段进度。

**开发范围**
- 学生端任务时间线组件接入。
- 页面状态处理与错误提示。

**不做范围**
- 不做机构端接入。

**涉及文件或目录**
- `apps/web/src/features/client/**`
- `apps/web/src/components/client/**`

**验收标准**
- 学生可查看任务阶段。
- 页面状态完整。

**风险点**
- 时间线字段变化导致前端适配成本。

**建议分支名**
`feat/p0-client-task-timeline`

**建议 PR 标题**
`feat(client): integrate task timeline view`

## [P0-4C] 机构端任务时间线接入与可见性控制

**背景**
P0-4 拆分第三步，To B 接入并控制可见边界。

**目标**
机构可查看归属任务阶段进度，并限制可见内容。

**开发范围**
- 机构端时间线页面接入。
- 机构可见范围控制。

**不做范围**
- 不开放超范围正文可见性。

**涉及文件或目录**
- `apps/web/src/features/agency/**`
- `apps/api/src/modules/task/**`
- `apps/api/src/modules/agency/**`

**验收标准**
- 机构仅可见归属任务及允许字段。
- 越权访问被拦截。

**风险点**
- 可见性边界规则需人工确认。

**建议分支名**
`feat/p0-agency-task-timeline`

**建议 PR 标题**
`feat(agency): integrate task timeline with visibility control`

## [P0-5A] To C 主链路 E2E 回归

**背景**
P0-5 拆分第一步，先验证学生直购链路。

**目标**
建立 To C（登录→下单→支付→任务进度）E2E 回归。

**开发范围**
- To C 主链路自动化用例。
- 关键断言与失败日志。

**不做范围**
- 不覆盖 To B 场景。

**涉及文件或目录**
- `apps/api/test/**`
- `scripts/**`

**验收标准**
- To C 链路可重复通过。
- 失败可定位步骤。

**风险点**
- 测试数据污染。

**建议分支名**
`test/p0-toc-e2e`

**建议 PR 标题**
`test(e2e): add toC end-to-end regression flow`

## [P0-5B] To B 主链路 E2E 回归

**背景**
P0-5 拆分第二步，验证机构代下单链路。

**目标**
建立 To B（机构登录→代下单→支付→任务进度）E2E 回归。

**开发范围**
- To B 主链路自动化用例。
- 权限边界断言。

**不做范围**
- 不整合统一流水线。

**涉及文件或目录**
- `apps/api/test/**`
- `scripts/**`

**验收标准**
- To B 链路可重复通过。
- 越权场景校验通过。

**风险点**
- 机构测试数据构造复杂。

**建议分支名**
`test/p0-tob-e2e`

**建议 PR 标题**
`test(e2e): add toB agency-assisted end-to-end flow`

## [P0-5C] 双通道回归流水线整合

**背景**
P0-5 拆分第三步，整合 To C 与 To B 回归并接入统一执行流程。

**目标**
形成可在本地/CI重复执行的双通道回归入口。

**开发范围**
- 聚合执行脚本。
- （可选）接入 `.github/workflows/**`。

**不做范围**
- 不做性能压测。

**涉及文件或目录**
- `scripts/**`
- `.github/workflows/**`
- `apps/api/test/**`

**验收标准**
- 一键执行双通道回归。
- 结果汇总清晰可读。

**风险点**
- CI 环境依赖稳定性。

**建议分支名**
`chore/p0-dual-e2e-pipeline`

**建议 PR 标题**
`chore(test): integrate toC and toB e2e regression pipeline`

## [P1] 统一 API 返回 envelope 与错误码规范

**背景**
路线图要求稳定性阶段统一 API 响应与错误规范，降低前端兼容成本。

**目标**
统一核心接口返回结构与模块化错误码。

**开发范围**
- 统一 `{code,message,data}` 返回格式。
- 建立 `AUTH_* / AGENCY_* / ORDER_* / TASK_*` 错误码映射。

**不做范围**
- 不做错误文案国际化。

**涉及文件或目录**
- `apps/api/src/common/**`
- `apps/api/src/modules/**`
- `docs/06-api-design.md`（同步更新）

**验收标准**
- 核心模块响应结构一致。
- 错误码可追踪定位。

**风险点**
- 历史接口兼容处理复杂。

**建议分支名**
`refactor/p1-api-envelope`

**建议 PR 标题**
`refactor(api): unify response envelope and error codes`

## [P1] 任务状态机审计与回滚策略完善

**背景**
状态机复杂，需提升可维护性与风控能力。

**目标**
补全状态迁移审计、非法迁移拦截与回滚策略。

**开发范围**
- 记录状态变更（操作者、原因、时间）。
- 管理员纠偏动作强制留痕。
- 非法状态迁移规则校验。

**不做范围**
- 不做可视化流程编排器。

**涉及文件或目录**
- `apps/api/src/modules/task/**`
- `apps/api/src/modules/admin/tasks/**`

**验收标准**
- 状态变更可追溯。
- 非法迁移被稳定拦截。

**风险点**
- 老数据状态不规范影响规则执行。

**建议分支名**
`feat/p1-task-audit-rollback`

**建议 PR 标题**
`feat(task): enhance transition audit and rollback safeguards`

## [P1] 机构权限隔离与审计日志

**背景**
机构协同上线后，需要可证明的数据隔离和审计能力。

**目标**
确保机构无法访问非归属资源，并保留关键操作日志。

**开发范围**
- 机构归属访问控制校验补全。
- 关键接口访问日志与越权日志记录。

**不做范围**
- 不接外部 SIEM 平台。

**涉及文件或目录**
- `apps/api/src/modules/auth/**`
- `apps/api/src/modules/agency/**`
- `apps/api/src/modules/admin/**`

**验收标准**
- 非归属访问返回 403。
- 越权尝试有日志记录。

**风险点**
- 日志量增长和存储成本。

**建议分支名**
`feat/p1-agency-access-audit`

**建议 PR 标题**
`feat(security): add agency scope isolation and audit logs`

## [P1] 可观测性基线（日志/指标/告警）

**背景**
路线图要求 P1 提升可观测性，支持快速定位关键错误。

**目标**
建立最小可用的结构化日志、核心指标与告警规则。

**开发范围**
- 关键链路结构化日志。
- 核心指标：下单成功率、支付失败率、任务推进失败率。
- 基线告警规则。

**不做范围**
- 不做全量 APM 深度接入。

**涉及文件或目录**
- `apps/api/src/**`
- `infra/**`（如新增）

**验收标准**
- 关键故障可在 10 分钟内定位。
- 告警可触发并可回溯。

**风险点**
- 告警噪声过高影响可用性。

**建议分支名**
`chore/p1-observability`

**建议 PR 标题**
`chore(obs): add logging metrics and alert baseline`

## [P2] 渠道转化与机构绩效看板

**背景**
持续优化阶段需关注渠道转化与机构绩效分析。

**目标**
支持机构维度的转化漏斗与交付效率分析。

**开发范围**
- 增加渠道来源维度指标。
- 管理后台新增转化与绩效看板。

**不做范围**
- 不做预测模型。

**涉及文件或目录**
- `apps/api/src/modules/admin/dashboard/**`
- `apps/web/src/components/admin/dashboard/**`

**验收标准**
- 可按机构查看核心转化指标。
- 指标口径清晰可复核。

**风险点**
- 指标定义争议导致口径不一致。

**建议分支名**
`feat/p2-channel-dashboard`

**建议 PR 标题**
`feat(admin): add channel conversion dashboard`

## [P2] 机构结算与对账模块（规划内）

**背景**
若进入规划，机构结算是 To B 商业化闭环关键。

**目标**
实现基础结算账单与对账流程。

**开发范围**
- 机构账单生成。
- 对账状态流转。
- 管理端结算审核入口。

**不做范围**
- 不做 ERP 深度打通。

**涉及文件或目录**
- `apps/api/src/modules/agency/**`
- `apps/api/src/modules/order/**`
- `apps/web/src/features/agency/**`

**验收标准**
- 账单可生成并可追踪状态。
- 审核流程可留痕。

**风险点**
- 财务规则变化频繁导致返工。

**建议分支名**
`feat/p2-agency-settlement`

**建议 PR 标题**
`feat(agency): add settlement and reconciliation baseline`

## [P2] 管理后台重页面性能优化（订单/任务）

**背景**
持续优化阶段需降低重列表页面查询与渲染成本。

**目标**
优化订单/任务页面性能，提升运营操作效率。

**开发范围**
- 后端查询与索引优化。
- 前端分页、缓存、懒加载优化。

**不做范围**
- 不做全站性能重构。

**涉及文件或目录**
- `apps/api/src/modules/admin/orders/**`
- `apps/api/src/modules/admin/tasks/**`
- `apps/web/app/(admin)/admin/orders/**`
- `apps/web/app/(admin)/admin/tasks/**`

**验收标准**
- 核心列表 P95 指标显著改善。
- 无功能回归。

**风险点**
- 缓存策略不当造成数据时效问题。

**建议分支名**
`perf/p2-admin-heavy-pages`

**建议 PR 标题**
`perf(admin): optimize heavy pages for orders and tasks`
