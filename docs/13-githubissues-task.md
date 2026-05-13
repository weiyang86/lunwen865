Issue 1
Title
client-1: 完善客户侧论文任务创建接口
Body
# client-1: 完善客户侧论文任务创建接口

## 背景

当前项目已经存在后端任务模块：

```text
apps/api/src/task/
├── task.controller.ts
├── task.controller.spec.ts
├── task.module.ts
├── task.service.ts
└── task.service.spec.ts
```

本 Issue 不需要重新创建 Task Module，而是在现有 `apps/api/src/task` 模块中补齐客户侧任务创建接口。

论文系统后续的题目生成、开题报告生成、论文正文生成都必须基于有效 `taskId`，因此需要先完成 Client 端任务 Bootstrap 能力。

## 目标

在现有 Task 模块中完成客户侧任务创建接口：

```http
POST /api/tasks/bootstrap
```

登录用户调用后，后端创建一个归属于当前用户的论文任务，并返回有效 `taskId`。

## Codex Web 执行要求

请先阅读并理解以下文件：

```text
AGENTS.md
README.md
package.json
apps/api/src/task/task.controller.ts
apps/api/src/task/task.service.ts
apps/api/src/task/task.module.ts
apps/api/src/task/task.controller.spec.ts
apps/api/src/task/task.service.spec.ts
apps/api/src/prisma
apps/api/src/common
apps/api/src/modules
```

请优先复用现有：

- Controller 写法
- Service 写法
- Prisma Service 写法
- Auth / Guard / CurrentUser 获取方式
- 异常处理方式
- 单元测试写法

## 禁止事项

- 不要新建重复的 `task` 模块。
- 不要新建第二套 TaskController。
- 不要大范围重构 `apps/api/src` 结构。
- 不要修改前端代码。
- 不要实现题目生成。
- 不要实现开题报告生成。
- 不要实现论文正文生成。
- 不要让前端传入 `userId`。
- 不要把 Prisma 原始错误、数据库异常、后端堆栈返回给前端。

## 建议接口

```http
POST /api/tasks/bootstrap
```

如果现有 Controller 已经使用 `/task` 单数路径，请优先检查项目已有路由规范。  
如果项目中已经有 `/api/task` 相关路径，可以保持项目风格，但需要在 PR 描述中说明最终接口路径。

## 建议请求体

```json
{
  "major": "计算机科学与技术",
  "direction": "人工智能教育应用",
  "requirements": "需要偏应用型，本科论文，结合系统设计与实现",
  "educationLevel": "本科",
  "paperType": "毕业论文"
}
```

## 建议返回体

```json
{
  "id": "task_xxx",
  "title": "人工智能教育应用方向论文任务",
  "status": "created",
  "major": "计算机科学与技术",
  "direction": "人工智能教育应用",
  "createdAt": "2026-05-12T10:00:00.000Z"
}
```

## 后端实现要求

- 在现有 `apps/api/src/task/task.controller.ts` 中补齐接口。
- 在现有 `apps/api/src/task/task.service.ts` 中补齐创建逻辑。
- 如项目已有 DTO 目录或 DTO 写法，请新增或复用 DTO。
- 从登录态中获取当前 `userId`。
- 创建任务时绑定当前登录用户。
- 默认任务状态为 `created`。
- title 可根据 `direction` 或 `major + direction` 自动生成。
- DTO 层完成参数校验。
- Service 层只做最小任务创建逻辑。
- 如果 Prisma schema 中已经有任务相关模型，优先复用。
- 如果没有任务模型，请在 Prisma schema 中新增最小模型，并生成 migration。
- 返回结构保持稳定，方便前端直接使用。

## 建议 DTO

可根据项目现有风格创建，例如：

```text
apps/api/src/task/dto/bootstrap-task.dto.ts
```

建议字段：

```ts
major: string;
direction: string;
requirements?: string;
educationLevel?: string;
paperType?: string;
```

## 错误处理要求

- 未登录：返回 401。
- 参数非法：返回 400。
- 服务异常：返回统一错误结构。
- 不返回 Prisma 原始异常。
- 不返回数据库字段细节。
- 不返回后端堆栈。

建议错误结构：

```json
{
  "code": "VALIDATION_ERROR",
  "message": "参数校验失败",
  "statusCode": 400
}
```

## 需要更新的测试

请更新或补充：

```text
apps/api/src/task/task.controller.spec.ts
apps/api/src/task/task.service.spec.ts
```

至少覆盖：

- 登录用户创建任务成功。
- 未登录用户创建任务失败。
- 参数非法创建任务失败。
- 创建任务后归属当前用户。
- 返回字段结构正确。

