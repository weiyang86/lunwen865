[OPEN] onlyoffice-save-failed

## Symptom
- OnlyOffice 编辑器提示“该文件无法保存/下载失败（请检查连接或联系管理员）”

## Hypotheses
- A: callback 签名过期/校验失败（expires/clock skew/URL 拼装错误）导致 API 返回 `{ error: 1 }`
- B: DocumentServer 无法访问 callbackUrl 或 fileUrl（localhost/容器网络/反向代理路径不通）
- C: API 在处理保存回调时，拉取 `body.url` 下载 docx 失败（DocumentServer 公网/内网地址不一致、DNS、网络策略）
- D: OnlyOffice JWT 配置不一致（jwtEnabled=true 但 secret/token 校验失败）
- E: 保存成功但后续写盘/数据库更新失败（权限/磁盘路径/DB 异常）导致 API 返回 `{ error: 1 }`

## What to Collect (pre-fix)
- API 侧：OnlyOffice callback 入口、签名/JWT 校验结果、status、下载 body.url 结果
- 配置：documentServerPublic/internal、callbackBaseUrl、fileBaseUrl、jwtEnabled

## Status
- runId: pre-fix

## Evidence
- `.env` 中 `ONLYOFFICE_FILE_BASE_URL` / `ONLYOFFICE_CALLBACK_BASE_URL` 指向 `http://host.docker.internal:3101/api`
- [main.ts](file:///Users/lei/my-app/apps/api/src/main.ts#L24-L25) 默认监听 `process.env.PORT ?? 3001`
- 本地接口 `http://127.0.0.1:3001/api/...` 可访问，说明 API 实际跑在 `3001`

## Provisional Conclusion
- 当前最可能命中 Hypothesis B：Document Server 回调/拉文件访问了错误端口 `3101`，导致编辑器可打开但保存和下载失败
