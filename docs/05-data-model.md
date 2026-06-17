# 05 数据模型（Data Model）

## 1. 核心实体
- User
- Agency（机构）
- AgencyStaff（机构成员，可并入 User+Membership）
- Lead（推单线索）
- Task
- Order
- Payment/PaymentLog/Refund
- Product/Category/Store
- TopicCandidate/OpeningReport/Outline/WritingSession
- TopicCandidateRevision（题目候选版本历史）
- Reference
- ExportTask
- Prompt
- Quota/QuotaLog

## 2. 字段设计初稿（摘要）
### User
- id, phone, email, password, role, status, quota, createdAt

### Agency
- id, name, code, contactName, contactPhone, status, createdAt

### AgencyMembership
- id, agencyId, userId, roleInAgency, status, createdAt

### Lead
- id, agencyId, studentName, studentPhone, major, educationLevel, status, convertedOrderId, createdAt

### Task
- id, userId, assigneeId, schoolId, status, currentStage, title, deadline

### Order
- id, userId, agencyId?, sourceType(direct/agency), status, amount, paymentChannel, taskId, createdAt

### Payment
- id, orderId, channel, method, outTradeNo, payerType(student/agency), status, paidAt

### Refund
- id, orderId, amount, status, reason, resolvedAt

## 3. 实体关系（简化）
- User 1-N Order
- Agency 1-N AgencyMembership
- Agency 1-N Lead
- Agency 1-N Order（可选）
- User 1-N Task
- Order 1-0..1 Task
- Task 1-N Topic/Opening/Writing/Reference
- Task 1-N AdminLog

## 4. 后续需要确认的数据
- Agency 与 User 的绑定方式（独立账号还是复用 User）。
- 机构代下单的支付主体、合同主体、发票主体。
- Order 与 Task 的强绑定策略（是否允许一个订单多任务）。
- 退款与配额回滚的一致性规则。
- 导出文件保存周期、存储位置与清理策略。

### 补充（2026-05-20）
- 新增 `AiGenerationRun`：用于记录 AI 生成执行与扣费关联。
- `QuotaLog` 新增追踪字段：`relatedTaskId`、`relatedStageKey`、`relatedGenerationRunId`、`idempotencyKey`、`balanceBefore`。

### 补充（2026-05-25）
- 新增 `TopicCandidateRevision`：用于记录题目候选的版本历史（AI 生成、自定义选定、导师意见更改、手动更改）。

### 补充（2026-06-03）：订单支付有效期
- 订单支付有效期复用现有 `Order.expiresAt` 字段，不新增 Prisma 字段；对外接口使用 `expiredAt` 作为兼容别名返回同一时间。
- 默认支付有效期为 10 分钟，可通过 `ORDER_PAYMENT_TTL_MINUTES` 调整；旧变量 `ORDER_EXPIRE_MINUTES` 仅作为兼容兜底。
- 待支付订单超时后按现有 `OrderStatus.CLOSED` 落库，并在支付状态接口/前端展示为 `EXPIRED / 已过期`。
- 只有渠道异步通知验签成功或主动查单确认支付成功，且支付成功时间不晚于 `expiresAt`，才允许进入统一结算；未支付或超时订单不得发放脑细胞。

## 5. 论文交付工作台建议数据模型（规划）

> 本节为 `docs/15-thesis-workbench-upgrade-plan.md` 的数据契约补充，当前仅规划模型，不在本次直接修改 `prisma/schema.prisma`。后续实现 Issue 必须拆分 Prisma migration，并保证旧订单、支付、任务、导出数据可继续读取。

### 5.1 学术基础数据
#### Province
- `id`, `name`, `code`, `sortOrder`, `status`, `createdAt`, `updatedAt`
- 唯一约束：`code`。

#### City
- `id`, `provinceId`, `name`, `code`, `sortOrder`, `status`, `createdAt`, `updatedAt`
- 索引：`provinceId`；唯一约束：`provinceId + code`。

#### University
- `id`, `provinceId`, `cityId?`, `name`, `code?`, `type?`, `level?`, `website?`, `status`, `createdAt`, `updatedAt`
- 用途：学校选择、学校模板绑定、学校维度统计。

#### College
- `id`, `universityId`, `name`, `code?`, `status`, `createdAt`, `updatedAt`
- 用途：学院/系选择；同名学院按学校隔离。

#### DisciplineCategory
- `id`, `name`, `code`, `sortOrder`, `status`, `createdAt`, `updatedAt`
- 示例：工学、管理学、文学、教育学。

