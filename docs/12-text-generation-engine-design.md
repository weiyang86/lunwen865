# 12 文本生成通用引擎设计（Text Generation Engine Design）

> 范围说明：本文仅基于当前仓库代码进行现状分析与演进方案设计；不涉及业务代码修改，不涉及数据库迁移执行。

## 一、当前代码现状

### 1.1 Prompt 模板核心现状

当前仓库已存在 `PromptTemplate` 与 `PromptVersion` 两个 Prisma 模型：
- `PromptTemplate.code` 是唯一键（当前前后端语义等同 `sceneKey`）。
- `PromptTemplate.scene` 使用 `PromptScene` 枚举。
- 模板内容 `content` 与变量定义 `variables` 存在模板与版本两个层面。
- 模板支持草稿与版本发布（draft + version）。

参考：`prisma/schema.prisma` 中 `PromptTemplate`、`PromptVersion`、`PromptScene`、`PromptStatus` 定义。 

### 1.2 sceneKey / scene 的双轨现实

当前系统同时存在两套“场景标识”机制：
1. **业务调用时**：主要依赖 `code`（即 sceneKey），例如 `promptService.render('paper.outline', vars)`。
2. **模板管理时**：还保留 `scene`（枚举型 `PromptScene`）字段，但创建管理端模板时默认写为 `PromptScene.OTHER`。

这说明：
- sceneKey 已被真实使用于运行时路由。
- 枚举 scene 仍存在，但与 sceneKey 没有形成强绑定治理关系。

### 1.3 变量能力现状

后端 `PromptVariable` 解析与校验目前仅包含：
- `name`
- `label`
- `required`
- `defaultValue`
- `description`

前端 Prompt 编辑器变量类型（UI）支持 `text/textarea/number/select`，但后端持久化回传时统一降为 `type: 'text'`，说明“前端变量组件能力”与“后端结构能力”未完全对齐。

### 1.4 论文工作台调用链现状

论文工作台采用按阶段分散 API：
- 选题：`/tasks/:taskId/topics/generate`、`/regenerate`
- 大纲：`/tasks/:taskId/outline/generate`
- 其他阶段也各自独立接口与 payload

当前未发现统一 `/api/text-generation/run` 入口。

---

## 二、现有 Prompt 模板的问题

1. **场景模型割裂**：`sceneKey(code)` 与 `scene(enum)`并存，且管理端创建模板时 `scene` 固定为 `OTHER`，导致枚举 scene 在运营配置侧弱化。  
2. **变量元数据不足**：后端变量缺少 `source/frontendVisible/component/validation` 等字段，难以直接驱动通用表单。  
3. **前后端类型不一致**：前端支持 richer variable type，后端回传逻辑简化为 text，影响配置即渲染能力。  
4. **运行入口分散**：论文各阶段走业务专用接口，Prompt 模板虽可复用，但尚未沉淀统一“文本生成引擎 API”。  
5. **新场景上线链路不闭环**：目前“配置模板 -> 前端自动出现工具”未形成机制，仍需要手工改页面与接口。

---

## 三、文本生成通用引擎目标架构

目标：在不破坏现有业务链路前提下，形成“场景管理 + 模板版本 + 统一执行 API + 多前端接入模式”。

建议架构分层：
1. **Scene 层（TextGenerationScene）**：定义“一个可被前端消费的生成工具”。
2. **Template 层（PromptTemplate）**：定义该场景的具体 prompt 模板（可多版本）。
3. **Variable 层（PromptVariable）**：定义变量声明、来源、前端展示、校验规则。
4. **Runtime 层（TextGenerationRun）**：统一执行入口，按 sceneKey 装配变量、渲染、调用模型、记录日志。
5. **Frontend Adapter 层**：固定页面模式/通用工具箱模式/嵌入组件模式三种消费形态。

---

## 四、TextGenerationScene 推荐数据结构

> 说明：以下为推荐结构，当前仓库“未发现”该独立模型。

推荐字段：
- `id`
- `sceneKey`（唯一，稳定 API 键）
- `name`
- `description`
- `category`（paper/report/marketing/...）
- `status`（DRAFT/ACTIVE/ARCHIVED）
- `mode`（FIXED_PAGE/TOOLBOX/EMBEDDED）
- `frontendConfig`（JSON：排序、图标、分组、是否可见）
- `defaultTemplateId`
- `allowedRoles`
- `tenantScope`（可选，为 To B 隔离预留）
- `createdAt/updatedAt`

