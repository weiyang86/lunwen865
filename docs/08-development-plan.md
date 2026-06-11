# 08 开发计划（Development Plan）

> 本文件用于承接“论文交付工作台”阶段的可执行 Issue 拆分。历史路线图仍保留在 `docs/08-development-roadmap.md`；后续 Codex 开发应以本文件中的 Issue 边界小步实施，并默认 PR 到 `dev`。

## 1. 开发原则
- 每个 Issue 一个独立分支、一个独立 PR，默认从 `dev` 创建，默认合并回 `dev`。
- 不破坏现有支付、订单、任务、导出功能；涉及旧接口迁移时必须保留兼容路径或提供回滚方案。
- 涉及数据模型变更必须同步更新 `docs/05-data-model.md`、Prisma schema 与 migration 说明。
- 涉及接口变更必须同步更新 `docs/06-api-design.md`。
- 涉及 To B 机构流程必须说明学生视角、机构视角、管理视角三方影响。
- 每个 PR 描述必须包含 Trae 本地验证步骤：安装依赖、Docker、后端、前端、lint、typecheck、test、build、页面路径、接口测试方式、风险点、人工验收清单。

## 2. 推荐 Issue 拆分

### Issue 1：docs(thesis-workbench): finalize upgrade contracts
- 目标：沉淀论文交付工作台的产品、功能、数据、接口、验收契约。
- 开发范围：仅文档，包含 `docs/15-thesis-workbench-upgrade-plan.md`、功能架构、数据模型、API、开发计划、验收清单。
- 验收标准：文档覆盖学术基础数据、Skill 中心、合稿与格式、格式模板引擎、合规边界和后续 Issue 拆分。
- 风险点：规划过大导致后续 PR 边界不清；需保持本 Issue 不改业务代码。

### Issue 2：feat(academic-data): add academic catalog schema and admin seed workflow
- 目标：新增省市高校学院学科专业数据模型与最小初始化能力。
- 开发范围：Prisma schema、migration、seed/import 脚本、基础 Service；不接入前端页面。
- 验收标准：能通过脚本导入少量省市高校专业样例；重复导入可幂等；旧任务/订单/支付测试不受影响。
- 风险点：学校/专业数据量大，需避免一次性引入庞大数据；真实数据来源需人工确认授权。

### Issue 3：feat(academic-data): expose academic catalog APIs
- 目标：提供学生端、机构端、管理端可复用的学术基础数据查询接口。
- 开发范围：NestJS `academic-data` 模块、DTO、Controller、Service、权限策略、接口测试。
- 验收标准：省市、高校、学院、学科门类、一级学科、专业可分页/筛选查询；管理端可创建/更新/停用；错误码稳定。
- 风险点：查询性能与模糊搜索；需加索引并控制 pageSize。

### Issue 4：feat(task): add task academic profile
- 目标：任务支持学校、学院、专业、学历层次、论文类型、研究方向、导师/格式要求上下文。
- 开发范围：TaskAcademicProfile 或 Task 可空字段、创建/更新接口、审计日志、任务详情返回。
- 验收标准：学生、机构、管理端均可在权限范围内维护学术上下文；AI 生成可读取上下文快照；历史任务缺失时可正常展示。
- 风险点：`Task.schoolId` 既有含义需先梳理，避免破坏旧逻辑。

### Issue 5：ui(task-academic-profile): add academic selectors in task forms
- 目标：学生端/机构端/管理端在任务创建或补资料时选择学校、专业、学历层次、论文类型。
- 开发范围：Next.js 表单组件、联动选择器、loading/empty/error 状态、移动端适配。
- 验收标准：省市高校学院专业联动可用；刷新后状态保留；表单校验明确；机构只能编辑所属任务。
- 风险点：前端状态复杂；需避免把后端异常文本硬编码到 UI。

