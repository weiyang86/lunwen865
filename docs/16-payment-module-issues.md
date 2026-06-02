# 16 支付模块开发任务拆分（GitHub Issues / 小 PR）

> 目标：可直接分派给 Codex 单独开发，单 PR 单主题，小步迭代。

---

## PR-1：支付通用底座与订单模型校验

- **标题**：`feat(payment-base): harden order creation and payment domain baseline`
- **背景**：当前订单能力存在，但支付记录域未标准化，需先打底。
- **目标**：完成订单创建校验闭环 + 预留 PaymentRecord 结构（不接真实支付，不到账）。
- **涉及文件路径**：
  - `apps/api/src/modules/order/**`
  - `apps/api/src/modules/payment/**`
  - `prisma/schema.prisma`（如需最小新增字段）
- **实现内容**：
  - 后端按商品定价建单
  - 订单状态流转边界校验
  - 支付创建请求的参数规范
- **不允许做的内容**：
  - 不接微信/支付宝 SDK
  - 不做到账
- **验收标准**：
  - 前端篡改价格无效
  - 用户仅可查看自己订单
- **本地验证方式**：
  - `pnpm --filter api lint/test/build`
  - Postman 验证订单归属与价格防篡改
- **风险等级**：P0
- **是否需要数据库迁移**：可能需要（最小）
- **是否需要环境变量**：否

---

## PR-2：PaymentProviderAdapter + MockPay

- **标题**：`feat(payment-adapter): add provider adapter abstraction and mock pay`
- **背景**：先打通支付编排与幂等链路，再接真实通道。
- **目标**：实现统一 Adapter 接口 + MockPay。
- **涉及文件路径**：
  - `apps/api/src/modules/payment/**`
- **实现内容**：
  - `PaymentProviderAdapter` 抽象
  - `MockPayAdapter`
  - dev/admin 下 mock success/fail
- **不允许做的内容**：
  - 不接真实微信/支付宝
  - 不改前端大 UI
- **验收标准**：
  - Mock 回调可驱动订单状态更新（或预处理流程）
- **本地验证方式**：
  - 调用 mock 接口，校验状态与日志
- **风险等级**：P0
- **是否需要数据库迁移**：否/可选
- **是否需要环境变量**：建议加 `PAYMENT_PROVIDER=mock`

---

## PR-3：微信 Native/H5 支付接入

- **标题**：`feat(payment-wechat): implement wechat native and h5 prepay + callback logging`
- **背景**：PC 扫码 + 手机 H5 是微信一期范围。
- **目标**：发起支付与回调日志落地（到账可先调用统一服务或仅日志）。
- **涉及文件路径**：
  - `apps/api/src/modules/payment/providers/wechat*`
  - `apps/api/src/modules/payment/**`
- **实现内容**：
  - native 返回 `code_url`
  - h5 返回 `mweb_url`
  - 回调验签解密 + 归一化结果
- **不允许做的内容**：
  - 不把私钥证书提交仓库
- **验收标准**：
  - 未配置密钥返回明确错误
  - 回调验签失败不入账
- **本地验证方式**：
  - mock 回调体 + 测试环境联调
- **风险等级**：P0
- **是否需要数据库迁移**：否/可选
- **是否需要环境变量**：是（微信）

---

## PR-4：支付宝 Page/Wap 支付接入

- **标题**：`feat(payment-alipay): implement alipay page and wap prepay + callback logging`
- **背景**：PC 网页 + 手机 Wap 是支付宝一期范围。
- **目标**：发起支付与回调验签日志落地。
- **涉及文件路径**：
  - `apps/api/src/modules/payment/providers/alipay*`
  - `apps/api/src/modules/payment/**`
- **实现内容**：
  - page/wap 链接或 form 返回
  - 异步通知验签 + 归一化
- **不允许做的内容**：
  - 不提交真实密钥
- **验收标准**：
  - 验签失败不入账
  - 金额不一致不入账
- **本地验证方式**：
  - 测试网关联调
- **风险等级**：P0
- **是否需要数据库迁移**：否/可选
- **是否需要环境变量**：是（支付宝）

---

## PR-5：统一支付回调幂等处理与脑细胞到账（核心 P0）

- **标题**：`feat(payment-settlement): unified callback idempotency and brain-cell settlement`
- **背景**：这是收费上线最关键能力。
- **目标**：微信/支付宝/mock 统一到账服务。
- **涉及文件路径**：
  - `apps/api/src/modules/payment/**`
  - `apps/api/src/modules/order/**`
  - `apps/api/src/modules/quota/**`
- **实现内容**：
  - 回调落日志
  - 业务校验（订单/金额/tradeNo）
  - 单事务到账（支付成功 -> 订单 paid -> 余额+流水）
  - 幂等（重复回调不重复到账）
- **不允许做的内容**：
  - 不做退款全流程（一期可预留）