## 验收标准

- [ ] 登录用户可以成功创建任务。
- [ ] 创建成功后返回有效 `taskId`。
- [ ] 返回结果包含 `id`、`title`、`status`、`major`、`direction`、`createdAt`。
- [ ] 未登录用户调用接口返回 401。
- [ ] 参数非法时返回 400。
- [ ] `userId` 从登录态获取，不由前端传入。
- [ ] 任务默认状态为 `created`。
- [ ] 不泄漏 Prisma 原始错误。
- [ ] 不泄漏后端堆栈信息。
- [ ] 不新建重复 Task 模块。

## 验证命令

请执行并在 PR 描述中记录结果：

```bash
pnpm --filter api lint
pnpm --filter api test
pnpm --filter api build
```

如果项目没有对应命令，请根据 `package.json` 使用实际命令，并在 PR 描述中说明。

## PR 要求

目标分支：`dev`

建议分支名：

```text
feature/issue-task-bootstrap-api
```

建议 PR 标题：

```text
feat(task): complete client task bootstrap endpoint
```

PR 描述必须包含：

```md
## 影响范围

- api:
- database:
- tests:

## 变更说明

- 

## 最终接口路径

- 

## 验证命令与结果

- [ ] pnpm --filter api lint
- [ ] pnpm --filter api test
- [ ] pnpm --filter api build

## 人工验收清单

- [ ] 登录用户可以创建任务
- [ ] 未登录用户无法创建任务
- [ ] 参数非法时返回 400
- [ ] 返回有效 taskId
- [ ] userId 从登录态获取
- [ ] 没有新建重复 Task 模块
- [ ] 不展示后端堆栈信息

## 风险

- 

## 回滚方案

- 
```
Issue 2
Title
client-2: 完善客户侧我的任务列表接口
Body
# client-2: 完善客户侧我的任务列表接口

## 背景

当前项目已经存在任务模块：

```text
apps/api/src/task/
├── task.controller.ts
├── task.controller.spec.ts
├── task.module.ts
├── task.service.ts
└── task.service.spec.ts
```

客户创建论文任务后，需要在 Client 端查看自己的任务列表。后续题目生成、开题报告生成、论文正文生成都需要从任务列表进入。

本 Issue 只处理现有 Task 模块中的“我的任务列表”接口，不处理前端页面。

## 目标

在现有 Task 模块中完成客户侧我的任务列表接口：

```http
GET /api/tasks/me?page=1&pageSize=20
```

接口只返回当前登录用户自己的任务，不能返回其他用户数据。

## Codex Web 执行要求

请先阅读：

```text
AGENTS.md
README.md
package.json
apps/api/src/task/task.controller.ts
apps/api/src/task/task.service.ts
apps/api/src/task/task.controller.spec.ts
apps/api/src/task/task.service.spec.ts
apps/api/src/prisma
apps/api/src/common
```

请优先复用现有：

- Auth 获取用户方式
- Prisma 查询方式
- Controller 路由风格
- Service 返回格式
- 分页工具或分页约定
- 测试写法

## 禁止事项

- 不要新建重复 Task 模块。
- 不要新建第二套 TaskController。
- 不要实现前端页面。
- 不要实现题目生成。
- 不要实现开题报告生成。
- 不要实现论文正文生成。
- 不要返回其他用户任务。
- 不要大范围重构分页体系。
- 不要泄漏 Prisma 错误、数据库异常或后端堆栈。

## 建议接口

```http
GET /api/tasks/me?page=1&pageSize=20
```

如果当前项目已有 `/task` 单数路由规范，请保持项目风格，并在 PR 描述中说明最终接口路径。

## 建议返回结构

```json
{
  "items": [
    {
      "id": "task_xxx",
      "title": "人工智能教育应用方向论文任务",
      "status": "created",
      "major": "计算机科学与技术",
      "direction": "人工智能教育应用",
      "createdAt": "2026-05-12T10:00:00.000Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

无数据时返回：

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 0
}
```

## 后端实现要求

- 在现有 `task.controller.ts` 中补齐我的任务列表接口。
- 在现有 `task.service.ts` 中补齐查询逻辑。
- 从登录态中获取当前 `userId`。
- 只查询当前用户的任务。
- 支持 `page` 和 `pageSize`。
- 默认 `page=1`。
- 默认 `pageSize=20`。
- pageSize 建议设置上限，例如最大 100。
- 默认按 `createdAt` 倒序排列。
- 无数据返回空数组，不返回 500。
- page/pageSize 参数需要做边界处理。
- 不允许越权返回其他用户任务。

## 错误处理要求