#### DisciplineFirstLevel
- `id`, `categoryId`, `name`, `code`, `sortOrder`, `status`, `createdAt`, `updatedAt`
- 用途：承载一级学科。

#### Major
- `id`, `firstLevelId`, `name`, `code?`, `degreeType?`, `status`, `createdAt`, `updatedAt`
- 表示二级学科/专业，可作为通用专业库。

#### UniversityMajor
- `id`, `universityId`, `collegeId?`, `majorId`, `displayName?`, `status`, `createdAt`, `updatedAt`
- 用途：高校开设专业、学校/专业模板绑定、专业别名展示。
- 唯一约束：`universityId + collegeId + majorId`（`collegeId` 为空时需业务层去重）。

### 5.2 Task 学术上下文字段
建议在 `Task` 上新增或通过 `TaskAcademicProfile` 独立表承载：
- `taskId`
- `provinceId?`, `cityId?`, `universityId?`, `collegeId?`, `majorId?`, `universityMajorId?`
- `educationLevel`：复用或扩展现有 `EducationLevel`，需覆盖本科、专升本、高职、硕士、博士、其他。
- `thesisType`：建议枚举 `COURSE_PAPER | OPENING_REPORT | UNDERGRAD_THESIS | JUNIOR_COLLEGE_THESIS | MASTER_THESIS | CASE_STUDY | RESEARCH_REPORT | OTHER`。
- `disciplineCategorySnapshot`, `firstLevelDisciplineSnapshot`, `majorSnapshot`, `universitySnapshot`：保存展示与 AI 上下文快照。
- `researchDirection?`, `advisorRequirements?`, `formatRequirementText?`, `formatRequirementJson?`

### 5.3 论文 Skill 中心
#### ThesisSkill
- `id`, `code`, `name`, `description`, `stage`, `status`, `createdById`, `createdAt`, `updatedAt`
- `stage` 建议枚举：`TOPIC | OPENING | OUTLINE | DRAFT | REVISION | REDUCTION | FORMAT_CHECK | REFERENCES | DEFENSE_PPT`。
- `status` 建议枚举：`DRAFT | ACTIVE | DISABLED | ARCHIVED`。

#### ThesisSkillVersion
- `id`, `skillId`, `version`, `status`, `inputSchema`, `outputSchema`, `qualityRules`, `modelConfig`, `promptRefId?`, `releaseNote?`, `publishedById?`, `publishedAt?`, `createdAt`
- 唯一约束：`skillId + version`。
- Skill 运行必须引用版本 ID，避免发布新版本影响历史任务。

#### ThesisSkillScope
- `id`, `skillVersionId`, `educationLevel?`, `thesisType?`, `disciplineCategoryId?`, `firstLevelId?`, `majorId?`, `universityId?`, `stage`, `priority`, `enabled`
- 用于 Skill 匹配，优先级越高越先匹配。

#### ThesisSkillRun
- `id`, `taskId`, `skillVersionId`, `stage`, `status`, `inputSnapshot`, `outputSnapshot`, `qualityResult`, `modelConfigSnapshot`, `relatedGenerationRunId?`, `costQuota?`, `errorCode?`, `errorMessage?`, `startedAt`, `finishedAt`, `createdById?`
- 与现有 `AiGenerationRun` 的关系：首期可通过 `relatedGenerationRunId` 关联；若后续统一，可将 SkillRun 作为业务层运行记录，AiGenerationRun 作为底层模型调用记录。

### 5.4 论文文档工作台
#### ThesisDocument
- `id`, `taskId`, `stage`, `title`, `status`, `currentVersionId?`, `createdAt`, `updatedAt`
- `stage`：题目、开题、大纲、初稿、终稿、答辩 PPT 等。

#### ThesisChapter
- `id`, `documentId`, `parentId?`, `outlineNodeId?`, `title`, `content`, `sortOrder`, `level`, `status`, `lockedById?`, `lockedAt?`, `updatedById?`, `updatedAt`
- 支持章节树和在线编辑；首期不做多人实时协同，仅做编辑锁或乐观锁。

#### ThesisDocumentVersion
- `id`, `documentId`, `versionNo`, `source`, `titleSnapshot`, `contentSnapshot`, `chapterTreeSnapshot`, `complianceSnapshot`, `createdById?`, `createdAt`
- `source` 建议枚举：`AI_GENERATED | MANUAL_EDIT | ADVISOR_REVISION | FORMAT_APPLIED | EXPORT_SNAPSHOT | ROLLBACK`。

