# 04 技术架构（Technical Architecture）

## 1. 当前技术栈
- 前端：Next.js + React + TypeScript + Tailwind + React Query
- 后端：NestJS + Prisma
- DB：PostgreSQL
- 队列：BullMQ + Redis
- 外部能力：OpenAI/DeepSeek/Qwen、微信/支付宝

## 2. 推荐技术架构（目标态）
- 保持 Monorepo，但明确分层与边界：
  - `apps/web`：前端（admin / client / agency 分域）
  - `apps/api`：后端 API
  - `prisma`：模型与迁移
  - `docs`：契约与蓝图
  - `infra`（建议新增）：部署与运维

## 3. 前端分层建议
1. Router 页面层（`(client)`、`(agency)`、`(admin)`）
2. Feature 业务组件层
3. Service API 层
4. Lib 基础设施层（auth、query-client、utils）

## 4. 后端分层建议
1. Controller（输入输出协议）
2. Application Service（编排）
3. Domain Service（业务规则）
4. Repository/Prisma（数据访问）

## 5. 数据流（简述）
前端请求 → API 网关层（Nest）→ 业务服务 → Prisma → Postgres；
耗时任务通过 BullMQ 入队，由 Worker 处理并回写状态。

## 6. 权限体系
- 认证：JWT
- 授权：RBAC（USER/VIP/AGENCY_STAFF/TUTOR/ADMIN/SUPER_ADMIN）
- 建议补充：ABAC（机构数据隔离、订单归属、任务可见范围）

## 7. 部署架构建议
- 环境：dev / staging / prod
- 组件：web、api、postgres、redis、worker
- 要求：灰度发布、可回滚、证书与密钥统一密管
- 渠道要求：为机构端配置独立访问入口与审计日志

## 8. 风险点
- 任务状态机复杂导致异常补偿困难
- 支付回调幂等与对账压力
- 机构场景引入后，权限边界与数据隔离复杂度上升
- 前后台边界尚未完全产品化（C/B 前台不足）
