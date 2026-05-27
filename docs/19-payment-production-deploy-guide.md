# 19 支付模块生产部署指南（配置与 secrets）

## 1. secrets 目录建议
通过 `docker-compose.prod.yml` 的只读挂载：
- 主机目录：`./secrets`
- 容器目录：`/app/secrets`

建议结构：

- `/app/secrets/wechat/apiclient_key.pem`
- `/app/secrets/wechat/wechat_public_key.pem`
- `/app/secrets/wechat/wechat_platform_cert.pem`
- `/app/secrets/alipay/app_private_key.pem`
- `/app/secrets/alipay/alipay_public_key.pem`

> 不要把上述文件提交到仓库。

## 2. 推荐环境变量

### 微信
- `WECHAT_PAY_APP_ID`
- `WECHAT_PAY_MCH_ID`
- `WECHAT_PAY_CERT_SERIAL_NO`
- `WECHAT_PAY_API_V3_KEY`
- `WECHAT_PAY_PRIVATE_KEY_PATH`
- `WECHAT_PAY_PUBLIC_KEY_PATH`
- `WECHAT_PAY_PLATFORM_CERT_PATH`
- `WECHAT_PAY_NOTIFY_URL`

### 支付宝
- `ALIPAY_APP_ID`
- `ALIPAY_PRIVATE_KEY_PATH`
- `ALIPAY_PUBLIC_KEY_PATH`
- `ALIPAY_GATEWAY`
- `ALIPAY_NOTIFY_URL`
- `ALIPAY_RETURN_URL`
- `ALIPAY_SELLER_ID`

## 3. 部署步骤
1. 准备 `.env.prod`（不要提交）。
2. 准备 `./secrets` 证书文件并设置权限。
3. 执行：`docker compose -f docker-compose.prod.yml up -d --build`。
4. 检查 API 启动日志，确认支付配置无缺失报错。

## 4. 回滚
- 若新 PATH 变量异常，可临时回退到旧变量（`*_PRIVATE_KEY`/`*_PUBLIC_KEY`）。
- 回滚后尽快恢复 PATH 方案，避免明文密钥直接注入。