设计意图：
- Scene 管“工具对外能力”，Template 管“提示词实现细节”。
- 支持一个 scene 多模板版本（甚至 A/B 模板）。

---

## 五、PromptTemplate 推荐数据结构

当前已有 `PromptTemplate + PromptVersion`，建议保留并收敛职责：
- `PromptTemplate` 作为“模板头 + 当前发布指针”。
- `PromptVersion` 作为“不可变历史快照”。

推荐增强（逻辑层，不要求本次落库）：
- 新增/约定 `sceneKey`（或通过 scene 关系拿到）为唯一逻辑归属。
- `templateType`（SYSTEM/USER/COMBINED，可选）
- `outputSchema`（可选 JSON Schema，用于结构化输出）
- `llmPolicy`（provider/model/temperature/maxTokens 等策略）

核心原则：
- Template 专注“生成逻辑”，不承担“页面展现策略”。

---

## 六、PromptVariable 推荐数据结构

当前变量推荐扩展为：
- `name: string`
- `label: string`
- `required: boolean`
- `source: 'user_input' | 'task_context' | 'user_profile' | 'system' | 'computed' | 'external_api'`
- `frontendVisible: boolean`
- `component: 'input' | 'textarea' | 'number' | 'select' | 'radio' | 'checkbox' | 'switch' | 'date' | 'json'`
- `defaultValue: unknown`
- `validation: { type?: string; min?: number; max?: number; regex?: string; enum?: string[]; message?: string }`
- `options?: Array<{ label: string; value: string }>`
- `description?: string`

说明：
- 若 `frontendVisible=false` 且 `source=task_context`，前端无需展示该字段，后端运行时自动注入。
- `validation` 应可直接转译为前端表单规则（例如 zod/react-hook-form rules）。

---

## 七、变量来源 source 设计

建议将 source 分两类：

### 7.1 用户输入类
- `user_input`：必须由用户填写（可附默认值、校验规则）。

### 7.2 系统注入类
- `task_context`：来自任务上下文（如论文题目、已确认大纲）。
- `user_profile`：来自用户身份信息（专业、学历、机构）。
- `system`：系统常量/策略（语言、输出格式、平台约束）。
- `computed`：基于请求字段二次计算生成。
- `external_api`：运行时从外部服务拉取（需超时与降级策略）。

运行时装配顺序建议：
1. 系统注入（system/task_context/user_profile）
2. 用户输入覆盖（user_input）
3. 计算变量（computed）
4. 外部拉取补充（external_api）
5. 最终变量白名单校验（防越权字段）

---

## 八、前端三种接入模式：固定页面、通用工具箱、嵌入组件

### 8.1 固定页面（如论文工作台）
- 页面保持阶段式 UX（选题/开题/大纲/摘要/正文）。
- 每个步骤内部改为调用统一 `/api/text-generation/run`，sceneKey 如：
  - `paper.topic.generate`
  - `paper.outline.generate`
  - `paper.abstract.generate`
- 页面可继续做强业务约束（阶段门禁、状态流转）。

### 8.2 通用工具箱（动态表单）
- 前端请求 `GET /api/text-generation/scenes` 获取可见场景。
- 请求 `GET /api/text-generation/scenes/:sceneKey/schema` 获取变量 schema。
- 按 `component + validation + frontendVisible` 自动渲染表单。
- 提交统一 run 接口，展示文本结果或结构化结果。

### 8.3 嵌入组件模式（业务内嵌）
- 提供 `TextGenerationPanel` 组件，业务页面仅传 `sceneKey` 与少量上下文。
- 组件内部完成 schema 拉取、变量装配、提交与结果渲染。
- 适合后台运营页面“插入式 AI 辅助生成”。

---

## 九、统一 API 设计

> 当前未发现 `/api/text-generation/run`，以下为建议契约。

### 9.1 场景查询
- `GET /api/text-generation/scenes`
  - 返回当前用户可见 scene 列表（含 mode/category/status/frontendConfig）。

- `GET /api/text-generation/scenes/:sceneKey/schema`
  - 返回场景元信息 + 变量 schema + 默认模型配置。

### 9.2 文本生成执行
- `POST /api/text-generation/run`

请求示例：
```json
{
  "sceneKey": "paper.outline.generate",
  "inputs": {
    "topic": "基于大模型的论文自动生产系统设计与实现",
    "targetWords": 12000
  },
  "context": {
    "taskId": "task_xxx"
  },
  "stream": true
}
```

