# 04 一期 MVP 功能裁剪决策

> 依据来源：本文基于 `docs/00-product-reset/03-docs-merge-map.md` 与 `docs/00-product-reset/04-docs-archive-list.md` 的重复文档、归档建议和专项拆分结论，进一步转化为一期市场 MVP 的产品裁剪口径。

## 1. 决策标签说明

| 标签 | 含义 |
|---|---|
| KEEP | 进入一期 MVP 主线，必须验收。 |
| LIGHT_ENTRY | 保留轻量入口或最小可用能力，不展开复杂流程。 |
| DEFER | 暂缓到后续版本，不作为一期验收门槛。 |
| ARCHIVE | 相关旧计划/Issue 文档后续可归档，不再驱动一期开发。 |
| REWRITE | 需要按本轮 MVP 口径重写，不沿用旧文档的大范围规划。 |

## 2. 功能裁剪决策表

| 功能或模块 | 当前文档来源 | 决策 | 决策理由 | 对 MVP 的影响 | 后续版本建议 |
|---|---|---|---|---|---|
| OnlyOffice 在线 Word 深度协同编辑 | `docs/onlyoffice-deployment.md`、`docs/15-thesis-workbench-upgrade-plan.md`、`docs/00-product-reset/03-docs-merge-map.md` M07 | DEFER | 部署、回调、在线编辑器联调复杂；一期只需要可编辑 Word 导出，不需要深度在线协同。 | 不作为发行阻塞项；用户通过 DOCX/Word 下载完成交付。 | 在 Word 导出稳定、用户确有在线编辑需求后再进入 P1/P2。 |
| 写手任务池 | 旧用户流程、订单重构与计划类文档中涉及的写手/导师/任务分配思路 | DEFER | 公共任务池、抢单、接单、反馈、结算会把产品推向供给侧平台，一期不需要。 | 人工服务先由后台基础处理入口承接。 | 当人工服务需求量稳定后，再设计写手池和服务 SLA。 |
| 机构端 | `docs/00-project-overview.md`、`docs/01-product-design.md`、`docs/02-user-roles-and-flows.md`、`docs/00-product-reset/03-docs-merge-map.md` M01/M02 | DEFER | 机构代下单和批量协同会引入权限、归属、结算和交付复杂度；一期先验证学生自助付费。 | 不进入一期主流程，不作为首页和开发 Issue 优先级。 | 若后续确认 To B 是增长主线，再单独建立机构端 MVP。 |
| 支付模块 | `docs/payment.md`、`docs/15-19 payment` 系列、`docs/14-launch-risk-audit-payment-credit.md`、M06/M11 | KEEP | 充值购买额度是商业闭环核心；支付状态和额度到账必须可靠。 | 一期 P0，必须验收支付、订单状态、额度到账、异常处理。 | 后续再收敛支付文档到 payment-credit 模块，并补充对账/退款深度能力。 |
| AI 生成模块 | `docs/12-text-generation-engine-design.md`、`docs/03-feature-architecture.md`、M12 | KEEP | AI 论文内容生成是一句话定位和付费理由的核心。 | 一期 P0，必须完成输入要求、生成、失败处理、结果保存。 | 后续再做多模型、Skill、Agent、质量评估和灰度策略。 |
| DOCX / Word 导出 | `docs/15-thesis-workbench-upgrade-plan.md`、`docs/09-acceptance-checklist.md`、M07/M11 | KEEP | Word 文件是用户可感知交付物，也是 AI 内容从“结果”变成“资产”的关键。 | 一期 P0，必须能从保存内容导出可编辑 Word。 | 后续再做学校模板、复杂格式检查、PDF、OnlyOffice。 |
| 论文工作台 | `docs/15-thesis-workbench-upgrade-plan.md`、`docs/03-feature-architecture.md`、M07 | LIGHT_ENTRY | 工作台概念有价值，但完整论文全生命周期工作台过重；一期只做“我的论文/任务 + 轻量合稿编辑”。 | 保留轻量合稿与格式调整，不做复杂协同和阶段状态。 | 根据用户使用数据决定是否升级为完整工作台。 |
| 学术基础数据 | `docs/academic-data-import.md`、`docs/academic-data-sync.md`、M09 | DEFER | 全量高校、学院、专业同步和治理不是一期成交必要条件。 | 一期可使用自由输入或少量枚举，不阻塞生成与导出。 | 后续为了提升生成质量和格式模板匹配，再建设模块化学术数据。 |
| 最终交付中心 | `docs/15-thesis-workbench-upgrade-plan.md`、`docs/09-acceptance-checklist.md` | LIGHT_ENTRY | 用户需要看到导出结果和人工服务状态，但不需要复杂交付中心。 | 一期保留“我的论文/我的任务/下载记录/服务状态”的轻量入口。 | 后续可整合版本、签收、评价、售后。 |
| 管理后台 | `docs/03-feature-architecture.md`、`docs/09-acceptance-checklist.md`、`docs/14-launch-risk-audit-payment-credit.md` | LIGHT_ENTRY | 上线必须有后台兜底，但不应建设复杂运营配置中心。 | 一期保留订单、支付、额度、生成失败、人工服务申请的基础处理。 | 后续再做配置、报表、权限、审计、绩效。 |
| 复杂任务状态机 | `docs/order-refactor/*`、`docs/02-user-roles-and-flows.md` | DEFER | 过细阶段流转会让一期开发偏离“生成初稿并导出 Word”。 | 一期只保留生成、保存、导出、人工服务申请等必要状态。 | 后续服务型业务成熟后再重构状态机。 |
| GitHub Issues 旧拆分 | `docs/10-github-issues.md`、`docs/12-gitbub-is sues.md`、`docs/13-githubissues-task.md`、M04 | ARCHIVE | 旧 Issue 拆分受旧产品方向影响，不能继续直接驱动开发。 | 后续 Issue 必须按本轮 MVP 范围重新排优先级。 | 重组时合并有效项，过期项归档。 |
| 旧开发计划/路线图 | `docs/08-development-plan.md`、`docs/08-development-roadmap.md`、`docs/11-development-execution-plan.md`、`docs/14-next-development-plan.md`、M03/M05 | REWRITE | 多份计划存在阶段冲突，需要按当前 MVP 重写执行计划。 | 本轮不直接执行旧计划；下一轮可重排 Issue。 | 在 `04-delivery/` 生成新的 market MVP execution plan。 |

## 3. 裁剪后的 MVP 原则

1. 用户主线优先于后台平台化能力。
2. AI 生成、额度支付、结果保存、Word 导出优先于复杂协同。
3. 人工服务作为升级入口和兜底，不先建设完整写手生态。
4. 学术数据、OnlyOffice、Skill/Agent、机构端都应以后续真实需求和收入数据驱动。
5. 后续所有 Issue 拆分先问：是否帮助学生完成“付费生成初稿并导出 Word”？不能回答“是”的，默认不进入一期 P0。
