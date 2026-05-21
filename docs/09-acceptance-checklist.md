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

- [ ] Issue #93: wechat/native 返回 code_url 且写入 PaymentRecord.qrCodeUrl。
- [ ] Issue #93: wechat/h5 返回 mweb_url 且写入 PaymentRecord.payUrl。
- [ ] Issue #93: 微信回调验签失败/金额不一致仅记日志，不做到账。

- [ ] Issue #94: alipay/page 返回 payUrl 或 clientPayload 并写入 PaymentRecord。
- [ ] Issue #94: alipay/wap 返回 payUrl 或 clientPayload 并写入 PaymentRecord。
- [ ] Issue #94: 支付宝异步通知验签失败/金额不一致仅记日志，不做到账。

- [ ] Issue #95: wechat/alipay/mock 成功回调统一进入 PaymentCallbackService。
- [ ] Issue #95: PaymentRecord succeeded + Order paid + 充值流水一致。
- [ ] Issue #95: 重复回调与并发回调不重复到账。
