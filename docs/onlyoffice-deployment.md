# ONLYOFFICE Docs 本地部署与联调说明

## 1. 本地 Docker 启动

本 Issue 新增 `docker-compose.onlyoffice.yml`，用于在不改动现有开发依赖的情况下启动 ONLYOFFICE Document Server。

```bash
docker compose -f docker-compose.yml -f docker-compose.onlyoffice.yml up -d
```

默认端口：

- Document Server：`http://localhost:8082`
- NestJS API：通常为 `http://localhost:3001/api`
- Next.js Web：通常为 `http://localhost:3000`

## 2. 环境变量

```env
ONLYOFFICE_DOCUMENT_SERVER_URL=http://localhost:8082
ONLYOFFICE_CALLBACK_BASE_URL=http://host.docker.internal:3001
ONLYOFFICE_FILE_PUBLIC_BASE_URL=http://host.docker.internal:3001
ONLYOFFICE_JWT_ENABLED=false
ONLYOFFICE_JWT_SECRET=
ONLYOFFICE_EDITOR_MODE=edit
ONLYOFFICE_FORCE_SAVE_ENABLED=false
```

说明：

- `ONLYOFFICE_DOCUMENT_SERVER_URL`：浏览器加载 Document Server `api.js` 的地址。
- `ONLYOFFICE_CALLBACK_BASE_URL`：Document Server 能访问到的后端地址，用于 `callbackUrl`。
- `ONLYOFFICE_FILE_PUBLIC_BASE_URL`：Document Server 能访问到的文件下载地址，用于 `document.url`。
- 本地 Docker 联调时不要把 callback/file 地址配置成容器无法访问的 `localhost`；Linux 环境可能需要改成宿主机 IP。
- `ONLYOFFICE_EDITOR_MODE` 默认 `edit`。
- `ONLYOFFICE_FORCE_SAVE_ENABLED` 首期默认关闭；开启后会处理 ONLYOFFICE status=6 force save 回调。

## 3. JWT 配置

本地开发可以暂时关闭：

```env
ONLYOFFICE_JWT_ENABLED=false
```

生产环境建议开启：

```env
ONLYOFFICE_JWT_ENABLED=true
ONLYOFFICE_JWT_SECRET=请使用强随机密钥
```

同时需要保证 `docker-compose.onlyoffice.yml` 中 Document Server 的 `JWT_ENABLED/JWT_SECRET` 与 API 环境变量一致。后端在生成 editor config 时会写入 `token`，callback 收到 token 后会校验；不要把 `ONLYOFFICE_JWT_SECRET` 打印到日志。

## 4. Callback 与文件访问链路

1. 前端访问 `/api/thesis-word-files/:id/editor-config` 获取 editor config。
2. 浏览器加载 `${ONLYOFFICE_DOCUMENT_SERVER_URL}/web-apps/apps/api/documents/api.js`。
3. Document Server 按 `document.url` 下载当前 DOCX。
4. 用户在线编辑。
5. Document Server 调用 `/api/onlyoffice/callback/:wordFileId`。
6. 后端按 callback 中的 `url` 下载最新 DOCX，保存为新的 `ThesisWordFileVersion`。
7. 前端刷新版本记录后可看到 `ONLYOFFICE_EDITED` 版本。

文件下载 URL 与 callback URL 都带有短期签名参数，避免直接暴露本地存储路径。

## 5. 常见问题

### Document Server 访问不到 callbackUrl

- 确认 `ONLYOFFICE_CALLBACK_BASE_URL` 是 Document Server 容器可访问的地址。
- 不要在容器内使用只对浏览器有效的 `localhost:3001`。
- 可在 Document Server 容器内执行 curl 测试后端健康接口。

### Document Server 访问不到 document.url

- 确认 `ONLYOFFICE_FILE_PUBLIC_BASE_URL` 可由 Document Server 容器访问。
- 确认签名未过期，默认 editor config 中 URL 有效期为 1 小时。
- 确认 Word 初稿文件仍存在于 `storage/thesis-word-files/{taskId}/{documentId}/`。

### JWT token invalid

- 确认 API 与 Document Server 的 `ONLYOFFICE_JWT_SECRET/JWT_SECRET` 完全一致。
- 确认 `ONLYOFFICE_JWT_ENABLED` 与 Document Server `JWT_ENABLED` 同步。
- 本地调试可先关闭 JWT，但生产环境不建议关闭。

### 浏览器能访问但容器不能访问 localhost

浏览器里的 `localhost` 指开发机，而 Document Server 容器内的 `localhost` 指容器自身。请改用 `host.docker.internal` 或宿主机 IP。

### 保存后没有生成版本

- ONLYOFFICE 通常在关闭文档或 force save 时触发保存类 callback。
- 后端只对 status=2（ready for saving）与 status=6（force save）生成 `ONLYOFFICE_EDITED` 版本。
- status=4 表示无变化关闭，不生成版本。
- 检查 API 日志中是否有 callback 下载失败、签名过期或 JWT 校验失败。