### Issue 6：feat(thesis-skill): add skill center schema and admin APIs
- 目标：建立论文 Skill、SkillVersion、SkillScope、SkillRun 的后端基础能力。
- 开发范围：Prisma schema、migration、NestJS 模块、管理端 CRUD/API、发布/停用、Scope 匹配逻辑。
- 验收标准：可创建 Skill、发布版本、配置适用范围；运行时可按任务上下文匹配 Skill 版本；历史版本不可被发布后变更影响。
- 风险点：Skill 与 Prompt 边界需清晰；模型配置和提示词需避免泄漏敏感信息。

### Issue 7：feat(thesis-skill): integrate skills with topic/opening/outline generation
- 目标：将 Skill 选择与运行记录接入题目、开题、大纲三个阶段。
- 开发范围：topic/opening-report/outline Service 小步接入 Skill 匹配、输入输出 schema、质量检查、SkillRun 记录。
- 验收标准：生成记录可追溯 SkillVersion；质量检查失败有明确状态；失败不错误扣费或可回滚额度。
- 风险点：现有生成链路和扣费链路不能被破坏；需补充回归测试。

### Issue 8：feat(thesis-workbench): add document/chapter/version schema and APIs
- 目标：新增合稿与格式核心数据结构和后端接口。
- 开发范围：ThesisDocument、ThesisChapter、ThesisDocumentVersion、AdvisorRevision、ComplianceNoticeLog；文档/章节/版本 API。
- 验收标准：可创建阶段文档、编辑章节、生成版本、回滚版本、记录导师意见；权限边界通过测试。
- 风险点：章节编辑并发覆盖；首期使用乐观锁或 updatedAt 校验。

### Issue 9：ui(thesis-workbench): build student/admin document workbench MVP
- 目标：提供学生端和管理端合稿与格式 MVP。
- 开发范围：`/tasks/[id]/workbench`、`/admin/tasks/[id]/workbench`、阶段导航、章节编辑、版本列表、导师意见、合规提示。
- 验收标准：loading/empty/error/success 状态齐全；移动端可用；刷新后保留当前文档；无权限任务不可访问。
- 风险点：页面可能过大，需拆分组件和 hooks，避免巨型页面组件。

### Issue 10：feat(format-template): add template engine schema and admin APIs
- 目标：建立通用/学校/专业/自定义格式模板配置能力。
- 开发范围：FormatTemplate、FormatTemplateScope、规则 JSON 校验、模板匹配服务、管理端 API。
- 验收标准：可配置模板、绑定学校/专业/阶段；导出前可获得默认模板；禁用模板不影响历史导出记录。
- 风险点：Word 格式复杂，首期需明确支持规则子集。

### Issue 11：feat(export): export by document version, stage, and format template
- 目标：升级导出任务，支持按阶段、文档版本和模板导出。
- 开发范围：ExportTask 扩展、导出 Service、队列参数、模板应用、旧接口兼容。
- 验收标准：题目/开题/大纲/初稿/终稿可分别导出；导出任务绑定版本；旧下载中心仍可使用。
- 风险点：异步任务期间内容变更导致不一致；必须引用不可变版本快照。

### Issue 12：feat(compliance): add originality, citation, AI notice, and audit checks
- 目标：补齐论文辅导合规边界和留痕。
- 开发范围：合规提示配置、用户确认记录、引用核验摘要、AI 辅助声明、导师意见修改覆盖检查。
- 验收标准：导出前能展示/记录合规提示；待核验引用有明确提示；导师意见修改可追溯。
- 风险点：合规文案需人工确认，避免过度承诺。

### Issue 13：ui(agency-workbench): expose authorized agency workbench view
- 目标：机构可查看所属任务交付进度、补充资料、提交协同备注。
- 开发范围：机构端工作台列表、任务工作台只读/有限编辑视图、机构权限校验。
- 验收标准：机构无法访问非所属任务；可查看阶段文档状态；可补充学校/专业/导师意见但不能越权改支付/订单。
- 风险点：To B 数据隔离必须重点测试。

### Issue 14：chore(observability): add workbench audit logs and operational metrics
- 目标：增加工作台、Skill、模板导出的审计和运营指标。
- 开发范围：审计日志、失败率统计、模板命中统计、引用待核验统计、后台仪表盘接口。
- 验收标准：高危操作有审计；Skill 失败和导出失败可按任务定位；不记录明文敏感信息。
- 风险点：日志量增长，需要清理策略与脱敏策略。

