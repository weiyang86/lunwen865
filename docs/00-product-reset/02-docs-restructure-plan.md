# Docs 重组建议

> 本文只提出新目录结构与迁移建议，本轮不执行 `git mv`，不删除旧文档。

## 1. 建议目录结构

```text
docs/
  README.md
  00-product-reset/
    00-docs-current-summary.md
    01-docs-inventory.md
    02-docs-restructure-plan.md
    03-docs-merge-map.md
    04-docs-archive-list.md
  01-product/
    00-product-overview.md
    01-user-roles-and-flows.md
    02-market-mvp-flow.md
    03-feature-map.md
    04-ui-guidelines.md
    05-acceptance-checklist.md
  02-technical/
    00-technical-architecture.md
    01-data-model.md
    02-api-design.md
    03-local-development-guide.md
    04-production-deploy-guide.md
  03-modules/
    ai-generation/
    payment-credit/
    thesis-workbench/
    order-refactor/
    academic-data/
  04-delivery/
    github-issues.md
    market-mvp-issues.md
    development-execution-plan.md
    launch-checklist.md
  90-archive/
    2026-legacy-plans/
```

## 2. 每个目录的用途

| 目录 | 用途 | 收口原则 |
|---|---|---|
| `docs/README.md` | 文档入口与阅读顺序 | 只放导航，不承载长篇设计。 |
| `00-product-reset/` | 本轮产品方向纠偏前的盘点、清单、重组与归档建议 | 保留为整理过程依据。 |
| `01-product/` | 产品定位、用户、市场 MVP、功能地图、UI 与验收 | 面向产品决策和市场验证。 |
| `02-technical/` | 技术架构、数据模型、API、本地开发、生产部署 | 面向工程基线，必须与代码现状定期核对。 |
| `03-modules/` | AI、支付、论文工作台、订单重构、学术数据等模块专项 | 只放模块深水区设计和专项部署。 |
| `04-delivery/` | Issue、执行计划、上线清单、验收节奏 | 面向项目交付，不替代产品定义。 |
| `90-archive/` | 历史阶段计划、过期 Issue 拆分、重复文档 | 只归档不删除，保留追溯。 |

## 3. 当前 docs 文件归入建议

| 当前文件 | 建议归入目录 | 建议处理 |
|---|---|---|
| `00-project-overview.md` | `01-product/00-product-overview.md` | 合并。 |
| `01-product-design.md` | `01-product/00-product-overview.md`、`02-market-mvp-flow.md` | 拆分合并。 |
| `02-user-roles-and-flows.md` | `01-product/01-user-roles-and-flows.md` | 保留并微调。 |
| `03-feature-architecture.md` | `01-product/03-feature-map.md`、`03-modules/*` | 重写，模块实现记录下沉。 |
| `04-technical-architecture.md` | `02-technical/00-technical-architecture.md` | 保留。 |
| `05-data-model.md` | `02-technical/01-data-model.md` | 重写为当前模型基线。 |
| `06-api-design.md` | `02-technical/02-api-design.md` | 重写为当前 API 基线。 |
| `07-ui-design-guidelines.md` | `01-product/04-ui-guidelines.md` | 保留。 |
| `08-development-plan.md`、`08-development-roadmap.md`、`11-development-execution-plan.md`、`14-next-development-plan.md` | `04-delivery/development-execution-plan.md` | 合并。 |
| `09-acceptance-checklist.md` | `01-product/05-acceptance-checklist.md`、`04-delivery/launch-checklist.md` | 拆分重写。 |
| `10-github-issues.md`、`12-gitbub-is sues.md`、`13-githubissues-task.md` | `04-delivery/github-issues.md` | 合并后归档旧文件。 |
| `12-text-generation-engine-design.md` | `03-modules/ai-generation/` | 移动为模块专项。 |
| `13-remaining-feature-analysis.md` | `04-delivery/development-execution-plan.md` | 合并后归档。 |
| `14-launch-risk-audit-payment-credit.md` | `04-delivery/launch-checklist.md`、`03-modules/payment-credit/` | 拆分。 |
| `15-payment-module-implementation-plan.md`、`16-payment-module-issues.md`、`17-payment-module-audit.md`、`18-payment-development-guide.md`、`19-payment-production-deploy-guide.md`、`payment.md` | `03-modules/payment-credit/` | 合并成总览、审计、开发、部署。 |
| `15-thesis-workbench-upgrade-plan.md`、`onlyoffice-deployment.md` | `03-modules/thesis-workbench/` | 保留为模块专项。 |
| `academic-data-import.md`、`academic-data-sync.md` | `03-modules/academic-data/` | 合并成 README + import/sync。 |
| `order-refactor/*` | `03-modules/order-refactor/` | 暂时不动，作为独立模块文档。 |

## 4. 应合并的文档

1. 产品总览组：`00-project-overview.md` + `01-product-design.md` + `03-feature-architecture.md` 的产品定位/MVP/功能地图部分。
2. 用户流程组：`02-user-roles-and-flows.md` 保留为主文件，吸收 `01-product-design.md` 的页面结构和三方影响。
3. 计划组：两个 `08`、`11`、`13-remaining`、`14-next` 合并为交付计划。
4. Issue 组：`10`、异常命名 `12`、`13-githubissues-task` 合并为一个 Issue 索引。
5. 支付组：`payment.md` 与 `15-19` 支付系列拆分合并为支付总览、审计、开发指南、生产部署。
6. 学术数据组：`academic-data-import.md` 与 `academic-data-sync.md` 合并为学术数据模块说明。

## 5. 应归档的文档

优先归档编号冲突、命名异常、阶段性 Issue 拆分和已被后续文档替代的计划类文档：`12-gitbub-is sues.md`、`16-payment-module-issues.md`、旧计划组、旧 Issue 组。归档前必须先把仍有效内容合并到新文档。

## 6. 应重写的文档

- `03-feature-architecture.md`：重写为清晰功能地图，删除实现流水账。
- `05-data-model.md`：重写为当前数据模型基线，规划模型下沉模块文档。
- `06-api-design.md`：重写为当前 API 契约，避免草案与现状混杂。
- `09-acceptance-checklist.md`：拆成市场 MVP 验收、上线验收、模块验收。

## 7. 建议保留为模块专项的文档

- `15-thesis-workbench-upgrade-plan.md`
- `onlyoffice-deployment.md`
- `12-text-generation-engine-design.md`
- `academic-data-import.md`
- `academic-data-sync.md`
- `order-refactor/*`
- `17-payment-module-audit.md`
- `18-payment-development-guide.md`
- `19-payment-production-deploy-guide.md`

## 8. 暂时不要动的文档

- `order-refactor/*`：它们构成独立 ORD-1 调研链，贸然拆分会破坏上下文。
- `04-technical-architecture.md`：可先作为技术总览引用，待代码核对后再重写。
- `07-ui-design-guidelines.md`：当前未发现明显重复，先保留。
- 本轮新增的 `00-product-reset/*`：作为重组依据保留。
