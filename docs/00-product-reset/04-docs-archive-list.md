# Docs 建议归档清单

> 建议未来移动到 `docs/90-archive/2026-legacy-plans/`。本轮不移动、不删除。

| 当前文件路径 | 建议归档原因 | 是否有内容需要合并到新文档 | 合并目标文档 | 归档优先级 | 风险备注 |
|---|---|---|---|---|---|
| `docs/12-gitbub-is sues.md` | 文件名拼写异常且含空格，疑似旧 Issue 拆分文档，与 10/13 重复。 | 是 | `docs/04-delivery/github-issues.md` | HIGH | 先抽取仍有效 Issue，避免丢失历史任务。 |
| `docs/08-development-plan.md` | 与 `08-development-roadmap.md` 编号冲突且主题重复。 | 是 | `docs/04-delivery/development-execution-plan.md` | HIGH | 需确认哪个计划更新。 |
| `docs/08-development-roadmap.md` | 与 `08-development-plan.md` 编号冲突；可合并为路线图来源。 | 是 | `docs/04-delivery/development-execution-plan.md` | MEDIUM | Phase 信息仍有参考价值。 |
| `docs/13-githubissues-task.md` | 与 GitHub Issues 文档重复，命名不规范。 | 是 | `docs/04-delivery/github-issues.md` | HIGH | 归档前合并未完成任务。 |
| `docs/13-remaining-feature-analysis.md` | 阶段性剩余功能分析，易与下一步计划冲突。 | 是 | `docs/04-delivery/development-execution-plan.md` | MEDIUM | 仍可作为风险输入。 |
| `docs/14-next-development-plan.md` | 下一阶段计划与多个计划文档重复，编号冲突。 | 是 | `docs/04-delivery/development-execution-plan.md` | HIGH | 需明确当前有效计划后归档。 |
| `docs/15-payment-module-implementation-plan.md` | 支付实施阶段计划可能已被后续审计/开发指南覆盖。 | 是 | `docs/03-modules/payment-credit/payment-overview.md` | MEDIUM | 保留决策依据和未完成项。 |
| `docs/16-payment-module-issues.md` | 支付小 PR 拆分，偏阶段性执行文档。 | 是 | `docs/04-delivery/github-issues.md`、`docs/03-modules/payment-credit/payment-audit.md` | HIGH | 若仍有未完成支付 Issue，需转入新 Issue 索引。 |
| `docs/10-github-issues.md` | Issue 列表应统一到 delivery，不宜长期留根目录。 | 是 | `docs/04-delivery/github-issues.md` | MEDIUM | 可能是最完整来源，归档前慎重。 |
| `docs/11-development-execution-plan.md` | 执行计划应迁入 delivery；旧根目录入口可归档。 | 是 | `docs/04-delivery/development-execution-plan.md` | MEDIUM | 作为新计划主来源时不应立即归档内容。 |
| `docs/14-launch-risk-audit-payment-credit.md` | 同时属于支付专项和发布风险；根目录位置不合适。 | 是 | `docs/04-delivery/launch-checklist.md`、`docs/03-modules/payment-credit/payment-audit.md` | MEDIUM | 支付/额度上线风险仍关键，不可直接丢弃。 |
| `docs/payment.md` | 旧 Payment 总览与 17/18/19 重复，变量名可能需复核。 | 是 | `docs/03-modules/payment-credit/payment-overview.md` | MEDIUM | FAQ 和状态机说明有价值。 |
| `docs/03-feature-architecture.md` | 已混入大量实现记录，原功能架构被稀释。 | 是 | `docs/01-product/03-feature-map.md`、`docs/03-modules/*` | MEDIUM | 不建议直接归档，应先重写新功能地图。 |
| `docs/09-acceptance-checklist.md` | 总验收清单过度膨胀，混合多个模块/Issue 验收。 | 是 | `docs/01-product/05-acceptance-checklist.md`、`docs/04-delivery/launch-checklist.md` | MEDIUM | 未拆分前仍是最完整验收来源。 |
| `docs/order-refactor/02-business-rules.md` | 多项规则为推断和待确认，不宜作为当前决策基线。 | 否 | `docs/03-modules/order-refactor/` | LOW | 暂不建议动，仅标注“待确认”。 |
| `docs/order-refactor/03-service-package-design.md` | 套餐模型规划可能超出市场 MVP。 | 否 | `docs/03-modules/order-refactor/` | LOW | 暂保留为专项探索。 |
