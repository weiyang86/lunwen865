# ONLYOFFICE Docs 多环境部署与联调说明

## 1. 支持的三种部署模式

### 1.1 本地混合开发

- Web/API 在宿主机运行。
- ONLYOFFICE Document Server 在 Docker 中运行。
- 浏览器访问 Document Server：`http://localhost:8088`。
- Document Server 访问 API：`http://host.docker.internal:3101/api`。

推荐配置：

```env
ONLYOFFICE_ENABLED=true
ONLYOFFICE_DOCUMENT_SERVER_PUBLIC_URL=http://localhost:8088
ONLYOFFICE_DOCUMENT_SERVER_INTERNAL_URL=http://localhost:8088
ONLYOFFICE_FILE_BASE_URL=http://host.docker.internal:3101/api
ONLYOFFICE_CALLBACK_BASE_URL=http://host.docker.internal:3101/api
ONLYOFFICE_JWT_ENABLED=true
ONLYOFFICE_JWT_SECRET=local-onlyoffice-secret-change-me
ONLYOFFICE_EDITOR_MODE=edit
```

启动 Document Server：

```bash
docker compose -f docker-compose.onlyoffice.local.yml up -d
```

### 1.2 本地全 Docker

- Web/API/ONLYOFFICE 都在 Docker Compose 网络中运行。
- 浏览器仍可通过宿主机端口访问 Document Server。
- Document Server 访问 API 使用服务名：`http://api:3101/api`。

推荐配置：

```env
ONLYOFFICE_ENABLED=true
ONLYOFFICE_DOCUMENT_SERVER_PUBLIC_URL=http://localhost:8088
ONLYOFFICE_DOCUMENT_SERVER_INTERNAL_URL=http://onlyoffice-document-server
ONLYOFFICE_FILE_BASE_URL=http://api:3101/api
ONLYOFFICE_CALLBACK_BASE_URL=http://api:3101/api
ONLYOFFICE_JWT_ENABLED=true
ONLYOFFICE_JWT_SECRET=local-onlyoffice-secret-change-me
ONLYOFFICE_EDITOR_MODE=edit
```

可按项目 Compose 服务名调整 `api` 与端口；关键原则是 Document Server 容器内能访问 `document.url` 和 `callbackUrl`。

### 1.3 云端生产

- 论文通系统通过 HTTPS 域名访问，例如 `https://lunwen86.bestshizhongyu.com`。
- ONLYOFFICE 使用独立 HTTPS 域名，例如 `https://office-lunwen.bestshizhongyu.com`。
- 生产环境必须启用 JWT，并确保 API 与 Document Server 使用同一个 secret。

推荐配置：

```env
ONLYOFFICE_ENABLED=true
ONLYOFFICE_DOCUMENT_SERVER_PUBLIC_URL=https://office-lunwen.bestshizhongyu.com
ONLYOFFICE_DOCUMENT_SERVER_INTERNAL_URL=https://office-lunwen.bestshizhongyu.com
ONLYOFFICE_FILE_BASE_URL=https://lunwen86.bestshizhongyu.com/api
ONLYOFFICE_CALLBACK_BASE_URL=https://lunwen86.bestshizhongyu.com/api
ONLYOFFICE_JWT_ENABLED=true
ONLYOFFICE_JWT_SECRET=请替换为强随机密钥
ONLYOFFICE_EDITOR_MODE=edit
```

可参考 `docker-compose.onlyoffice.prod.example.yml` 部署 Document Server，并通过 Nginx/Ingress 暴露 HTTPS 域名。

## 2. 新旧环境变量兼容

推荐使用新变量：

- `ONLYOFFICE_ENABLED`
- `ONLYOFFICE_DOCUMENT_SERVER_PUBLIC_URL`
- `ONLYOFFICE_DOCUMENT_SERVER_INTERNAL_URL`
- `ONLYOFFICE_FILE_BASE_URL`
- `ONLYOFFICE_CALLBACK_BASE_URL`
- `ONLYOFFICE_JWT_ENABLED`
- `ONLYOFFICE_JWT_SECRET`
- `ONLYOFFICE_EDITOR_MODE`

兼容旧变量：

- `ONLYOFFICE_DOCUMENT_SERVER_URL` 会映射为 `ONLYOFFICE_DOCUMENT_SERVER_PUBLIC_URL`。
- `ONLYOFFICE_FILE_PUBLIC_BASE_URL` 会映射为 `ONLYOFFICE_FILE_BASE_URL`。
- `ONLYOFFICE_CALLBACK_BASE_URL` 名称保持兼容。