返回建议：
- 同步：`{ code, message, data: { runId, output, usage, debug? } }`
- 流式：SSE chunk + usage + done（当前 prompt test 已有 SSE 经验可复用）

### 9.3 运行记录
- `GET /api/text-generation/runs/:runId`
- `GET /api/text-generation/runs?sceneKey=&taskId=&page=`

---

## 十、最小可行改造方案 P0/P1/P2

### P0（最小打通，不改业务主流程）
1. 新增文档契约（本次）。
2. 抽象统一 run service（先在应用层封装，不强制替换全部接口）。
3. 在论文工作台选 1 个步骤试点改造为调用统一 run（建议先 outline）。
4. PromptVariable 扩展字段先走 JSON 兼容读取（缺失字段使用默认值）。

### P1（场景可配置化）
1. 引入 TextGenerationScene（或同等配置表）管理可见场景。
2. 前端新增通用工具箱页面，按 schema 自动渲染表单。
3. 论文工作台逐步迁移各步骤至统一 run。
4. 增加场景级权限控制与机构隔离策略。

### P2（平台化与生态化）
1. 支持多模板策略（A/B、按角色/机构路由）。
2. 支持结构化输出 schema 校验与失败重试策略。
3. 支持 external_api source 与插件化变量解析。
4. 后台配置场景后，前端导航自动发现并分组展示。

---

## 十一、后续 GitHub Issue 拆分建议

> 按“单一主题、小步提交”原则拆分。

1. `docs(text-generation): define unified scene/template/variable architecture`
   - 输出：补充 05/06 文档与本设计文档关联。

2. `feat(api): add text-generation scene query and schema endpoints`
   - 输出：`/scenes` 与 `/scenes/:sceneKey/schema`。

3. `feat(api): add /api/text-generation/run unified execution endpoint`
   - 输出：统一运行入口 + SSE。

4. `refactor(api): adapt paper outline generation to unified run service`
   - 输出：先迁移一个论文场景（outline）。

5. `feat(web): build generic text-generation toolbox page`
   - 输出：动态表单 + 运行结果页。

6. `feat(web): extract reusable TextGenerationPanel embedded component`
   - 输出：业务页可嵌入生成组件。

7. `feat(admin): scene visibility and frontend config management`
   - 输出：后台配置可控“前端自动出现可用工具”。

8. `feat(auth): scene-level role and tenant scope guard`
   - 输出：按角色、机构隔离场景可见性与调用权限。

---

## 针对本次 10 个重点问题的结论（基于当前仓库）

1. **当前 Prompt 模板模块是否已支持 sceneKey？**  
   结论：**已支持**。`sceneKey` 在管理端创建/查询映射至 `PromptTemplate.code`，运行时按 code 调用。

2. **当前 sceneKey 是固定下拉、手动输入，还是可扩展配置？**  
   结论：**管理端为手动输入，且可扩展**（正则校验 + 唯一约束）；非固定下拉。

3. **当前变量配置是否只用于 Prompt 替换，还是已能驱动前端表单？**  
   结论：**主要用于 Prompt 替换**；前端编辑器有变量面板，但未形成通用业务表单自动驱动闭环。

4. **当前变量配置是否支持 source、frontendVisible、component、defaultValue、validation？**  
   结论：
   - `defaultValue`：**已支持**。
   - `source/frontendVisible/component/validation`：**当前未发现**后端完整支持。

5. **当前前端论文工作台是否可改造成统一调用 /api/text-generation/run？**  
   结论：**可以改造**，但当前为分散业务接口，需新增统一 run API 与变量装配层。

6. **是否需要新增 TextGenerationScene 场景管理模型？**  
   结论：**建议新增**。当前 scene(enum) 与 sceneKey(code)职责混用，不利于前端可发现配置。

7. **是否需要把 PromptTemplate 和 TextGenerationScene 拆成两个层级？**  
   结论：**建议拆分**。Scene 管理“产品能力”，Template 管理“提示词实现”。

8. **如何支持两种前端模式（固定页面 + 通用工具箱）？**  
   结论：通过 Scene+Schema+Run 三接口即可共存：固定页走 sceneKey 调用，工具箱按 schema 自动渲染。

9. **如何支持新增任意文本生成场景？**  
   结论：新增 Scene 配置 + 模板变量 schema + 权限配置，无需改业务页面（工具箱模式）；固定页可按需接入。

10. **如何实现“后台配置新场景，前端自动出现可用工具”？**  
   结论：前端工具箱基于 `GET /scenes` 动态渲染；后台保存 scene.status/mode/frontendConfig 后，前端自动发现。