- 未登录返回 401。
- 非法分页参数返回 400，或使用安全默认值。
- 服务异常返回统一错误结构。
- 不泄漏数据库异常。
- 不泄漏 Prisma 错误。
- 不泄漏后端堆栈。

## 需要更新的测试

请更新或补充：

```text
apps/api/src/task/task.controller.spec.ts
apps/api/src/task/task.service.spec.ts
```

至少覆盖：

- 当前用户有任务时返回列表。
- 当前用户无任务时返回空数组。
- 用户 A 不能看到用户 B 的任务。
- 未登录访问失败。
- page/pageSize 可用。
- pageSize 超过上限时有合理处理。

## 验收标准

- [ ] 登录用户可以查看自己的任务列表。
- [ ] 用户 A 不能看到用户 B 的任务。
- [ ] 无任务时返回 empty 结构。
- [ ] 支持分页。
- [ ] 默认按创建时间倒序。
- [ ] 未登录访问返回 401。
- [ ] 空数据不返回 500。
- [ ] 不泄漏后端异常信息。
- [ ] 不新建重复 Task 模块。

## 验证命令

请执行并在 PR 描述中记录结果：

```bash
pnpm --filter api lint
pnpm --filter api test
pnpm --filter api build
```

如果项目没有对应命令，请根据 `package.json` 使用实际命令，并在 PR 描述中说明。

## PR 要求

目标分支：`dev`

建议分支名：

```text
feature/issue-task-list-api
```

建议 PR 标题：

```text
feat(task): complete my-task list endpoint for client
```

PR 描述必须包含：

```md
## 影响范围

- api:
- tests:

## 变更说明

- 

## 最终接口路径

- 

## 验证命令与结果

- [ ] pnpm --filter api lint
- [ ] pnpm --filter api test
- [ ] pnpm --filter api build

## 人工验收清单

- [ ] 登录用户可查看自己的任务
- [ ] 无任务时返回空数组
- [ ] 不能查看其他用户任务
- [ ] 未登录返回 401
- [ ] 分页参数可用
- [ ] 空数据不返回 500
- [ ] 没有新建重复 Task 模块

## 风险

- 

## 回滚方案

- 
```
Issue 3
Title
client-3: 对齐任务模块接口契约与测试用例
Body
# client-3: 对齐任务模块接口契约与测试用例

## 背景

当前项目已经存在任务模块和测试文件：

```text
apps/api/src/task/task.controller.ts
apps/api/src/task/task.controller.spec.ts
apps/api/src/task/task.service.ts
apps/api/src/task/task.service.spec.ts
```

在补齐任务创建和任务列表接口后，需要统一 Task API 的路由契约、返回结构和测试覆盖，避免后续前端联调时出现路径不一致、字段不一致、状态码不一致的问题。

本 Issue 只处理后端现有 Task 模块的接口契约和测试对齐。

## 目标

统一并验证现有 Task API 的最小契约：

1. 创建任务接口可用。
2. 我的任务列表接口可用。
3. 返回字段稳定。
4. 错误状态稳定。
5. 测试覆盖核心场景。

## Codex Web 执行要求

请先阅读：

```text
apps/api/src/task/task.controller.ts
apps/api/src/task/task.service.ts
apps/api/src/task/task.controller.spec.ts
apps/api/src/task/task.service.spec.ts
apps/api/src/common
apps/api/src/prisma
```

请优先基于已有代码补齐测试，不要重写整个模块。

## 禁止事项

- 不要新建重复 Task 模块。
- 不要改动前端。
- 不要实现题目生成。
- 不要实现开题报告生成。
- 不要实现论文正文生成。
- 不要大范围重构 Controller / Service。
- 不要修改与 Task API 无关的模块。

## 需要确认的接口契约

### 任务创建

```http
POST /api/tasks/bootstrap
```

或项目实际采用的路径。

必须返回：

```json
{
  "id": "task_xxx",
  "title": "xxx",
  "status": "created",
  "major": "xxx",
  "direction": "xxx",
  "createdAt": "xxx"
}
```

### 我的任务列表

```http
GET /api/tasks/me?page=1&pageSize=20
```

或项目实际采用的路径。

必须返回：

```json
{
  "items": [],
  "page": 1,
  "pageSize": 20,
  "total": 0
}
```

## 测试要求

请重点补齐：

```text
apps/api/src/task/task.controller.spec.ts
apps/api/src/task/task.service.spec.ts
```

至少覆盖：

- 创建任务成功。
- 创建任务参数非法。
- 创建任务未登录。
- 查询我的任务列表成功。
- 查询我的任务列表为空。
- 查询我的任务列表只返回当前用户数据。
- 分页参数处理。
- 服务层不返回其他用户任务。