如果配置缺失，editor-config 会返回 `missingConfig`，前端会展示具体缺失项，例如 `ONLYOFFICE_DOCUMENT_SERVER_PUBLIC_URL`、`ONLYOFFICE_CALLBACK_BASE_URL`、`ONLYOFFICE_FILE_BASE_URL`。

## 3. Nginx 反向代理建议

论文通系统：

```nginx
server {
  server_name lunwen86.bestshizhongyu.com;
  location /api/ {
    proxy_pass http://api:3101/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
  location / {
    proxy_pass http://web:3000;
  }
}
```

ONLYOFFICE：

```nginx
server {
  server_name office-lunwen.bestshizhongyu.com;
  client_max_body_size 200m;
  location / {
    proxy_pass http://onlyoffice-document-server:80;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

## 4. JWT 配置说明

本地和生产建议都开启 JWT：

```env
ONLYOFFICE_JWT_ENABLED=true
ONLYOFFICE_JWT_SECRET=local-onlyoffice-secret-change-me
```

`docker-compose.onlyoffice.local.yml` 默认使用同一个本地 secret。生产环境必须替换为强随机密钥，并保证 API 环境变量与 Document Server `JWT_SECRET` 完全一致。不要把 `ONLYOFFICE_JWT_SECRET` 打印到日志。

## 5. 验证命令

### 5.1 检查 Document Server 健康状态

```bash
curl -i http://localhost:8088/healthcheck
```

生产环境：

```bash
curl -i https://office-lunwen.bestshizhongyu.com/healthcheck
```

### 5.2 容器内验证 document.url

先从浏览器或 API 获取 editor-config，复制返回的 `editorConfig.document.url`，然后在 Document Server 容器内执行：

```bash
docker exec -it lunwen-onlyoffice-document-server-local bash
curl -I 'http://host.docker.internal:3101/api/onlyoffice/files/word-files/<wordFileId>/current?...'
```

全 Docker 模式应验证 `http://api:3101/api/...` 可达。

### 5.3 容器内验证 callbackUrl

```bash
docker exec -it lunwen-onlyoffice-document-server-local bash
curl -i -X POST 'http://host.docker.internal:3101/api/onlyoffice/callback/<wordFileId>?userId=<userId>&expires=<expires>&signature=<signature>' \
  -H 'Content-Type: application/json' \
  -d '{"status":4}'
```

签名参数由 editor-config 生成，手工构造时需使用后端签名逻辑；更推荐通过真实编辑器保存触发。

## 6. 常见问题

### 浏览器能访问但 Document Server 不能访问

浏览器里的 `localhost` 指开发机，而 Document Server 容器里的 `localhost` 指容器自身。本地混合开发请使用 `http://host.docker.internal:3101/api`；全 Docker 模式请使用 Compose 服务名 `http://api:3101/api`。

### localhost 使用错误

- `ONLYOFFICE_DOCUMENT_SERVER_PUBLIC_URL` 是浏览器访问的地址，可以是 `http://localhost:8088`。
- `ONLYOFFICE_FILE_BASE_URL` 和 `ONLYOFFICE_CALLBACK_BASE_URL` 是 Document Server 访问 API 的地址，不应使用容器不可达的 `localhost`。

### JWT secret 不一致

现象通常是编辑器报 token invalid 或 callback 被拒绝。请确认：

- API：`ONLYOFFICE_JWT_SECRET`
- Document Server：`JWT_SECRET`
- 两者完全一致，且 `ONLYOFFICE_JWT_ENABLED` 与 `JWT_ENABLED` 同步为 true。

### callback 不触发

- 确认 `ONLYOFFICE_CALLBACK_BASE_URL` 可由 Document Server 访问。
- 确认 Nginx/防火墙允许 Document Server 访问 `/api/onlyoffice/callback/:wordFileId`。
- ONLYOFFICE 通常在关闭文档、保存完成或 force save 时触发 callback，不等同于前端按钮立即成功。

### 保存后没有生成版本

- 后端只对 status=2 和 status=6 生成 `ONLYOFFICE_EDITED` 版本。
- status=4 表示无变化关闭，不生成版本。
- 重复 callback 会通过 checksum 幂等处理，不会重复创建大量相同版本。
- 检查 API 日志中是否有 callback 下载失败、签名过期或 JWT 校验失败。
