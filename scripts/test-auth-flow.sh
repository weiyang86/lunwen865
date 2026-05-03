#!/bin/bash

set -e

BASE="http://localhost:3001/api"

echo "=== 1. 发送注册验证码 ==="
curl -s -X POST "$BASE/auth/send-code" -H "Content-Type: application/json" \
  -d '{"target":"13800138001","type":"phone","scene":"REGISTER"}' | jq

echo "=== 2. 提示从控制台复制验证码 ==="
read -p "输入验证码: " CODE

echo "=== 3. 注册 ==="
RESP=$(curl -s -X POST "$BASE/auth/register" -H "Content-Type: application/json" \
  -d "{\"phone\":\"13800138001\",\"code\":\"$CODE\",\"nickname\":\"测试用户\"}")
echo "$RESP" | jq
TOKEN=$(echo "$RESP" | jq -r .accessToken)
REFRESH=$(echo "$RESP" | jq -r .refreshToken)

echo "=== 4. 获取我的信息 ==="
curl -s "$BASE/users/me" -H "Authorization: Bearer $TOKEN" | jq

echo "=== 5. 更新学校专业 ==="
curl -s -X PATCH "$BASE/users/me" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"school":"清华","major":"计算机","educationLevel":"UNDERGRADUATE"}' | jq

echo "=== 6. 刷新 Token ==="
curl -s -X POST "$BASE/auth/refresh" -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}" | jq

echo "=== 7. 旧 refreshToken 应失效 ==="
curl -s -X POST "$BASE/auth/refresh" -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}" | jq

echo "=== 8. 普通用户访问 admin 应 403 ==="
curl -s "$BASE/admin/users" -H "Authorization: Bearer $TOKEN" | jq
