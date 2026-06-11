# 09 验收清单（Acceptance Checklist）

## 1. 功能验收
- [ ] 注册/登录流程可用（学生/机构）
- [ ] 学生自助下单与支付成功
- [ ] 机构代下单/推单流程可用
- [ ] 订单与任务正确关联
- [ ] 任务状态按规则推进
- [ ] 题目/开题/正文交付可查看
- [ ] 按导师要求修改流程可闭环
- [ ] 导出可下载且内容完整
- [ ] 退款流程可闭环

## 2. UI 验收
- [ ] 学生端、机构端、管理端关键页面有 loading/empty/error/success 全状态
- [ ] 表单错误提示清晰
- [ ] 表格筛选、分页、批量操作可用
- [ ] 渠道来源与订单归属可视化清晰

## 3. 性能验收
- [ ] 核心列表接口响应满足目标阈值
- [ ] 首屏加载可接受（定义 KPI）
- [ ] 大数据量分页无明显卡顿

## 4. 安全验收
- [ ] 鉴权、鉴权失效、越权请求拦截有效
- [ ] 机构账号无法访问非归属数据
- [ ] 敏感信息未泄漏到日志
- [ ] 支付回调验签与幂等通过
- [ ] 高危操作有审计日志

## 5. 部署验收
- [ ] staging/prod 环境变量模板齐全
- [ ] 可一键部署与回滚
- [ ] 数据库迁移流程可复现
- [ ] 故障应急预案可执行

## 6. 需要人工确认
- [ ] 机构合作分成/结算规则
- [ ] 机构代下单支付主体与发票主体
- [ ] 生产环境证书与密钥托管方式
- [ ] 告警接收人、值班机制、SLA
- [ ] 退款财务对账流程

- [ ] AI 生成 run 与额度流水关联（taskId/stage/runId/idempotencyKey）可追溯
- [ ] 题目生成失败不扣费（或已扣则回退）
- [ ] 支付 transactionId 重复占用拦截有效

- [ ] Issue #92: `POST /api/payments/create` 支持 mock/wechat/alipay 通道与 method 校验。
- [ ] Issue #92: 仅 mock 可用，wechat/alipay 未启用时返回明确错误。
- [ ] Issue #92: mock success/fail 可驱动 PaymentRecord 状态变化。

## 支付 UI 与 mock 权限回归（fix/payment-ui）

- [ ] 普通用户订单支付弹窗不显示“沙箱一键支付”。
- [ ] 普通用户直接调用 mock / sandbox 支付接口返回 403。
- [ ] 管理员在 development/test 环境且开启 mock 配置时仍可使用 mock 支付。
- [ ] 普通用户点击“去支付”后自动发起微信支付，PC 默认 Native 并展示二维码。
- [ ] 手机浏览器默认微信 H5，并使用后端返回的 `payUrl` / `mweb_url` 跳转。
- [ ] 微信 Native 二维码由前端本地组件生成，不依赖第三方在线二维码 API。
- [ ] 前端每 2 秒轮询 `/api/orders/:id/payment-status`，paid 后停止轮询。
- [ ] paid 后 0.8 秒按后端 `redirectUrl` / `taskId` / `/account` / `/orders` 规则跳转。
- [ ] 关闭弹窗、切换订单、页面卸载后不再继续轮询。
- [ ] 用户不能查询他人的 `payment-status`；返回的 `redirectUrl` 必须是站内相对路径。

## 支付宝 mock-page-pay 修复验收

- [ ] 生产或沙箱配置下，`channel=alipay&method=page` 不返回 `mock-page-pay`，返回内容包含 `alipay.trade.page.pay` 与 `sign`。
- [ ] `channel=alipay&method=wap` 返回内容包含 `alipay.trade.wap.pay` 与 `sign`。
- [ ] 未配置 `ALIPAY_APP_ID` / 私钥路径 / 支付宝公钥路径 / `ALIPAY_NOTIFY_URL` 时，发起支付宝支付返回明确配置错误。
- [ ] 支付宝异步通知验签失败不入账，金额不一致不入账，`TRADE_SUCCESS` / `TRADE_FINISHED` 才调用统一到账。
- [ ] 支付宝 `return_url` 回来后仅进入结果页，结果页以后端订单状态和主动查单结果为准。
- [ ] 微信支付与 mock/admin 测试支付仍保持原有能力。

## 支付宝 SDK 构造函数修复验收