## 验收标准

- [ ] Task Controller 测试通过。
- [ ] Task Service 测试通过。
- [ ] 创建任务接口契约稳定。
- [ ] 我的任务列表接口契约稳定。
- [ ] 返回字段满足前端联调需要。
- [ ] 错误状态码符合预期。
- [ ] 无数据时返回 empty 结构。
- [ ] 不新建重复 Task 模块。
- [ ] 不影响现有 API 启动。

## 验证命令

```bash
pnpm --filter api lint
pnpm --filter api test
pnpm --filter api build
```

如果项目命令不同，请在 PR 中说明实际命令。

## PR 要求

目标分支：`dev`

建议分支名：

```text
fix/issue-task-api-contract-tests
```

建议 PR 标题：

```text
fix(task): align existing task api tests and route contracts
```

PR 描述必须包含：

```md
## 影响范围

- api:
- tests:

## 变更说明

- 

## 最终接口路径

- POST:
- GET:

## 验证命令与结果

- [ ] pnpm --filter api lint
- [ ] pnpm --filter api test
- [ ] pnpm --filter api build

## 人工验收清单

- [ ] 任务创建接口契约稳定
- [ ] 我的任务列表接口契约稳定
- [ ] Task Controller 测试通过
- [ ] Task Service 测试通过
- [ ] 没有新建重复模块

## 风险

- 

## 回滚方案

- 
```
Issue 4
Title
client-4: 实现客户侧可用的任务列表页面
Body
# client-4: 实现客户侧可用的任务列表页面

## 背景

后端已经存在并正在补齐 Task API。Client 端需要一个真实可用的任务列表页面，客户登录后可以看到自己的论文任务。这个页面是后续进入题目生成、开题报告生成、论文正文生成的入口。

本 Issue 只处理前端任务列表页面接入真实 API，不处理任务创建表单，不处理题目生成。

## 目标

将 `/tasks` 页面从页面骨架升级为真实可用任务列表。

接入后端接口：

```http
GET /api/tasks/me?page=1&pageSize=20
```

如果后端最终路径不是该路径，请根据后端 PR 中确认的最终路径接入。

## Codex Web 执行要求

请先阅读：

```text
AGENTS.md
README.md
package.json
apps/web
```

同时检查：

- 前端项目结构
- 现有 API client 封装
- 现有 auth/token 处理方式
- 现有页面路由结构
- 现有 UI 组件风格
- 现有测试写法

## 禁止事项

- 不要重构整个前端项目。
- 不要新增无关 UI 框架。
- 不要实现任务创建表单。
- 不要实现题目生成。
- 不要修改后端代码。
- 不要改动与任务列表无关的大量文件。
- 不要直接展示后端堆栈、Prisma 错误或 Internal Server Error 原文。

## 页面状态要求

`/tasks` 页面必须支持以下状态：

1. `loading`：加载中。
2. `empty`：暂无任务，引导用户创建任务。
3. `error`：加载失败，提供重试按钮。
4. `success`：展示任务列表。

## 列表展示字段

每个任务至少展示：

- 任务标题
- 专业
- 方向
- 状态
- 创建时间

## 前端实现要求

- 页面加载时请求任务列表接口。
- 如果接口返回空数组，展示 empty 状态。
- 如果接口失败，展示 error 状态和“重新加载”按钮。
- 如果接口成功，展示任务列表。
- token 失效时按照项目现有规则跳转登录页。
- 移动端基础适配，不要求复杂设计，但不能明显错位。
- 保持项目现有 UI 风格。
- 优先复用现有 API client、toast、loading、empty 组件。

## 建议 UI 文案

空状态：

```text
暂无论文任务
你可以先创建一个论文任务，然后生成论文题目、开题报告和论文正文。
```

错误状态：

```text
任务列表加载失败，请稍后重试。
```

重试按钮：

```text
重新加载
```

## 验收标准

- [ ] 登录用户进入 `/tasks` 后可以看到自己的任务列表。
- [ ] 无任务时显示明确 empty 引导。
- [ ] 接口加载中显示 loading。
- [ ] 接口失败时显示错误提示和重试按钮。
- [ ] 点击重试可以重新请求接口。
- [ ] 页面刷新后仍可加载任务列表。
- [ ] 移动端基础显示正常。
- [ ] 不直接展示后端堆栈。
- [ ] token 失效时按项目规则处理。

## 建议测试

至少覆盖：

- loading 状态。
- empty 状态。
- error 状态。
- success 状态。
- API 返回任务列表后的渲染。
- 重试按钮可触发重新请求。

