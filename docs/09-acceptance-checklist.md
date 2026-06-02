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