## 3. 建议分支命名
- `docs/issue-xxx-thesis-workbench-plan`
- `feature/issue-xxx-academic-data-schema`
- `feature/issue-xxx-academic-data-api`
- `feature/issue-xxx-task-academic-profile`
- `ui/issue-xxx-task-academic-selectors`
- `feature/issue-xxx-thesis-skill-center`
- `feature/issue-xxx-thesis-workbench-api`
- `ui/issue-xxx-thesis-workbench-mvp`
- `feature/issue-xxx-format-template-engine`
- `feature/issue-xxx-versioned-export`

## 4. 本地 Trae 验证模板
每个后续 PR 至少在描述中给出：
1. `pnpm install`
2. `docker compose up -d`
3. `pnpm --filter api start:dev`
4. `pnpm --filter web dev`
5. `pnpm --filter api lint` / `pnpm --filter web lint`
6. `pnpm --filter api test` / `pnpm --filter web test`
7. `pnpm --filter api build` / `pnpm --filter web build`
8. 需要人工访问的页面路径。
9. 需要人工测试的核心功能点。
10. Docker、数据库迁移、seed、环境变量变化说明。

## Academic-01（Issue #137）实现记录
- 已建设学术基础数据底座：省份、城市、高校、学院、专业、学科门类、一级学科、二级学科/具体专业。
- 已新增 NestJS `academic` 模块，提供公开查询 API 与后台管理 API。
- 已新增管理后台“学术基础数据”入口，包含高校、学院、专业、学科目录维护页面。
- 已新增 seed 样例数据：重庆、四川、重庆/成都/甘孜州、重庆师范大学、重庆建筑工程职业学院，以及工学/管理学/教育学/文学和示例专业。
- 本次不改造论文任务创建流程；后续 Task-01 需要在任务创建/补资料表单中调用公开查询 API，并把学校、学院、专业、学历层次、论文类型写入任务学术上下文。

## Skill-01（Issue #138）实现记录
- 已建设论文 Skill 中心：Skill 基础管理、版本管理、适用范围绑定、测试运行、运行记录。
- 已新增 Prisma migration `20260610110000_add_thesis_skill_center`，并在 seed 中内置 10 个论文辅导 Skill 及 active version。
- 已新增后台页面 `/admin/thesis-skills`、`/admin/thesis-skills/[id]`、`/admin/thesis-skills/runs`。
- 首期 test-run 使用 mock-preview：将 `promptTemplate` 与输入变量合成为 `resolvedPrompt` 并保存 `ThesisSkillRun`；不重构现有 AI 生成流程。
- 后续 Task-01 需要在任务创建/AI 生成上下文中调用 `resolveBestSkill`，把任务学术上下文、论文类型、学校/专业/学科范围接入 Skill 匹配。

## Task-01（Issue #139）实现记录
- 已为 `Task` 增加标准化 Academic-01 上下文字段与 migration `20260611100000_add_task_academic_context`，所有新增字段允许为空以兼容历史任务。
- 已升级学生端 `/tasks` 创建表单，使用 `/academic/provinces`、`/academic/cities`、`/academic/schools`、`/academic/colleges`、`/academic/majors` 联动选择省份、城市、高校、学院和专业，并提交学历层次、论文类型、研究方向和导师要求。
- 已升级任务创建/编辑/详情接口：创建时校验启用学校、学院、专业和学科关系；专业可自动回填学科字段；详情返回 `academicContext` 与名称摘要。
- 已升级后台任务列表与详情：列表展示学校/专业/学历/论文类型，后台详情可维护学术上下文；首期后台维护使用 ID 输入兼容，后续可抽取学生端联动选择器复用。
- 已新增 `TaskService.buildGenerationContext`，为后续 AI 生成和 Skill 匹配接入提供统一上下文。后续 Task-02/AI-01 应将真实生成流程改为读取该上下文并调用 Skill-01 `resolveBestSkill`。

