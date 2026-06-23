# Docs 文档入口

当前 `docs/` 目录正在进行产品方向纠偏前的文档汇总与整理。本轮目标是先盘点现有文档，不删除、不移动旧文档，不修改业务源码，为后续重新判断市场 MVP 方向提供依据。

## 当前文档入口

建议优先阅读本次整理分析目录：

1. `docs/00-product-reset/00-docs-current-summary.md`
2. `docs/00-product-reset/01-docs-inventory.md`
3. `docs/00-product-reset/02-docs-restructure-plan.md`
4. `docs/00-product-reset/03-docs-merge-map.md`
5. `docs/00-product-reset/04-docs-archive-list.md`

## 关于 `00-product-reset`

`00-product-reset/` 是本次“产品方向纠偏前”的整理分析目录，包含：

- 当前 docs 状态总览；
- 全量文档清单；
- 新目录结构建议；
- 重复/交叉文档合并映射；
- 未来建议归档清单。

## 旧文档状态

旧文档暂未移动，仍保留在原路径。当前所有 `KEEP`、`MERGE`、`REWRITE`、`MOVE`、`ARCHIVE` 都只是建议处理方式，不代表本轮已经执行迁移。

## 后续建议阅读顺序

1. 先读 `00-product-reset/00-docs-current-summary.md`，理解当前文档体系问题与产品方向判断。
2. 再读 `00-product-reset/01-docs-inventory.md`，查看每个文件的主题、有效性和建议处理方式。
3. 然后读 `00-product-reset/02-docs-restructure-plan.md`，确认未来目录结构。
4. 接着读 `00-product-reset/03-docs-merge-map.md`，确认重复内容如何合并。
5. 最后读 `00-product-reset/04-docs-archive-list.md`，确认哪些文件未来可归档。

## 后续整理步骤建议

1. 确认市场 MVP 方向：优先 To C 自助下单，还是 To C + To B 双通道。
2. 基于确认后的 MVP，重写 `01-product/` 产品基线文档。
3. 核对代码现状后重写 `02-technical/` 技术、数据、API 基线。
4. 将支付、论文工作台、学术数据、AI 生成、订单重构下沉到 `03-modules/`。
5. 将 Issue、开发计划、发布验收迁入 `04-delivery/`。
6. 将已合并且过期的旧计划/Issue 文档移动到 `90-archive/2026-legacy-plans/`。
