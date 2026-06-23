# Docs 文档清单汇总

> 说明：本清单基于当前仓库 `docs/` 下现有 Markdown 文件整理；本轮不删除、不移动旧文档，仅给出建议。

| 序号 | 当前文件路径 | 文档主题 | 主要内容摘要 | 所属模块 | 文档类型 | 是否当前有效 | 是否可能过期 | 是否与其他文档重复 | 建议处理方式 | 建议新位置 | 备注 |
|---:|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `docs/00-project-overview.md` | 项目总览 | 定位为论文生产与交付平台，说明 To C/To B、技术栈与阶段判断。 | 全局 | PRODUCT | 是 | 否 | 是 | MERGE | `docs/01-product/00-product-overview.md` | 与 01/03 有定位重复，适合作为产品总览主来源。 |
| 2 | `docs/01-product-design.md` | 产品设计 | 目标用户、核心场景、页面结构、MVP/非 MVP、四阶段任务命名。 | 产品 | PRODUCT | 是 | 部分 | 是 | MERGE | `docs/01-product/00-product-overview.md`、`02-market-mvp-flow.md` | MVP 段有效，但目标态页面与后续专项混杂。 |
| 3 | `docs/02-user-roles-and-flows.md` | 用户角色与流程 | USER/VIP/AGENCY/TUTOR/ADMIN 角色、To C/To B/任务/售后流程与三方影响。 | 产品/权限 | PRODUCT | 是 | 部分 | 是 | KEEP | `docs/01-product/01-user-roles-and-flows.md` | 应保留为角色流程基线，补充机构权限确认项。 |
| 4 | `docs/03-feature-architecture.md` | 功能架构 | P0/P1/P2 功能模块、论文工作台目标架构、Academic/Skill/Task/Workbench/Export/OnlyOffice 实现记录。 | 功能架构 | TECH | 是 | 部分 | 是 | REWRITE | `docs/01-product/03-feature-map.md`、`docs/03-modules/*` | 已从功能架构膨胀为模块实现记录。 |
| 5 | `docs/04-technical-architecture.md` | 技术架构 | Monorepo、前后端分层、数据流、权限、部署与风险。 | 技术 | TECH | 是 | 部分 | 是 | KEEP | `docs/02-technical/00-technical-architecture.md` | 可作为技术总览，但需与代码现状复核。 |
| 6 | `docs/05-data-model.md` | 数据模型 | 核心实体、关系、支付有效期、论文工作台建议数据模型等。 | 数据 | DATA | 是 | 部分 | 是 | REWRITE | `docs/02-technical/01-data-model.md` | 含规划与补充记录，需拆出现状模型与规划模型。 |
| 7 | `docs/06-api-design.md` | API 设计 | 接口分组、C/B/管理端接口、返回结构、错误规范、后续专项接口。 | API | API | 是 | 部分 | 是 | REWRITE | `docs/02-technical/02-api-design.md` | 应核对现有 Controller 后重写为当前契约。 |
| 8 | `docs/07-ui-design-guidelines.md` | UI 规范 | 管理端/C 端/B 端布局、组件状态、表单、移动端、工作台 UI。 | UI | UI | 是 | 部分 | 否 | KEEP | `docs/01-product/04-ui-guidelines.md` | 可保留为 UI 基线，后续补充市场 MVP 页面。 |
| 9 | `docs/08-development-plan.md` | 开发计划 | 阶段目标、优先级和研发推进计划。 | 交付 | PLAN | 部分 | 是 | 是 | MERGE | `docs/04-delivery/development-execution-plan.md` | 与 roadmap/execution/next plan 重复。 |
| 10 | `docs/08-development-roadmap.md` | 开发路线图 | Phase 0/1/2 双通道闭环、稳定性、优化方向。 | 交付 | PLAN | 部分 | 是 | 是 | MERGE | `docs/04-delivery/development-execution-plan.md` | 编号冲突，应合并。 |
| 11 | `docs/09-acceptance-checklist.md` | 验收清单 | 功能、UI、性能、安全、部署、支付、工作台、Academic/Skill/Export 等验收项。 | 验收 | ACCEPTANCE | 是 | 部分 | 是 | REWRITE | `docs/01-product/05-acceptance-checklist.md`、`docs/04-delivery/launch-checklist.md` | 过长且混合多个 Issue 验收。 |
| 12 | `docs/10-github-issues.md` | GitHub Issues | 项目 Issue 拆分。 | 交付 | ISSUE | 部分 | 是 | 是 | MERGE | `docs/04-delivery/github-issues.md` | 与 12/13 issues 重复。 |
| 13 | `docs/11-development-execution-plan.md` | 执行计划 | 研发执行、顺序、验证与交付安排。 | 交付 | PLAN | 部分 | 是 | 是 | MERGE | `docs/04-delivery/development-execution-plan.md` | 可作为交付计划来源之一。 |
| 14 | `docs/12-gitbub-is sues.md` | GitHub Issues | 文件名存在拼写/空格问题的 Issue 文档。 | 交付 | ISSUE | 否 | 是 | 是 | ARCHIVE | `docs/90-archive/2026-legacy-plans/` | 明显命名异常，需先合并有效内容。 |
| 15 | `docs/12-text-generation-engine-design.md` | 文本生成引擎 | AI 文本生成引擎设计、Prompt/生成链路规划。 | AI 生成 | MODULE | 部分 | 部分 | 是 | MOVE | `docs/03-modules/ai-generation/text-generation-engine-design.md` | 应作为 AI 模块专项文档。 |
| 16 | `docs/13-githubissues-task.md` | GitHub Issue 任务 | 任务拆分与执行项。 | 交付 | ISSUE | 部分 | 是 | 是 | MERGE | `docs/04-delivery/github-issues.md` | 与 10/12 重复且编号冲突。 |
| 17 | `docs/13-remaining-feature-analysis.md` | 剩余功能分析 | 剩余功能、风险和补齐建议。 | 交付/产品 | PLAN | 部分 | 是 | 是 | MERGE | `docs/04-delivery/development-execution-plan.md` | 与 next plan 高度交叉。 |
| 18 | `docs/14-launch-risk-audit-payment-credit.md` | 上线风险审计 | 围绕支付/脑细胞额度的上线风险与审计。 | 支付/额度 | ACCEPTANCE | 是 | 部分 | 是 | MOVE | `docs/04-delivery/launch-checklist.md`、`docs/03-modules/payment-credit/` | 可拆为发布风险与支付专项。 |
| 19 | `docs/14-next-development-plan.md` | 下一步开发计划 | 下一阶段开发重点与任务安排。 | 交付 | PLAN | 部分 | 是 | 是 | MERGE | `docs/04-delivery/development-execution-plan.md` | 编号冲突，应合并。 |
| 20 | `docs/15-payment-module-implementation-plan.md` | 支付模块实施计划 | 支付模块落地分阶段方案。 | 支付 | MODULE | 部分 | 是 | 是 | MERGE | `docs/03-modules/payment-credit/payment-implementation-plan.md` | 与 payment 系列重复。 |
| 21 | `docs/15-thesis-workbench-upgrade-plan.md` | 论文工作台升级 | 学术数据、Skill、工作台、格式模板、导出、合规的升级规划。 | 论文工作台 | MODULE | 是 | 部分 | 是 | KEEP | `docs/03-modules/thesis-workbench/upgrade-plan.md` | 仍是工作台专项主文档。 |
| 22 | `docs/16-payment-module-issues.md` | 支付 Issue 拆分 | 支付底座、Adapter、微信/支付宝等小 PR 拆分。 | 支付 | ISSUE | 部分 | 是 | 是 | ARCHIVE | `docs/90-archive/2026-legacy-plans/` | 完成后仅保留历史参考。 |
| 23 | `docs/17-payment-module-audit.md` | 支付审计 | 当前支付接口、模型、风险和生产级完善方案。 | 支付 | MODULE | 是 | 部分 | 是 | KEEP | `docs/03-modules/payment-credit/payment-audit.md` | 可保留为支付审计基线。 |
| 24 | `docs/18-payment-development-guide.md` | 支付开发指南 | 支付配置、微信/支付宝补充、生产签名与查单等开发说明。 | 支付 | MODULE | 是 | 部分 | 是 | MERGE | `docs/03-modules/payment-credit/payment-development-guide.md` | 与 19/payment.md 部分重复。 |
| 25 | `docs/19-payment-production-deploy-guide.md` | 支付生产部署 | secrets、环境变量、部署步骤和回滚。 | 支付/部署 | DEPLOY | 是 | 部分 | 是 | KEEP | `docs/02-technical/04-production-deploy-guide.md`、`docs/03-modules/payment-credit/` | 支付部署专项有效。 |
| 26 | `docs/academic-data-import.md` | 学术数据导入 | 高校数据来源、模板字段、校验、preview/confirm/upsert。 | 学术数据 | MODULE | 是 | 否 | 是 | MOVE | `docs/03-modules/academic-data/import.md` | 与 sync 同属学术数据模块。 |
| 27 | `docs/academic-data-sync.md` | 学术数据同步 | 地区数据同步、adcode、高德 API、mock、学院采集。 | 学术数据 | MODULE | 是 | 否 | 是 | MOVE | `docs/03-modules/academic-data/sync.md` | 与 import 合并为模块 README 更清晰。 |
| 28 | `docs/onlyoffice-deployment.md` | OnlyOffice 部署 | 本地/全 Docker/云端部署、变量、联调和常见问题。 | OnlyOffice/部署 | DEPLOY | 是 | 部分 | 是 | MOVE | `docs/03-modules/thesis-workbench/onlyoffice-deployment.md` | 工作台在线 Word 精修专项。 |
| 29 | `docs/payment.md` | Payment 模块说明 | 订单状态机、沙箱模式、上线 Checklist、回调、证书、FAQ。 | 支付 | MODULE | 是 | 部分 | 是 | MERGE | `docs/03-modules/payment-credit/payment-overview.md` | 作为支付总览，但变量名需与 19 核对。 |
| 30 | `docs/order-refactor/01-backend-discovery.md` | 订单重构后端调研 | Task/Order/状态机/模型与接口现状调研。 | 订单重构 | MODULE | 部分 | 是 | 是 | KEEP | `docs/03-modules/order-refactor/01-backend-discovery.md` | 作为 ORD-1 历史调研保留。 |
| 31 | `docs/order-refactor/02-business-rules.md` | 订单业务规则 | 修改轮次、退款、跳阶段、导师、版本、截止日期等规则推断。 | 订单重构 | MODULE | 部分 | 是 | 是 | KEEP | `docs/03-modules/order-refactor/02-business-rules.md` | 多处待业务确认，应标记非决策基线。 |
| 32 | `docs/order-refactor/03-service-package-design.md` | 套餐模型设计 | ServicePackage 目标、类型、与现有后端关系。 | 订单重构 | MODULE | 部分 | 是 | 是 | KEEP | `docs/03-modules/order-refactor/03-service-package-design.md` | 适合作为专项规划，不进入 MVP 主线。 |
| 33 | `docs/order-refactor/04-api-contract.md` | 订单 API 契约 | 已有订单/支付/任务接口与重构新增契约草案。 | 订单重构/API | API | 部分 | 是 | 是 | KEEP | `docs/03-modules/order-refactor/04-api-contract.md` | 草案性质，不应覆盖主 API 基线。 |
| 34 | `docs/order-refactor/05-status-mapping.md` | 状态映射 | TaskStatus/TaskStage 到前端阶段状态映射。 | 订单重构 | MODULE | 部分 | 是 | 是 | KEEP | `docs/03-modules/order-refactor/05-status-mapping.md` | 专项映射表，需与最新代码复核。 |