- [ ] 点击支付宝 PC/Wap 支付不再出现 `TypeError: AlipayCtor is not a constructor`。
- [ ] SDK 导出形态异常时返回明确错误，错误只包含 export keys，不包含密钥内容。
- [ ] Page/Wap 支付仍分别生成 `alipay.trade.page.pay` / `alipay.trade.wap.pay`，且不返回 `mock-page-pay`。

## fix(payment-expiry)：10 分钟支付超时验收

- [ ] 新建订单默认写入 10 分钟支付有效期，接口返回 `expiredAt` 与 `remainingSeconds`。
- [ ] 待支付订单未过期时可以发起支付，过期后 `POST /api/payments/create` 返回“订单已过期，请重新下单”。
- [ ] `GET /api/orders/:id/payment-status` 对超时未支付订单返回 `expired=true`、`canPay=false`，且前端展示“已过期”。
- [ ] 支付宝 `return_url` 回跳后必须查询后端状态，不直接展示支付成功。
- [ ] 支付宝 `WAIT_BUYER_PAY`、`TRADE_CLOSED` 等非成功状态不会触发统一结算；只有 `TRADE_SUCCESS / TRADE_FINISHED` 可入账。
- [ ] 过期未支付订单不会变成 `paid`，不会发放脑细胞，不产生 recharge 流水。
- [ ] 订单列表、支付弹框、支付结果页均展示倒计时/已过期状态，未支付订单不得显示“已完成”。

## fix(payment-expiry-ui)：订单列表/弹框倒计时验收

- [ ] 待支付订单列表卡片显示“剩余 09:59”格式倒计时。
- [ ] 支付弹框显示“请在 10 分钟内完成支付”和实时剩余时间。
- [ ] 倒计时归零后订单显示“已过期”，支付按钮不可点击。
- [ ] `pending/cancelled/expired/closed` 不显示“已完成”，只有已支付订单显示“已完成”。
- [ ] 前端兼容后端返回大小写不同的 `orderStatus/paymentStatus/status`。

## fix(payment-wechat)：ORDERPAID 主动查单结算验收

- [ ] 微信 Native prepay 返回 `ORDERPAID` 时，后端主动调用微信查单而不是长期展示错误。
- [ ] 查单 `SUCCESS` 后通过 `PaymentCallbackService` 统一结算，订单 paid、PaymentRecord succeeded、脑细胞到账、产生 recharge 流水。
- [ ] 查单 `NOTPAY/USERPAYING/CLOSED/PAYERROR` 不入账，返回 paid=false 与明确提示。
- [ ] “我已完成支付”调用 `POST /api/orders/:id/payment-status/refresh`，查单成功后 0.8 秒跳转。
- [ ] 重复 refresh / 重复点击去支付不重复到账，不串用 providerTradeNo。

## 论文交付工作台升级验收标准

### 7. 学术基础数据验收
- [ ] 省份、城市、高校、学院、学科门类、一级学科、专业/二级学科可通过后台维护，支持启停用。
- [ ] 学术基础数据查询接口支持分页、关键词、省市/学校/学科筛选，并限制最大 `pageSize`。
- [ ] 学生端创建/补充任务时可选择学校、学院、专业、学历层次、论文类型。
- [ ] 机构端代下单/推单时可为学生补充学校、专业、论文类型，且只能编辑所属机构任务。
- [ ] 管理端可纠偏任务学术上下文，且必须记录修改原因和审计日志。
- [ ] 历史任务缺少学校/专业时可正常打开任务详情和导出，不发生 500。

### 8. 论文 Skill 中心验收
- [ ] 管理端可创建 Skill、创建版本、发布版本、停用版本、配置适用范围。
- [ ] SkillVersion 包含输入 schema、输出 schema、质量检查规则、模型配置和发布说明。
- [ ] Skill 运行时可根据任务的学校、专业、学历层次、论文类型和阶段匹配版本。
- [ ] SkillRun 可追溯 `taskId`、`skillVersionId`、阶段、输入摘要、输出摘要、质量检查结果、模型配置快照和错误信息。
- [ ] Skill 停用不影响历史任务查看和历史导出。
- [ ] 题目、开题、大纲、正文、导师意见修改、降重、格式检查、参考文献、答辩 PPT 至少在配置层可表达适用 Skill。