## 验证命令

```bash
pnpm --filter web lint
pnpm --filter web test
pnpm --filter web build
```

如果项目命令不同，请在 PR 中说明实际命令。

## PR 要求

目标分支：`dev`

建议分支名：

```text
feature/issue-client-task-list-page
```

建议 PR 标题：

```text
feat(client-task): implement usable task list page
```

PR 描述必须包含：

```md
## 影响范围

- web:
- tests:

## 变更说明

- 

## 接入接口

- 

## 验证命令与结果

- [ ] pnpm --filter web lint
- [ ] pnpm --filter web test
- [ ] pnpm --filter web build

## 人工验收清单

- [ ] loading 状态正常
- [ ] empty 状态正常
- [ ] error 状态正常
- [ ] success 状态正常
- [ ] 重试按钮可用
- [ ] 页面刷新后仍可加载
- [ ] 移动端基础显示正常
- [ ] 不展示后端堆栈

## 风险

- 

## 回滚方案

- 
```
Issue 5
Title
client-5: 新增客户侧论文任务创建表单
Body
# client-5: 新增客户侧论文任务创建表单

## 背景

客户需要在 Client 端主动创建论文任务。创建成功后后端返回 `taskId`，后续题目生成、开题报告生成、论文正文生成都基于该 `taskId` 进行。

本 Issue 只处理前端任务创建表单，不处理后端接口实现，不处理题目生成。

## 前置依赖

后端接口需要已可用：

```http
POST /api/tasks/bootstrap
```

如果后端最终路径不同，请根据后端 PR 中确认的最终路径接入。

同时建议 `/tasks` 页面已经可以展示任务列表。

## 目标

在 `/tasks` 页面增加任务创建表单，客户可以填写论文基础信息并创建任务。

## Codex Web 执行要求

请先阅读：

```text
AGENTS.md
README.md
package.json
apps/web
```

同时检查：

- `/tasks` 页面现有实现
- 现有表单组件
- 现有 API client 封装
- 现有错误提示组件或 toast 组件
- 现有测试写法

## 禁止事项

- 不要重构整个任务列表页。
- 不要修改后端代码。
- 不要实现题目生成。
- 不要实现开题报告生成。
- 不要实现论文正文生成。
- 不要引入新的大型表单库，除非项目已经使用。
- 不要展示后端堆栈、Prisma 错误或 Internal Server Error 原文。

## 表单字段

建议字段：

- `major`：专业，必填。
- `direction`：研究方向，必填。
- `paperType`：论文类型，必填。
- `educationLevel`：学历层次，必填。
- `requirements`：具体要求，选填或限制长度。

## 接口

```http
POST /api/tasks/bootstrap
```

## 建议请求体

```json
{
  "major": "计算机科学与技术",
  "direction": "人工智能教育应用",
  "paperType": "毕业论文",
  "educationLevel": "本科",
  "requirements": "需要偏应用型，本科论文，结合系统设计与实现"
}
```

## 前端实现要求

- 表单字段必填校验。
- `requirements` 做长度限制。
- 提交中按钮禁用。
- 提交中显示 loading。
- 防止重复提交。
- 创建成功后刷新任务列表。
- 创建成功后提示用户。
- 创建成功后高亮新任务，或滚动到新任务。
- 创建失败时显示友好错误文案。
- token 失效时按照项目现有规则跳转登录。
- 不展示后端内部异常。

## 建议 UI 文案

创建按钮：

```text
创建论文任务
```

创建成功：

```text
论文任务创建成功
```

创建失败：

```text
论文任务创建失败，请稍后重试
```

必填提示：

```text
请填写专业
请填写研究方向
请选择论文类型
请选择学历层次
```

## 验收标准

- [ ] 用户可以填写表单创建任务。
- [ ] 必填字段未填写时不能提交。
- [ ] 提交中按钮禁用，不能重复提交。
- [ ] 创建成功后任务列表自动刷新。
- [ ] 创建成功后用户可以看到新任务。
- [ ] 创建失败时有明确提示。
- [ ] token 失效时按照项目规则跳转登录。
- [ ] 不展示后端堆栈。
- [ ] 不影响已有任务列表展示。

## 建议测试

至少覆盖：

- 表单默认渲染。
- 必填校验。
- 提交成功。
- 提交失败。
- 提交中按钮禁用。
- 创建成功后刷新列表。
- 创建成功后新任务可见。

## 验证命令

```bash
pnpm --filter web lint
pnpm --filter web test
pnpm --filter web build
```

如果项目命令不同，请在 PR 中说明实际命令。

## PR 要求

目标分支：`dev`