- **验收标准**：
  - 同一订单只到账一次
  - 同一 providerTradeNo 不串单
- **本地验证方式**：
  - 并发回调脚本 + 重复通知回放
- **风险等级**：P0
- **是否需要数据库迁移**：可能需要（唯一约束/日志模型）
- **是否需要环境变量**：否（逻辑层）

---

## PR-6：用户端支付页面与后台查询页面

- **标题**：`feat(payment-ui): add payment result pages and admin payment observability`
- **背景**：当前支付可视化与排障页不足。
- **目标**：用户最小支付页 + 后台支付排障页。
- **涉及文件路径**：
  - `apps/web/app/(client)/**`
  - `apps/web/app/(admin)/**`
  - `apps/web/src/components/**`
- **实现内容**：
  - 用户：支付方式、扫码页、结果页、订单页增强、流水页
  - 后台：订单、支付记录、回调日志、脑细胞流水页面
- **不允许做的内容**：
  - 不做大规模 UI 重构
- **验收标准**：
  - 能定位“付款未到账/重复到账/金额不一致”
- **本地验证方式**：
  - `pnpm --filter web lint/test/build`
  - 人工流程回归
- **风险等级**：P0
- **是否需要数据库迁移**：否
- **是否需要环境变量**：否

---

## PR-7：主动查询、订单超时关闭与异常修复

- **标题**：`feat(payment-reconcile): active query, order expiry close and repair tools`
- **背景**：回调延迟/丢失必须有兜底。
- **目标**：主动查单、超时关单、异常修复入口。
- **涉及文件路径**：
  - `apps/api/src/modules/payment/reconcile.service.ts`
  - `apps/api/src/modules/order/order.cleanup.ts`
  - 管理端异常处理接口/页面
- **实现内容**：
  - 查单补单走统一幂等到账
  - 超时订单自动关闭
  - 异常订单标记与修复
- **不允许做的内容**：
  - 不做复杂财务对账系统
- **验收标准**：
  - 结果页可最终收敛到正确状态
- **本地验证方式**：
  - 定时任务 + 模拟延迟回调
- **风险等级**：P1
- **是否需要数据库迁移**：可选
- **是否需要环境变量**：可选

---

## 上线验收清单（执行版）

## 订单
- [ ] 用户查看套餐
- [ ] 用户创建订单
- [ ] 前端篡改价格无效
- [ ] 前端篡改脑细胞数量无效
- [ ] 用户仅可查看自己的订单
- [ ] 管理员可查看所有订单

## 微信
- [ ] PC 发起 Native 返回二维码
- [ ] 手机发起 H5 返回跳转链接
- [ ] 未配置密钥报错明确
- [ ] 验签失败不到账
- [ ] 金额不一致不到账
- [ ] 重复回调不重复到账

## 支付宝
- [ ] PC 发起 Page
- [ ] 手机发起 Wap
- [ ] 未配置密钥报错明确
- [ ] 验签失败不到账
- [ ] 金额不一致不到账
- [ ] 重复通知不重复到账

## 到账
- [ ] 支付成功后订单 paid
- [ ] PaymentRecord succeeded（或现阶段等价字段正确）
- [ ] 用户脑细胞余额增加
- [ ] 充值流水完整（含 before/after）
- [ ] 同一订单只到账一次
- [ ] 同一 providerTradeNo 不串单
- [ ] 到账失败可后台排查

## 前端
- [ ] 支付结果页查询后端状态
- [ ] 微信扫码页轮询状态
- [ ] 我的订单可见
- [ ] 脑细胞流水可见
- [ ] 余额不足提示清晰

## 后台
- [ ] 查订单
- [ ] 查支付记录
- [ ] 查脑细胞流水
- [ ] 查回调日志
- [ ] 可定位“付款未到账/重复到账/金额不一致”

- [x] PR-2 进行中：Provider Adapter 抽象 + MockPay。
- [x] API 新增：`POST /api/payments/create`。
- [x] mock success/fail 接口已补齐（development 可用）。
- [ ] 未处理：真实 wechat/alipay provider 接入（后续 PR-3/PR-4）。

## Issue fix(payment-ui): hide mock payment for clients and redirect after paid

- **状态**：已实现本 PR 修复。
- **后端**：mock / sandbox 支付接口增加 development/test + 管理员限制；普通用户 403。新增/复用 `GET /api/orders/:id/payment-status` 返回 paid、taskId、redirectUrl、brainCellBalance。
- **前端**：普通用户支付弹窗隐藏“沙箱一键支付”；点击“去支付”自动发起微信支付，PC Native 展示二维码，移动 H5 跳转；轮询后端支付状态，paid 后自动跳转。
- **风险控制**：不改微信/支付宝签名逻辑，不提交真实密钥，不变更 Prisma 数据模型和脑细胞到账核心逻辑。