### 9. 合稿与格式验收
- [ ] 学生端可进入任务合稿与格式页查看题目、开题、大纲、初稿、终稿等阶段文档。
- [ ] 管理端可进入任务合稿与格式页查看/编辑章节、生成版本、回滚版本、处理导师意见。
- [ ] 章节编辑支持 loading、empty、error、success 状态，保存失败不覆盖本地未提交内容。
- [ ] 文档版本记录展示版本号、来源、操作者、时间、修改摘要。
- [ ] 导师意见修改记录可查看原意见、修改前、修改后、处理状态和处理人。
- [ ] 无权限用户、非所属机构成员不能访问或编辑任务合稿与格式页。
- [ ] 刷新页面后可恢复当前任务、当前阶段和当前文档状态。
- [ ] 移动端可完成基本查看、提交导师意见和下载操作。

### 10. 格式模板与导出验收
- [ ] 管理端可配置通用模板、学校模板、专业模板、自定义模板，并可启停用。
- [ ] 模板可绑定高校、学院、专业、学历层次、论文类型和阶段。
- [ ] 导出时可按优先级选择模板：用户指定 > 专业模板 > 学校阶段模板 > 学历/论文类型默认 > 通用模板。
- [ ] 用户输入格式要求后，系统可解析为结构化规则；无法解析项必须展示“需人工确认”。
- [ ] 导出任务可绑定文档版本、阶段、模板和格式参数，异步导出期间文档编辑不影响本次导出结果。
- [ ] 题目、开题、大纲、初稿、终稿均可按阶段导出。
- [ ] 旧导出接口或下载中心仍可正常使用，已有导出文件清理策略不被破坏。

### 11. 合规与引用验收
- [ ] 导出前展示原创性提示、引用核验提示、AI 辅助声明和禁止伪造数据提示。
- [ ] 用户确认合规提示后写入确认记录，记录确认人和时间。
- [ ] 参考文献列表可标记已核验、待核验、缺失字段和疑似风险项。
- [ ] 系统不得生成或承诺伪造实验数据、调研数据、访谈记录、问卷样本、引用来源。
- [ ] 降重能力只提供表达修改建议和风险提示，不承诺查重率或规避检测。
- [ ] 导师意见修改、AI 生成运行、导出任务均可形成审计链路。

### 12. To B 机构链路验收
- [ ] 机构可在推单/代下单流程补充学校、专业、学历层次、论文类型和格式要求。
- [ ] 机构仅能查看所属机构订单/任务/工作台，不得跨机构访问。
- [ ] 管理端可区分散客任务与机构任务，并能查看机构补充资料与协同备注。
- [ ] 学生视角可看到机构代填的任务资料并能补充或确认。
- [ ] 机构视角不能修改支付入账、退款结算、用户余额等非授权数据。

### 13. 本地 Trae 验证验收
- [ ] PR 描述包含安装依赖、启动 Docker、启动 NestJS、启动 Next.js、lint、typecheck、test、build 命令。
- [ ] 涉及前端页面的 PR 写明页面路径、loading/empty/error、表单校验、移动端、刷新后状态。
- [ ] 涉及后端接口的 PR 写明 Controller、Service、DTO、ORM 模型、接口路径、鉴权、请求参数、返回结构、异常情况。
- [ ] 涉及数据库的 PR 写明 migration、是否需要 seed、是否影响已有数据、回滚方案。
- [ ] 未执行的验证命令必须明确标记原因，不得声称已验证通过。

## Academic-01 学术基础数据验收项
- [ ] Prisma migration `20260610090000_add_academic_data` 可执行，新增学术基础数据表和索引。
- [ ] `prisma db seed` 后至少包含重庆、四川、重庆、成都、甘孜州、重庆师范大学、重庆建筑工程职业学院和示例学科/专业数据。
- [ ] 公开查询接口可返回省份、城市、高校、学院、专业、学科门类、一级学科、二级学科联动数据。
- [ ] 后台 `/admin/academic/schools` 可新增、编辑、禁用/启用高校，并选择省份和城市。
- [ ] 后台 `/admin/academic/colleges` 可按高校筛选并维护学院。
- [ ] 后台 `/admin/academic/majors` 可按高校、学院、学历层次筛选并维护专业，且可绑定学科目录。
- [ ] 后台 `/admin/academic/disciplines` 可维护学科门类、一级学科、二级学科。
- [ ] 禁用操作为软禁用，不物理删除重要基础数据。
- [ ] 现有订单、支付、任务、AI 生成、导出功能不因 Academic-01 变更而改变接口路径或数据结构。

