# 08 开发路线图（Development Roadmap）

## Phase 0（2~3 周）双通道上线闭环
### 目标
打通“学生自助下单 + 机构代下单/推单 → 任务推进 → 导出下载”的最小闭环。

### 交付物
- C 端基础页面
- 机构端基础页面（线索、代下单、进度）
- 订单支付联调记录
- 任务工作台 MVP
- 上线部署脚本（staging）

### 验收标准
- 一条学生直购订单可完整走通
- 一条机构代下单订单可完整走通
- 支付回调幂等通过
- 核心链路 E2E 可重复执行

### 建议 Issues
- feat(client): scaffold user-facing pages
- feat(agency): scaffold agency portal pages
- feat(order): support agency-assisted order flow
- feat(task): build unified task delivery timeline page
- chore(infra): staging deploy pipeline

## Phase 1（3~4 周）稳定性与协同提升
### 目标
提升可维护性、可观测性、机构协同与风控能力。

### 交付物
- 统一 API 错误码
- 状态机审计与回滚策略
- 监控告警方案
- 机构权限隔离与审计日志

### 验收标准
- 关键错误 10 分钟内可定位
- 非法状态迁移全部可拦截
- 机构无法访问非归属订单/任务

### 建议 Issues
- refactor(api): unify error envelope and codes
- feat(task): add state transition audit
- feat(auth): agency scope access control
- feat(obs): add metrics and alerting baseline

## Phase 2（持续优化）
### 目标
提高转化、效率与体验。

### 交付物
- 渠道转化报表
- Prompt 治理流程
- 性能优化清单
- 机构结算能力（如进入规划）

### 验收标准
- 列表查询 P95 达标
- 运营关键动作耗时下降
- 机构渠道订单转化可追踪

### 建议 Issues
- feat(admin): add channel conversion dashboard
- feat(prompt): version approval workflow
- perf(web): optimize heavy admin pages
- feat(agency): settlement and reconciliation module
