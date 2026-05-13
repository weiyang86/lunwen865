# 08 开发路线图（Development Roadmap）

## Phase 0（2~3 周）双通道上线闭环
### 目标
打通“客户登录 → 论文题目生成 → 开题报告生成 → 论文正文生成 → 导出下载”的 Client 最小可用闭环，机构侧仅保留不阻塞主链路的最小支持。

### 交付物
- 客户登录与鉴权闭环
- 题目生成可提交/可查看
- 开题报告生成与状态追踪
- 论文正文生成与阶段进度
- 交付下载可用链路
- 机构侧最小兼容（不阻塞 Client）

### 验收标准
- 客户可独立完成登录、题目、开题、正文、下载全链路
- 核心失败场景（鉴权失效、生成失败、下载失败）可恢复
- Client 核心链路 E2E 可重复执行

### 建议 Issues
- feat(client-auth): usable login and auth lifecycle
- feat(client-topic): thesis topic generation workflow
- feat(client-proposal): proposal generation and tracking
- feat(client-thesis): thesis body generation workflow
- feat(client-delivery): downloadable delivery loop

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