## Skill-01 论文 Skill 中心验收项
- [ ] Prisma migration `20260610110000_add_thesis_skill_center` 可执行，新增 Skill、版本、绑定和运行记录表。
- [ ] seed 后内置 10 个论文辅导 Skill，且每个 Skill 至少有一个 active version。
- [ ] 后台 `/admin/thesis-skills` 可查询、新增、编辑、启用/禁用 Skill。
- [ ] 后台 Skill 详情页可新增版本、查看版本、激活版本，且同一 Skill 不允许同时存在多个 active version。
- [ ] 后台 Skill 详情页可创建适用范围 Binding，并支持学历层次、论文类型、学校、专业、学科门类、一级学科、二级学科和 priority。
- [ ] 学校、专业和学科绑定选项来自 Academic-01 API，不在前端硬编码。
- [ ] `POST /api/admin/thesis-skills/:id/test-run` 可生成 mock-preview 输出并写入 `ThesisSkillRun`。
- [ ] 后台 `/admin/thesis-skills/runs` 可按 Skill、阶段、状态查看运行记录和详情。
- [ ] 内置 Prompt 明确论文辅导合规边界：不代写、不伪造数据、不伪造引用、不承诺规避查重。
- [ ] 本模块不改变现有订单、支付、任务、AI 生成和导出接口行为。

## Task-01 论文任务学术上下文验收项
- [ ] Prisma migration `20260611100000_add_task_academic_context` 可执行，历史任务在新增 nullable 字段后仍可查询、导出和推进状态。
- [ ] 学生端 `/tasks` 创建表单通过 Academic-01 API 联动加载省份、城市、高校、学院、专业，不在前端硬编码学校/专业数据。
- [ ] 创建任务时可保存 Academic 高校、学院、专业、学历层次、论文类型、研究方向、导师要求。
- [ ] 传入 `majorId` 且未传学科字段时，服务端可从 `AcademicMajor` 自动回填学科门类、一级学科、二级学科。
- [ ] 传入不存在、禁用或层级不一致的学校/学院/专业/学科 ID 时，服务端返回明确业务错误，不产生脏任务。
- [ ] `GET /api/tasks/:id/detail` 与 `GET /api/admin/tasks/:id` 返回完整 `academicContext` 和学校/专业/学科名称摘要。
- [ ] 后台任务列表可展示 `schoolName`、`majorName`、`educationLevel`、`thesisType`，并支持按 Academic 高校、专业、学历层次、论文类型筛选。
- [ ] 后台任务详情可维护学术上下文，保存失败时不影响任务状态、订单关联和导出记录。
- [ ] `TaskService.buildGenerationContext` 可从任务构建 AI/Skill 所需上下文，旧任务缺失 Academic 字段时使用旧 `major`、`educationLevel`、`requirements` 兜底。
- [ ] 本模块不改变订单、支付、任务状态流转、AI 生成主流程和导出接口行为。

## Workbench-01 合稿与格式验收项
- [ ] Prisma migration `20260611130000_add_thesis_document_workbench` 可执行，新增文档、章节、版本记录、导师意见表。
- [ ] 老任务列表、任务详情、订单、支付、AI 生成、下载页面不受 Workbench-01 影响。
- [ ] 新任务可从 `/tasks` 进入 `/student/tasks/[taskId]/compose-format`，旧 `/workbench` 链接保持 redirect 兼容。
- [ ] 无文档任务展示初始化空状态，点击初始化后生成一份主文档和默认章节结构。
- [ ] 已有文档任务重复初始化不会创建第二份文档。
- [ ] 工作台可展示章节目录树、当前章节内容、文档总字数和保存状态。
- [ ] 可新增章节、编辑章节标题/类型/正文、删除章节，并在刷新后保留数据。
- [ ] 章节内容变化时生成 `ThesisDocumentRevision`，内容未变化时不重复生成 revision。
- [ ] 修改记录可查看修改时间、版本、章节、摘要和前后内容。
- [ ] 可新增导师修改要求，并标记为已解决或忽略。
- [ ] 合稿接口在题目、开题、大纲、正文、参考文献等阶段有内容时可追加/替换章节；无内容时返回明确错误。
- [ ] 后台任务详情可查看文档是否初始化、字数、版本、更新时间、章节数和导师意见数。
- [ ] 工作台展示合规提示：AI 生成与编辑内容仅作学习和写作辅助，需自行核验事实、数据、引用和导师要求。

