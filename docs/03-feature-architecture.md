# 03 功能架构（Feature Architecture）

| 模块 | 优先级 | 当前状态 | 后续动作 |
|---|---|---|---|
| 认证与权限 | P0 | 后端较完整，前端后台已接入 | 增加机构角色与机构数据权限边界；工作台需复用用户/机构/管理员三类授权策略 |
| 学生端下单与工作台 | P0 | 能力存在但前端不完整 | 补全 C 端闭环页面，并将任务详情升级为论文文档工作台 |
| 机构端推单/代下单 | P0 | 需求明确，产品层缺失 | 新增机构端入口、线索与代下单流程；支持代填学校、专业、论文类型与格式要求 |
| 商品与分类 | P0 | 管理端可维护 | 同步接入 C/B 端展示和购买引导；商品可声明适用学历层次、论文类型与交付阶段 |
| 订单与支付 | P0 | 后端有订单+支付+退款 | 增加机构下单场景与支付主体规则；论文工作台升级不得改变已支付订单结算口径 |
| 任务状态机 | P0 | 状态定义完整，管理端可操作 | 增强状态迁移审计、补偿机制；任务阶段需映射题目/开题/大纲/初稿/终稿等工作台文档 |
| 学术基础数据 | P0 | 尚未形成独立模块 | 新增省份、城市、高校、学院、学科门类、一级学科、专业/二级学科数据，并接入任务创建与后台维护 |
| 论文文档工作台 | P0 | 当前以生成结果与导出下载为主 | 支持阶段文档查看、在线合稿、章节编辑、版本记录、导师意见修改记录、按阶段导出 |
| 题目/开题/大纲/写作 | P1 | 后端能力已存在 | 增加阶段交付与返工协作可视化；生成时读取学校、专业、学历层次、论文类型上下文 |
| 论文 Skill 中心 | P1 | 当前主要依赖 Prompt 资产 | 建立 Skill/版本/适用范围/输入输出 schema/质量规则/模型配置，并逐步接入题目、开题、大纲、正文、修改等阶段 |
| 格式模板引擎 | P1 | 导出模块具备 DOCX 能力，学校模板能力有限 | 支持通用模板、学校模板、专业模板、自定义模板；支持格式要求解析并应用到导出任务 |
| 参考文献 | P1 | 后端模块存在 | 增加前端引用核验、缺失字段提醒、参考文献格式检查；禁止伪造引用 |
| 导出模块 | P1 | 后端 DOCX 能力存在 | 增加用户下载中心与机构可见性策略；导出任务需绑定文档版本、阶段、模板和格式参数 |
| Prompt 资产管理 | P1 | 管理后台已有 | 增加版本审批与灰度发布；作为 Skill 中心底层资产复用，不直接替代 Skill 编排 |
| 配额系统 | P1 | 后端有 quota | 增加机构渠道配额/额度策略（需确认）；SkillRun/AiGenerationRun 需可追溯扣费 |
| 合规与审计 | P1 | 支付与管理操作已有部分审计 | 增加原创性提示、引用核验提示、AI 辅助声明、导师意见修改记录、导出留痕 |
| 仪表盘与报表 | P2 | 管理端已有基础 | 增加渠道转化、机构绩效、Skill 成功率、引用待核验、格式检查失败等运营指标 |

## 说明
- 当前“后台能力 > 前台产品能力”。
- P0 主目标：形成“学生/机构下单 → 执行交付 → 工作台修改 → 分阶段导出 → 完成验收”的双通道闭环。
- 下一阶段以 `docs/15-thesis-workbench-upgrade-plan.md` 为总规划，先补齐学术基础数据、论文 Skill 中心、论文文档工作台和格式模板引擎的契约，再按 Issue 小步实现。
- 所有工作台能力必须保持合规边界：系统提供论文辅导与写作辅助，不伪造数据、不伪造引用、不承诺规避查重或替代学生原创。

## 论文交付工作台目标架构

```text
订单/支付（保持稳定）
  └─ Task 任务状态机
      ├─ Academic Context（学校/学院/专业/学历/论文类型）
      ├─ Skill Center（阶段 Skill、版本、质量规则、模型配置）
      ├─ Thesis Workbench（阶段文档、章节、版本、导师意见、合规提示）
      ├─ Reference（引用线索、核验状态、格式检查）
      └─ Export（文档版本 + 阶段 + 模板 + 格式要求 → 导出任务）
```

## 模块边界

### 学术基础数据
- 负责省市、高校、学院、学科目录、专业及高校开设专业的维护。
- 为学生端、机构端、管理端提供统一选择接口。
- Task 创建时保存关联 ID 与必要快照，避免后续基础数据改名影响历史任务。