建议分支名：

```text
feature/issue-client-task-create-form
```

建议 PR 标题：

```text
feat(client-task): add task bootstrap form for client
```

PR 描述必须包含：

```md
## 影响范围

- web:
- tests:

## 变更说明

- 

## 接入接口

- 

## 验证命令与结果

- [ ] pnpm --filter web lint
- [ ] pnpm --filter web test
- [ ] pnpm --filter web build

## 人工验收清单

- [ ] 表单可填写
- [ ] 必填校验可用
- [ ] 提交成功后刷新列表
- [ ] 提交失败有提示
- [ ] 提交中不能重复点击
- [ ] 新任务可见
- [ ] 不影响任务列表展示

## 风险

- 

## 回滚方案

- 
```
Issue 6
Title
client-6: 实现从任务列表进入题目生成工作区
Body
# client-6: 实现从任务列表进入题目生成工作区

## 背景

客户创建论文任务后，需要从任务列表进入对应任务的题目生成页面。题目生成必须基于有效 `taskId`，否则后续开题报告、正文生成都无法形成闭环。

本 Issue 只处理从任务列表跳转到题目生成上下文，不实现题目生成接口和 AI 生成逻辑。

## 目标

在任务列表中增加“生成题目”入口，点击后进入对应任务的题目生成上下文。

## Codex Web 执行要求

请先阅读：

```text
AGENTS.md
README.md
package.json
apps/web
```

同时检查：

- 当前前端路由结构
- `/tasks` 页面
- 现有题目生成页面
- 现有 `ClientTopicWorkbench` 组件，如果存在
- 现有 taskId 获取方式
- 现有错误提示组件或 toast 组件

## 禁止事项

- 不要重构整个路由系统。
- 不要实现后端题目生成接口。
- 不要实现 AI 题目生成逻辑。
- 不要实现开题报告生成。
- 不要实现论文正文生成。
- 不要修改无关页面。
- 不要出现白屏或未捕获异常。

## 建议路由

请优先使用项目已有路由风格。

如果项目支持动态路由，建议：

```http
/tasks/{taskId}/topics
```

如果当前项目暂时不方便新增动态路由，可以使用：

```http
/tasks?taskId=<id>&tab=topic
```

Codex 请根据现有项目结构选择改动更小、更稳定的方案。

## 前端实现要求

- 任务列表每个任务增加“生成题目”按钮。
- 点击后携带当前任务 `taskId`。
- 题目生成页面或组件可以读取当前 `taskId`。
- taskId 缺失时提示“请先创建论文任务”。
- taskId 无效或无权限时提示“任务不存在或无权限访问”。
- 页面刷新后仍能识别 taskId。
- 不允许出现白屏。
- 不允许未捕获异常。
- 保持现有 UI 风格。

## 建议 UI 文案

按钮：

```text
生成题目
```

taskId 缺失：

```text
请先创建论文任务
```

taskId 无效：

```text
任务不存在或无权限访问
```

## 验收标准

- [ ] 任务列表中可以看到“生成题目”入口。
- [ ] 点击后进入对应任务的题目生成上下文。
- [ ] 题目生成页面或组件可以读取 taskId。
- [ ] taskId 缺失时有友好提示。
- [ ] taskId 无效时有友好提示。
- [ ] 页面刷新后仍能识别 taskId。
- [ ] 不出现白屏。
- [ ] 不影响任务列表和任务创建功能。

## 建议测试

至少覆盖：

- 点击任务中的“生成题目”按钮。
- 正确携带 taskId。
- 题目生成上下文能读取 taskId。
- taskId 缺失状态。
- taskId 无效状态。
- 页面刷新后 taskId 仍可读取。

## 验证命令

```bash
pnpm --filter web lint
pnpm --filter web test
pnpm --filter web build
```

如果项目命令不同，请在 PR 中说明实际命令。

## PR 要求

目标分支：`dev`

建议分支名：

```text
feature/issue-task-to-topic-navigation
```

建议 PR 标题：

```text
feat(client-topic): enable navigation from task list to topic workspace
```

PR 描述必须包含：

```md
## 影响范围

- web:
- routes:
- tests:

## 变更说明

- 

## 最终路由方案

- 

## 验证命令与结果

- [ ] pnpm --filter web lint
- [ ] pnpm --filter web test
- [ ] pnpm --filter web build

## 人工验收清单

- [ ] 任务列表有生成题目按钮
- [ ] 点击后进入题目生成上下文
- [ ] taskId 可以读取
- [ ] taskId 缺失有提示
- [ ] taskId 无效有提示
- [ ] 页面刷新后仍可识别 taskId
- [ ] 页面不白屏

## 风险

- 

## 回滚方案

- 
```
Issue 7
Title
client-7: 统一任务主链路的接口错误处理与前端提示
Body
# client-7: 统一任务主链路的接口错误处理与前端提示