#### AdvisorRevision
- `id`, `taskId`, `documentId?`, `chapterId?`, `advisorComment`, `beforeSnapshot`, `afterSnapshot`, `changeSummary`, `status`, `createdById`, `createdAt`, `resolvedAt?`
- 用于导师意见修改记录与验收追溯。

#### ComplianceNoticeLog
- `id`, `taskId`, `documentVersionId?`, `noticeType`, `content`, `acknowledgedById?`, `acknowledgedAt?`, `createdAt`
- `noticeType`：原创性提示、引用核验提示、AI 辅助声明、禁止伪造数据提示。

### 5.5 格式模板引擎
#### FormatTemplate
- `id`, `code`, `name`, `type`, `stage?`, `status`, `formatRules`, `fileTemplateUrl?`, `description?`, `createdById`, `createdAt`, `updatedAt`
- `type`：`GENERAL | UNIVERSITY | MAJOR | CUSTOM`。
- `formatRules`：JSON，包含标题、正文、目录、页眉页脚、页码、图表、参考文献样式等结构化规则。

#### FormatTemplateScope
- `id`, `templateId`, `universityId?`, `collegeId?`, `majorId?`, `educationLevel?`, `thesisType?`, `stage?`, `priority`, `enabled`
- 用于模板匹配，优先级建议：自定义 > 专业 > 学校阶段 > 学历/论文类型默认 > 通用。

#### ExportTask 扩展建议
- 新增或扩展字段：`documentVersionId?`, `stage?`, `templateId?`, `formatRequirementText?`, `formatRequirementJson?`, `complianceSnapshot?`
- 导出任务必须绑定文档版本，确保异步生成文件内容稳定可追溯。

### 5.6 关系摘要
- `Province 1-N City`
- `Province/City 1-N University`
- `University 1-N College`
- `DisciplineCategory 1-N DisciplineFirstLevel 1-N Major`
- `University + College + Major -> UniversityMajor`
- `Task 1-1 TaskAcademicProfile`
- `Task 1-N ThesisDocument 1-N ThesisChapter`
- `ThesisDocument 1-N ThesisDocumentVersion`
- `ThesisSkill 1-N ThesisSkillVersion 1-N ThesisSkillScope`
- `Task 1-N ThesisSkillRun`
- `FormatTemplate 1-N FormatTemplateScope`
- `ExportTask N-1 ThesisDocumentVersion`、`ExportTask N-1 FormatTemplate`

### 5.7 迁移与兼容策略
- 第一个实现 PR 只新增表和可空关联字段，不删除旧字段。
- `Task.schoolId` 等既有字段需先梳理实际类型和使用位置；若名称含义与新 `University` 不一致，优先新增 `TaskAcademicProfile`，避免破坏旧任务。
- 历史任务缺少学校/专业时，工作台显示“待补充”，AI 生成仍可使用现有任务标题与用户输入兜底。
- 导出升级需保留旧 `ExportTask` 调用路径，新增版本化导出参数后再逐步迁移前端。

### 补充（Academic-01 / Issue #137）：学术基础数据落地模型
- 新增 `AcademicStatus`：`ACTIVE`、`INACTIVE`，用于学术基础数据启停用和软删除。
- 新增 `AcademicProvince`：`id`、`name`、`code`、`sortOrder`、`status`、`createdAt`、`updatedAt`；与 `AcademicCity`、`AcademicSchool` 为 1:N。
- 新增 `AcademicCity`：`id`、`provinceId`、`name`、`code`、`sortOrder`、`status`、`createdAt`、`updatedAt`；与 `AcademicSchool` 为 1:N。
- 新增 `AcademicSchool`：`id`、`provinceId`、`cityId`、`name`、`code`、`schoolType`、`educationLevels`、`status`、`sortOrder`、`remark`、时间字段；与 `AcademicCollege`、`AcademicMajor` 为 1:N。
- 新增 `AcademicCollege`：`id`、`schoolId`、`name`、`code`、`status`、`sortOrder`、`remark`、时间字段；与 `AcademicMajor` 为 1:N。
- 新增 `DisciplineCategory`、`DisciplineLevelOne`、`DisciplineLevelTwo`，分别承载学科门类、一级学科、二级学科/具体专业目录，关系为 `DisciplineCategory 1:N DisciplineLevelOne 1:N DisciplineLevelTwo`。
- 新增 `AcademicMajor`：关联 `AcademicSchool`、可选关联 `AcademicCollege`，并可选关联 `DisciplineCategory`、`DisciplineLevelOne`、`DisciplineLevelTwo`；同时记录专业名称、编码、学历层次、排序、状态和备注。
- 本次 migration 名称：`20260610090000_add_academic_data`。本 Issue 不改造 `Task` 结构，后续 Task-01 再将任务创建流程接入学术基础数据。