### 论文 Skill 中心
- 负责论文阶段能力配置，不直接承载订单或支付逻辑。
- 以 SkillVersion 为最小运行单元，运行时固化输入 schema、输出 schema、质量检查规则和模型配置。
- 与现有 Prompt 模块关系：Prompt 是可复用提示词资产，Skill 是面向业务阶段的编排与约束层。

### 论文文档工作台
- 负责阶段文档、章节树、在线编辑、合稿、版本、导师意见和合规留痕。
- 与现有 opening-report、outline、writing 模块保持兼容：首期通过同步/映射方式把阶段产物纳入工作台，不强制一次性重构旧模块。

### 格式模板引擎
- 负责模板元数据、模板适用范围、格式规则 JSON、模板优先级解析和导出参数编排。
- 与现有 export 模块关系：export 继续负责异步任务、文件生成、下载和清理；格式模板引擎提供导出配置与版本快照。

## Academic-01 学术基础数据模块实现说明
- Issue #137 已新增学术基础数据模块，覆盖省份、城市、高校、学院、专业、学科门类、一级学科、二级学科/具体专业。
- 该模块为论文任务创建流程提供公开联动下拉 API，但本 Issue 不改造任务创建流程；后续 Task-01 将把 `AcademicSchool`、`AcademicCollege`、`AcademicMajor` 接入任务学术上下文。
- 该模块为论文 Skill 中心提供学校、学历层次、专业和学科目录匹配依据，为格式模板引擎提供学校/学院/专业维度模板绑定依据，为 AI 生成上下文提供可追溯的学术标签。
- 后台通过“学术基础数据”入口维护高校、学院、专业和学科目录；删除动作采用 `status=INACTIVE` 软禁用，不物理删除重要基础数据。

## Skill-01 论文 Skill 中心实现说明
- Issue #138 已新增论文 Skill 中心，覆盖 Skill 基础信息、版本、适用范围绑定、测试运行和运行记录。
- Skill 中心不替换现有 AI 生成链路；首期通过 mock-preview 测试运行固化 `promptTemplate`、输入输出 schema、质量规则与模型配置，后续由 Task-01/AI 接入阶段调用 `resolveBestSkill` 匹配最合适版本。
- Skill 与论文任务关系：`ThesisSkillRun.taskId` 可选关联任务，测试运行可不绑定任务；后续真实生成运行应写入任务与阶段上下文。
- Skill 与学术基础数据关系：`ThesisSkillBinding` 可按学校、专业、学科门类、一级学科、二级学科、学历层次、论文类型设置适用范围和优先级。
- Skill 与导出/格式检查关系：`FORMAT_CHECK`、`REFERENCE`、`DEFENSE` 等阶段 Skill 为后续格式模板、参考文献核验和答辩材料提供可版本化策略。
- 合规边界：内置默认 Prompt 明确系统用于论文辅导、写作辅助、结构优化、格式检查和学习支持，不用于代写、伪造数据、伪造引用或承诺规避查重。

## Task-01 论文任务学术上下文接入（Issue #139 已实现）
- 论文任务在保留 legacy `schoolId`（旧 `School` / `SchoolTemplate` 兼容字段）的同时，新增 Academic-01 上下文字段：省份、城市、Academic 高校、学院、专业、学科门类、一级学科、二级学科、学历层次、论文类型、研究方向、导师要求与预留格式模板 ID。
- 学生端任务创建表单通过 `/academic/*` 公开查询接口完成省份→城市→高校→学院→专业联动，创建任务时写入标准化学术上下文；旧任务无这些字段时仍按原 `major`、`educationLevel`、`requirements` 展示与生成。
- 后台任务详情新增学术上下文展示与维护入口，后台列表返回 `schoolName`、`majorName`、`educationLevel`、`thesisType`，并支持按 Academic 高校、专业、学历层次和论文类型筛选。
- TaskService 新增 `buildGenerationContext(taskId, stage?, userRequirement?)`，统一生成 `ThesisGenerationContext`，供后续 AI 生成与 Skill-01 的 `resolveBestSkill` 基于学校、专业、学科、学历、论文类型和阶段匹配 Skill。
- 本次不改造订单、支付、任务状态流转、导出任务或完整 AI 生成主流程；仅提供统一上下文与兼容接入点。