## 背景

当前项目已有 Task 模块。任务创建、任务列表、题目入口是 Client 主链路的前置能力。需要统一前后端错误码和错误提示，避免用户看到后端内部异常、Prisma 错误、Internal Server Error 等不可读信息。

本 Issue 只处理任务 Bootstrap 相关错误处理，不新增业务功能。

## 目标

统一以下链路的错误处理：

- 创建任务
- 查看我的任务列表
- 从任务列表进入题目生成上下文

## Codex Web 执行要求

请先阅读：

```text
apps/api/src/task/task.controller.ts
apps/api/src/task/task.service.ts
apps/api/src/common
apps/web
```

重点检查：

- 后端统一异常处理代码
- 前端 API client 错误处理
- 任务创建接口
- 任务列表接口
- 题目入口页面或组件
- 现有 toast / message / alert 组件

## 禁止事项

- 不要重构整个错误处理系统。
- 不要引入新的大型错误处理框架。
- 不要新增业务功能。
- 不要实现题目生成。
- 不要实现开题报告生成。
- 不要实现论文正文生成。
- 不要直接展示 `Internal Server Error`。
- 不要直接展示 `PrismaClientKnownRequestError`。
- 不要直接展示后端堆栈。

## 需要覆盖的错误场景

- 未登录。
- token 失效。
- 参数错误。
- 任务不存在。
- 任务无权限。
- 网络异常。
- 服务端异常。

## 建议错误结构

```json
{
  "code": "TASK_NOT_FOUND",
  "message": "任务不存在或无权限访问",
  "statusCode": 404
}
```

## 后端要求

- 返回稳定的错误结构。
- 常见错误需要有明确 `code` 和 `message`。
- 不返回 Prisma 错误详情。
- 不返回数据库字段细节。
- 不返回后端堆栈。
- 参数校验失败时返回用户可理解信息。
- 任务不存在或无权限时返回统一安全提示，避免泄漏资源存在性。

## 前端要求

- 未登录或 token 失效：按项目规则跳转登录。
- 参数错误：展示用户可理解提示。
- 任务不存在或无权限：展示“任务不存在或无权限访问”。
- 网络异常：展示“网络异常，请稍后重试”。
- 服务端异常：展示“服务暂时不可用，请稍后重试”。
- 不直接展示 `Internal Server Error`。
- 不直接展示 `PrismaClientKnownRequestError`。
- 不直接展示后端堆栈。

## 建议前端文案

未登录：

```text
登录状态已失效，请重新登录
```

参数错误：

```text
请检查填写内容后重试
```

任务不存在或无权限：

```text
任务不存在或无权限访问
```

网络异常：

```text
网络异常，请稍后重试
```

服务端异常：

```text
服务暂时不可用，请稍后重试
```

## 验收标准

- [ ] 未登录有正确处理。
- [ ] token 失效有正确处理。
- [ ] 参数错误有用户可读提示。
- [ ] 任务不存在有用户可读提示。
- [ ] 无权限有用户可读提示。
- [ ] 网络异常有用户可读提示。
- [ ] 服务端异常不泄漏堆栈。
- [ ] 前后端错误码语义一致。
- [ ] 不影响任务创建正常链路。
- [ ] 不影响任务列表正常链路。
- [ ] 不影响题目入口跳转正常链路。

## 建议测试

至少覆盖：

- API 参数错误。
- API 未登录。
- API 任务不存在。
- API 越权访问。
- 前端错误提示渲染。
- 前端 token 失效处理。
- 网络异常提示。
- 服务端异常提示。

## 验证命令

```bash
pnpm --filter web lint
pnpm --filter web test
pnpm --filter web build

pnpm --filter api lint
pnpm --filter api test
pnpm --filter api build
```

如果项目命令不同，请在 PR 中说明实际命令。

## PR 要求

目标分支：`dev`

建议分支名：

```text
fix/issue-task-error-handling
```

建议 PR 标题：

```text
fix(task): align task api error handling for client flow
```

PR 描述必须包含：