### 补充（Skill-01 / Issue #138）：论文 Skill 中心模型
- 新增 `ThesisSkill`：Skill 基础信息，包含 `name`、`code`、`description`、`stage`、`category`、`status`、`sortOrder`、时间字段；`code` 唯一。
- 新增 `ThesisSkillVersion`：Skill 版本，包含 `version`、`promptTemplate`、`inputSchema`、`outputSchema`、`qualityRules`、`modelConfig`、`isActive`、`activeKey`、`changeLog`；通过 `activeKey` 保证同一 Skill 同时只有一个 active 版本。
- 新增 `ThesisSkillBinding`：适用范围绑定，可选绑定 `educationLevel`、`thesisType`、学科门类、一级学科、二级学科、学校、专业，并通过 `priority` 控制匹配优先级；`skillVersionId` 为空时使用 Skill 当前 active 版本。
- 新增 `ThesisSkillRun`：运行记录，记录 `skillId`、`skillVersionId`、`bindingId`、`taskId`、`stage`、`inputPayload`、`outputPayload`、`qualityResult`、`modelName`、`tokenUsage`、`status`、错误信息和起止时间。
- 本次 migration 名称：`20260610110000_add_thesis_skill_center`。首期 test-run 为 mock-preview，不改造现有 AI 生成、订单、支付、任务或导出数据模型。

### 补充（Task-01 / Issue #139）：任务学术上下文字段
- `Task` 保留既有 `schoolId` 关联 legacy `School`，用于兼容旧学校模板、导出和历史任务；Academic-01 高校关系新增为 `academicSchoolId`，避免同名字段破坏旧数据。
- `Task` 新增 nullable 字段：`provinceId`、`cityId`、`academicSchoolId`、`collegeId`、`majorId`、`disciplineCategoryId`、`disciplineLevelOneId`、`disciplineLevelTwoId`、`thesisType`、`researchDirection`、`advisorRequirement`、`formatTemplateId`。
- 新增外键关系：Task 可选关联 `AcademicProvince`、`AcademicCity`、`AcademicSchool`、`AcademicCollege`、`AcademicMajor`、`DisciplineCategory`、`DisciplineLevelOne`、`DisciplineLevelTwo`，外键均采用 `ON DELETE SET NULL`，保证基础数据停用/清理不破坏历史任务。
- `formatTemplateId` 为 Export-01 预留字段，本阶段只持久化，不接入格式模板匹配。
- migration：`20260611100000_add_task_academic_context`。

### 补充（Workbench-01 / Issue #140）：论文文档工作台模型
- 新增 `ThesisDocument`：任务主论文文档，`taskId` 唯一，包含 `title`、`abstract`、`keywords`、`status`、`currentVersion`、`wordCount`。首期一个任务一份主文档。
- 新增 `ThesisDocumentSection`：文档章节树，支持 `parentId` 层级、`sectionType`、`title`、`content`、`plainText`、`sortOrder`、`level`、`wordCount`、`sourceStage`、`sourceGenerationRunId` 和 `deletedAt` 软删除。
- 新增 `ThesisDocumentRevision`：章节版本记录，每次章节内容变化时写入 `beforeContent`、`afterContent`、`changeSummary`、`operatorId`、`operatorRole` 和文档版本号；内容未变化不重复生成 revision。
- 新增 `ThesisAdvisorComment`：导师意见/线下修改要求，关联任务、文档和可选章节，支持 `OPEN`、`RESOLVED`、`IGNORED` 状态。
- 关系：`Task 1-1 ThesisDocument`，`ThesisDocument 1-N ThesisDocumentSection`，`ThesisDocumentSection 1-N ThesisDocumentRevision`，`ThesisAdvisorComment` 可绑定整篇文档或具体章节。
- migration：`20260611130000_add_thesis_document_workbench`。

