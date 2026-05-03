#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3001/api}"
USER_ID="${USER_ID:-}"
SCHOOL_ID="${SCHOOL_ID:-}"

if [[ -z "$USER_ID" || -z "$SCHOOL_ID" ]]; then
  echo "Missing USER_ID or SCHOOL_ID."
  echo "Example:"
  echo "  USER_ID=... SCHOOL_ID=... API_BASE=$API_BASE bash $0"
  exit 1
fi

http_code() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -sS -o /dev/null -w '%{http_code}' -X "$method" "$url" \
      -H 'Content-Type: application/json' \
      --data "$body"
  else
    curl -sS -o /dev/null -w '%{http_code}' -X "$method" "$url"
  fi
}

json_get() {
  local json="$1"
  local key="$2"
  python3 - "$key" <<'PY'
import json, sys
key = sys.argv[1]
obj = json.load(sys.stdin)
print(obj.get(key, ""))
PY
}

echo "1) GET /"
code="$(http_code GET "$API_BASE/")"
test "$code" = "200"

echo "2) POST /tasks (create)"
create_body="$(cat <<JSON
{
  "userId": "$USER_ID",
  "schoolId": "$SCHOOL_ID",
  "major": "CS",
  "educationLevel": "本科",
  "title": "Writing e2e",
  "topic": "自动生成论文系统的后端设计",
  "wordCountTarget": 5000
}
JSON
)"
task_json="$(curl -sS -X POST "$API_BASE/tasks" -H 'Content-Type: application/json' --data "$create_body")"
task_id="$(printf '%s' "$task_json" | python3 - <<'PY'
import json,sys
obj=json.load(sys.stdin)
print(obj["id"])
PY
)"
test -n "$task_id"

echo "3) GET /tasks/:id"
code="$(http_code GET "$API_BASE/tasks/$task_id")"
test "$code" = "200"

echo "4) GET /tasks/:taskId/writing/sessions"
code="$(http_code GET "$API_BASE/tasks/$task_id/writing/sessions")"
test "$code" = "200"

echo "5) GET /tasks/:taskId/writing/sessions/latest"
code="$(http_code GET "$API_BASE/tasks/$task_id/writing/sessions/latest")"
test "$code" = "200"

echo "6) GET /tasks/:taskId/writing/document (no session yet => 404)"
code="$(http_code GET "$API_BASE/tasks/$task_id/writing/document")"
test "$code" = "404"

echo "7) POST /tasks/:taskId/writing/start (outline not locked => 400)"
code="$(http_code POST "$API_BASE/tasks/$task_id/writing/start" '{"temperature":0.7,"maxTokensPerSection":1024}')"
test "$code" = "400"

echo "8) POST /tasks/:taskId/writing/cancel/:sessionId (always 200)"
code="$(http_code POST "$API_BASE/tasks/$task_id/writing/cancel/test_session")"
test "$code" = "200"

echo "9) GET /tasks/:taskId/writing/sessions/:sessionId/sections (unknown session => 200, empty)"
code="$(http_code GET "$API_BASE/tasks/$task_id/writing/sessions/test_session/sections")"
test "$code" = "200"

echo "10) POST /tasks/:taskId/writing/sections/:sectionId (unknown section => 404)"
code="$(http_code POST "$API_BASE/tasks/$task_id/writing/sections/test_section" '{"content":"hello"}')"
test "$code" = "404"

echo "11) GET /tasks/:id/detail"
code="$(http_code GET "$API_BASE/tasks/$task_id/detail")"
test "$code" = "200"

echo "12) POST /tasks/:id/recalculate-progress"
code="$(http_code POST "$API_BASE/tasks/$task_id/recalculate-progress")"
test "$code" = "201" || test "$code" = "200"

echo "13) DELETE /tasks/:id"
code="$(http_code DELETE "$API_BASE/tasks/$task_id")"
test "$code" = "200"

echo "OK"