## Workbench-01（Issue #140）实现记录
- 已新增 `ThesisDocument`、`ThesisDocumentSection`、`ThesisDocumentRevision`、`ThesisAdvisorComment` 数据模型和 migration `20260611130000_add_thesis_document_workbench`。
- 已新增 `thesis-document` NestJS 模块，支持文档查询/初始化、章节新增/编辑/删除、阶段内容合并、版本记录、导师意见创建与状态更新。
- 已新增学生端页面 `/student/tasks/[taskId]/workbench`，提供任务摘要、目录树、章节编辑、保存状态、修改记录、导师意见、合稿弹窗和 AI 操作台占位。
- 已在任务列表提供“合稿与格式”入口，并在后台任务详情返回 `thesisDocument` 摘要。
- 后续 Export-01 应从 `ThesisDocument` 与章节树读取结构化内容，按学校/专业模板生成 Word/PDF；后续 Skill 接入应基于当前章节和导师意见创建 SkillRun。

## Export-01（Issue #141）实现记录
- 已新增 `ThesisFormatTemplate`、`ThesisFormatRule`、`ThesisExportJob`、`ThesisExportFile` 数据模型和 migration `20260611150000_add_thesis_export_engine`。
- 已在 seed 中创建全局通用本科论文模板、通用开题报告模板、通用论文大纲模板，并在存在示例学校时创建“重庆师范大学本科论文示例模板（非官方）”。
- 已在导出模块中新增后台模板/规则 API、新版导出任务 API、学生端导出选项与下载 API，并实现 DOCX 基础生成。
- 已将学生端 `/downloads` 升级为论文导出中心，同时保留旧版 `ExportTask` 下载记录展示；工作台导出入口带 `taskId` 跳转导出中心。
- 已新增后台 `/admin/thesis-format-templates`、`/admin/thesis-format-templates/[id]`、`/admin/thesis-export-jobs` 页面。
- 后续增强：PDF 真实导出、模板上传 DOCX、高校官方模板解析、自定义格式要求自动解析、Word 自动目录、页眉页脚、图表目录、异步队列化新版导出任务。

## Task-UX-01（Issue #147）任务流程命名与四阶段导航
- 范围：仅调整学生端任务内入口、可见命名、路由兼容和文案说明，不接入 ONLYOFFICE，不开发 DOCX 生成，不重构 AI 生成，不改支付订单。
- 前端路由：新增 `/student/tasks/[taskId]/generate`、`/student/tasks/[taskId]/compose-format`、`/student/tasks/[taskId]/word-editor`、`/student/tasks/[taskId]/delivery`。
- 兼容策略：旧 `/student/tasks/[taskId]/workbench` redirect 到 `/student/tasks/[taskId]/compose-format`；旧 `/tasks?taskId=...` 仍保留为论文内容生成的兼容入口。
- 文案策略：原“阶段生成”统一展示为“论文内容生成”，原“文档工作台”统一展示为“合稿与格式”。
- 验证重点：四阶段导航可访问；原生成能力、原论文文档能力、下载与导出入口可继续使用；订单、支付、AI 生成、导出功能不受影响。

## Workbench-Format-01（Issue #148）实现记录
- 已复用 `ThesisFormatTemplate` 与 `ThesisFormatRule`，新增 `ThesisDocumentFormatSetting` 记录当前论文应用模板、局部覆盖规则、自定义格式要求和预览模式。
- 已补充默认 seed：通用本科毕业论文、通用专升本毕业论文、通用开题报告、通用论文大纲、通用课程论文、通用案例分析模板；示例高校模板继续标注“示例/非官方”。
- 已新增学生端格式配置 API：任务模板推荐、文档格式配置读取/保存、应用模板到当前论文。格式配置不写入章节正文。
- 已在合稿与格式右侧面板增加“格式设置”Tab，支持当前模板、模板切换、规则摘要、局部微调、自定义格式要求和近似预览提示。
- 后续 Export-DOCX-01 将基于当前格式配置生成 Word 初稿；OnlyOffice-01 将基于生成的 Word 文件进行在线精修；Final-Delivery-01 将以 Word 文件版本作为最终交付依据。