### 补充（Export-01 / Issue #141）：论文格式模板与导出模型
- 新增 `ThesisFormatTemplate`：格式模板主表，支持 `schoolId`、`collegeId`、`majorId`、`educationLevel`、`thesisType`、`stage` 适用范围，`templateType` 区分通用/学校/学院/专业/自定义模板，`isDefault`、`status`、`version`、`sortOrder` 控制匹配与启停。
- 新增 `ThesisFormatRule`：模板规则表，`ruleType` 覆盖 PAGE、TITLE、BODY、HEADING、ABSTRACT、KEYWORDS、TOC、REFERENCE、COVER、FOOTER、HEADER、CUSTOM，`ruleValue` 使用 Json 保存可扩展格式参数。
- 新增 `ThesisExportJob`：新版论文导出任务，关联 `Task`、`ThesisDocument`、`ThesisFormatTemplate`、`User`，记录 `exportStage`、`exportFormat`、`customRequirement`、`status`、`progress`、文件信息、失败原因和起止时间。
- 新增 `ThesisExportFile`：导出文件表，一个导出任务可关联多个文件；首期只生成 DOCX 文件，保存 `fileName`、`fileUrl`、`fileType`、`fileSize` 和 `storageProvider`。
- 模板匹配规则：专业模板 > 学院模板 > 学校模板 > 学历/论文类型/阶段通用模板 > 全局默认模板；同级按 `isDefault=true`、`sortOrder` 小、`version` 新排序；只匹配 `ENABLED` 模板。
- migration：`20260611150000_add_thesis_export_engine`。旧 `ExportTask` 保留用于历史导出记录和旧下载链接兼容。

### 补充（Export-DOCX-01）：Word 初稿文件与版本模型
- 新增 `ThesisDocumentFormatSetting`：文档当前格式配置，关联 `ThesisDocument` 与可选 `ThesisFormatTemplate`，保存 `overrideRules` 与 `customRequirement`。若 Workbench-Format-01 尚未完整提供该模型，本阶段以兼容方式补齐最小结构。
- 新增 `ThesisWordFile`：某个任务/文档当前 Word 文件对象，关联 `Task` 与 `ThesisDocument`，保存当前 `fileName`、下载 `fileUrl`、`currentVersion` 与状态 `DRAFT/GENERATED/EDITING/FINALIZED/FAILED`。
- 新增 `ThesisWordFileVersion`：Word 文件历史版本，记录版本号、文件路径、大小、来源类型、生成时 `ThesisDocument.currentVersion`、使用的 `formatTemplateId`、`formatSettingSnapshot` 与操作人。
- 关系：`Task 1-N ThesisWordFile`，`ThesisDocument 1-1 ThesisWordFile`，`ThesisWordFile 1-N ThesisWordFileVersion`；每次重新生成 DOCX 都递增版本并保留旧文件版本。
- migration：`20260612100000_add_thesis_word_file`。

### 补充（OnlyOffice-01）：在线 Word 精修字段
- `ThesisWordFile` 补充 `editingSessionKey`、`lastEditedAt`、`lastEditedBy`、`lockStatus`、`onlyofficeDocumentKey`，用于记录 ONLYOFFICE 编辑会话、最近编辑人与当前 document key，避免 Document Server 缓存错乱。
- `ThesisWordFileVersion` 补充 `editorUserId`、`callbackPayload`、`checksum`；ONLYOFFICE 保存回调生成的版本使用 `sourceType=ONLYOFFICE_EDITED`，`callbackPayload` 只记录排查所需字段，不保存敏感 token。
- callback 保存会更新 `ThesisWordFile.currentVersion/fileUrl/fileName`，并保留历史版本；Word 精修版本不强制同步回 `ThesisDocumentSection`。
- migration：`20260616100000_add_onlyoffice_word_editing`。

### AcademicData-01 地区同步数据模型
- `AcademicRegion` 映射表 `academic_regions`，以高德 `adcode` 作为唯一 `code`，记录省、市、区县层级、上级 `parentCode`、同步来源、置信度、审核状态和最近同步时间。
- `AcademicSyncJob` 映射表 `academic_sync_jobs`，记录地区同步任务类型 `REGION_AMAP`、范围 `NATIONAL`、运行状态和最近成功时间。
- `AcademicSyncLog` 映射表 `academic_sync_logs`，记录同步任务 INFO/WARN/ERROR 日志和结构化 detail，便于后台查看和故障追踪。
- 本次新增 Prisma migration：`prisma/migrations/20260617090000_add_academic_region_sync/migration.sql`。