## Export-01 论文格式模板与导出引擎验收项
- [ ] Prisma migration `20260611150000_add_thesis_export_engine` 可执行，新增格式模板、规则、新版导出任务和导出文件表。
- [ ] seed 后存在全局通用本科论文模板、通用开题报告模板、通用论文大纲模板；示例高校模板名称明确标注“示例/非官方”。
- [ ] 后台 `/admin/thesis-format-templates` 可创建、编辑、启用/禁用模板，并维护 Json 格式规则。
- [ ] 模板匹配优先级符合：专业 > 学院 > 学校 > 通用；同级按默认、排序、版本处理；缺学校模板时回退全局通用模板。
- [ ] 学生端 `/downloads` 可选择任务、查看任务上下文和文档状态、选择阶段、DOCX/PDF 格式、模板和自定义格式要求。
- [ ] 没有 `ThesisDocument` 的任务不能创建新版导出任务，并提示进入合稿与格式初始化。
- [ ] 有 `ThesisDocument` 的任务可创建 DOCX 导出任务，并从 PENDING/RUNNING 进入 SUCCESS 或 FAILED。
- [ ] DOCX 文件可下载，下载接口校验归属，学生不能下载别人的文件。
- [ ] PDF 首期不标记成功生成，创建时明确提示后续开放。
- [ ] 导出失败时可在学生端和后台查看 `errorMessage`；后台可重试 FAILED 任务。
- [ ] 自定义格式要求保存到 `ThesisExportJob.customRequirement`，不污染正式论文正文。
- [ ] 旧 `ExportTask` 下载记录和 `/api/export/:id/download` 继续可用。
- [ ] 订单、支付、AI 生成、合稿与格式和任务状态流转不受 Export-01 影响。

## Task-UX-01 任务流程命名与四阶段导航验收项
- [ ] 任务列表主按钮展示“进入论文任务”，次按钮展示“继续生成”。
- [ ] `/student/tasks/[taskId]/generate` 可访问，顶部展示“论文内容生成”说明文案，原题目、开题、大纲、摘要、正文生成能力不丢失。
- [ ] `/student/tasks/[taskId]/compose-format` 可访问，顶部展示“合稿与格式”说明文案，原论文文档初始化、章节编辑、合并阶段内容、导师意见和修改记录能力不丢失。
- [ ] `/student/tasks/[taskId]/word-editor` 可访问，占位说明明确 DOCX 后开放在线 Word 精修。
- [ ] `/student/tasks/[taskId]/delivery` 可访问，首期可引导用户打开现有下载中心。
- [ ] 旧 `/student/tasks/[taskId]/workbench` 可 redirect 到 `/student/tasks/[taskId]/compose-format`，旧 `/tasks?taskId=...` 兼容访问论文内容生成。
- [ ] 订单、支付、AI 生成、导出功能不因 Task-UX-01 改变接口路径、数据结构或状态流转。

## Workbench-Format-01 合稿与格式模板应用验收项
- [ ] Prisma migration `20260611170000_add_thesis_document_format_setting` 可执行，历史任务、历史文档和历史导出记录不受影响。
- [ ] seed 后存在通用本科毕业论文、通用专升本毕业论文、通用开题报告、通用论文大纲、通用课程论文、通用案例分析模板。
- [ ] 后台 `/admin/thesis-format-templates` 可按关键词、学校、专业、学历、论文类型、阶段、状态、模板类型筛选模板。
- [ ] 后台可以新建、编辑、启用/禁用模板，并新增/删除 JSON 格式规则；JSON 错误时有明确提示。
- [ ] `GET /thesis-tasks/:taskId/format-templates` 仅返回 `ENABLED` 模板，并按专业、学院、学校、通用、全局默认优先级推荐。
- [ ] `GET/PATCH /thesis-documents/:documentId/format-setting` 可读取和保存当前文档 `templateId`、`overrideRules`、`customRequirement`、`previewMode`。
- [ ] `POST /thesis-documents/:documentId/apply-format-template` 可应用模板，且 `keepOverrides=false` 会清空局部调整。
- [ ] 合稿与格式页面可看到“格式设置”Tab，展示当前模板、推荐模板、规则摘要、局部微调、自定义格式要求和近似预览提示。
- [ ] 格式模板应用不修改 `ThesisDocumentSection.content`，章节正文保持干净。
- [ ] 无可用模板时页面不崩溃，并提示联系管理员配置模板。
- [ ] 学生不能读取或保存他人论文文档的格式配置；普通用户不能访问后台模板管理接口。
- [ ] 原论文内容生成、合稿编辑、导师意见、版本记录、订单、支付、下载/导出基础能力不受影响。