## Workbench-01 论文文档工作台实现说明
- Issue #140 已新增学生端论文文档工作台，将任务从“阶段生成/下载”扩展为“结构化文档 + 章节编辑 + 版本记录 + 导师意见”的持续交付空间。
- 工作台与论文任务一一关联：`Task 1-1 ThesisDocument`，文档继承 Task-01 的学校、专业、学历层次、论文类型、研究方向、导师要求等上下文，用于顶部摘要、后续 AI/Skill 输入和导出模板匹配。
- 工作台与 Skill 中心关系：章节保留 `sourceStage`、`sourceGenerationRunId`，AI 操作台首期为占位提示，后续可基于 Skill-01 对当前章节执行优化、导师意见修改、格式检查等能力。
- 工作台与 AI 生成关系：`merge-stage-content` 首期从已选题目、开题报告、大纲、正文、参考文献或指定 `AiGenerationRun` 读取内容并转为文档章节，不重构现有 AI 生成链路。
- 工作台与下载导出关系：原下载页面保留；工作台导出入口首期跳转 `/downloads`，后续 Export-01 从 `ThesisDocument` 读取结构化内容生成 Word/PDF。
- 工作台与导师意见/版本记录关系：章节保存时产生 `ThesisDocumentRevision`，导师线下反馈可记录为 `ThesisAdvisorComment` 并标记已解决或忽略。
- 合规边界：页面提示 AI 生成与编辑内容仅作为学习和写作辅助，学生需自行核验学校规范、导师要求、事实、数据、案例和引用。

## Export-01 论文格式模板与导出引擎实现说明
- Issue #141 新增论文格式模板与导出引擎，将原“下载与交付验收”升级为模板驱动的“论文导出中心”。
- 与学术基础数据关系：`ThesisFormatTemplate` 可按 Academic-01 的高校、学院、专业绑定适用范围；没有学校模板时回退通用默认模板，避免导出失败。
- 与论文任务关系：导出选项读取 Task-01 的学校、专业、学历层次、论文类型和阶段上下文，用于模板匹配与页面展示。
- 与论文文档工作台关系：新版 `ThesisExportJob` 从 `ThesisDocument` 与章节树读取结构化内容生成 DOCX；没有文档时提示先进入工作台初始化。
- 与文件下载关系：旧 `ExportTask`、`/api/export/*` 下载链路保留；新版导出使用 `ThesisExportJob` 与 `ThesisExportFile`，文件下载通过 `/api/thesis-export-jobs/:jobId/download` 完成。
- PDF 策略：首期仅预留枚举、接口和前端选项；创建 PDF 任务时返回明确提示，不引入 LibreOffice/Chromium/Puppeteer 等高风险依赖。
- 合规边界：导出页面与默认模板说明强调格式整理和学习支持，学生需按学校正式模板、导师要求、真实资料和引用自行核验。

## Export-DOCX-01 DOCX 初稿生成模块说明
- Export-DOCX-01 将合稿与格式页面中的 `ThesisDocument` 结构化主版本生成 Word 初稿，明确“AI 生成内容是素材、合稿文档是生成 DOCX 前的主版本”。
- DOCX 生成读取 `ThesisDocument`、`ThesisDocumentSection`、`ThesisFormatTemplate`、`ThesisFormatRule` 与 `ThesisDocumentFormatSetting`，按“文档格式设置 overrideRules > 模板规则 > 系统默认样式”的优先级应用格式。
- 生成结果落到 `ThesisWordFile` 当前文件对象，并为每次重新生成创建一条 `ThesisWordFileVersion`，便于追溯生成时的文档版本、模板和格式设置快照。
- 本模块不接入 ONLYOFFICE，不做在线 Word 编辑；后续 OnlyOffice-01 基于 `ThesisWordFile` 打开在线编辑器，Final-Delivery-01 以 Word 文件版本作为交付依据。

## OnlyOffice-01 在线 Word 精修模块说明
- OnlyOffice-01 在 Export-DOCX-01 生成的 `ThesisWordFile` 基础上接入 ONLYOFFICE Document Server，将 Word 初稿打开为在线编辑器，供学生进行最终排版、复杂表格、图片、页眉页脚等精修。
- 在线编辑保存后，后端通过 ONLYOFFICE callback 下载最新 DOCX，并创建 `ThesisWordFileVersion`，`sourceType=ONLYOFFICE_EDITED`；历史 `GENERATED_FROM_DOCUMENT` 与 `ONLYOFFICE_EDITED` 版本都保留。
- Word 精修后的文件不反向解析回 `ThesisDocumentSection`，合稿与格式仍是结构化主版本，Word 文件版本用于后续 Final-Delivery-01 的最终交付依据。
- 安全边界：editor config、当前文件下载、历史版本下载均校验任务归属；ONLYOFFICE 内部文件 URL 与 callback URL 使用短期签名，JWT 可按环境启用。