```md
## 影响范围

- web:
- api:
- tests:

## 变更说明

- 

## 验证命令与结果

- [ ] pnpm --filter web lint
- [ ] pnpm --filter web test
- [ ] pnpm --filter web build
- [ ] pnpm --filter api lint
- [ ] pnpm --filter api test
- [ ] pnpm --filter api build

## 人工验收清单

- [ ] 未登录提示正确
- [ ] token 失效处理正确
- [ ] 参数错误提示正确
- [ ] 任务不存在提示正确
- [ ] 无权限提示正确
- [ ] 网络异常提示正确
- [ ] 服务端异常提示正确
- [ ] 不展示后端堆栈
- [ ] 不影响正常创建任务
- [ ] 不影响正常查看任务列表

## 风险

- 

## 回滚方案

- 
```
Issue 8
Title
补充客户任务创建到题目入口的端到端测试
Body
# 补充客户任务创建到题目入口的端到端测试

## 背景

任务 Bootstrap 是论文系统 Client 主链路的前置能力。为了保证后续题目生成、开题报告生成、论文正文生成稳定推进，需要增加最小 e2e 或脚本级回归验证。

本 Issue 只处理测试，不新增业务功能。

## 目标

增加最小链路验证：

```text
登录 → 创建任务 → 任务列表可见 → 点击生成题目 → 进入题目生成上下文
```

## Codex Web 执行要求

请先阅读：

```text
AGENTS.md
README.md
package.json
apps/api/src/task
apps/web
```

重点检查：

- 项目现有测试框架
- 现有 e2e 配置
- 现有测试账号或测试数据创建方式
- 登录测试相关代码
- 任务创建接口测试
- 任务列表页面测试
- 题目入口相关页面或组件

## 禁止事项

- 不要新增业务功能。
- 不要重构整个测试体系。
- 不要大范围修改登录逻辑。
- 不要大范围修改任务页面。
- 不要为了测试绕过真实鉴权逻辑，除非项目已有标准测试工具。
- 不要引入新的大型测试框架，除非项目已经使用或没有任何测试框架。

## 测试范围

必须覆盖正常链路：

1. 用户登录。
2. 创建论文任务。
3. 返回有效 taskId。
4. 任务列表中可以看到新任务。
5. 点击“生成题目”。
6. 进入题目生成上下文。
7. 页面能够识别 taskId。

建议覆盖异常链路：

- 未登录访问 `/tasks`。
- taskId 缺失。
- taskId 无效。

## 实现要求

如果项目已有 e2e 框架：

- 基于现有 e2e 框架补充测试。
- 不要新建重复配置。
- 复用已有登录 helper、test user、seed 工具。

如果项目暂时没有完整 e2e 框架：

- 增加脚本级验证或最小集成测试。
- 在 PR 中说明暂未配置完整 e2e。
- 在 PR 中补充人工验证步骤和结果。

## 验收标准

- [ ] 正常链路测试可重复执行。
- [ ] 登录后可以创建任务。
- [ ] 创建任务后列表可见。
- [ ] 点击生成题目后进入对应上下文。
- [ ] 页面能够识别 taskId。
- [ ] taskId 缺失异常有验证。
- [ ] 测试失败时能定位具体步骤。
- [ ] PR 中说明测试运行方式。
- [ ] 不新增业务功能。

## 建议测试命名

可参考：

```text
client-task-bootstrap.e2e-spec.ts
```

或按项目已有命名规范处理。

## 验证命令

优先执行：

```bash
pnpm test:e2e
```

同时执行：

```bash
pnpm --filter web lint
pnpm --filter web test
pnpm --filter web build

pnpm --filter api lint
pnpm --filter api test
pnpm --filter api build
```

如果项目没有 `pnpm test:e2e`，请在 PR 中说明实际命令，例如：

```bash
pnpm --filter web test
pnpm --filter api test
```

并补充人工验证结果。

## PR 要求

目标分支：`dev`

建议分支名：

```text
test/issue-client-task-bootstrap-e2e
```

建议 PR 标题：

```text
test(e2e): cover client task bootstrap to topic-entry flow
```

PR 描述必须包含：

```md
## 影响范围

- tests:
- web:
- api:

## 变更说明

- 

## 验证命令与结果

- [ ] pnpm test:e2e
- [ ] pnpm --filter web lint
- [ ] pnpm --filter web test
- [ ] pnpm --filter web build
- [ ] pnpm --filter api lint
- [ ] pnpm --filter api test
- [ ] pnpm --filter api build

## 覆盖链路

- [ ] 登录
- [ ] 创建任务
- [ ] 任务列表可见
- [ ] 点击生成题目
- [ ] 进入题目生成上下文
- [ ] taskId 可识别
- [ ] taskId 缺失异常

## 人工验收清单

- [ ] 测试可以重复执行
- [ ] 测试失败时能定位具体步骤
- [ ] 不新增业务功能
- [ ] 不影响现有测试

## 风险

- 

## 回滚方案

- 
```