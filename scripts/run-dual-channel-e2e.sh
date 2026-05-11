#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$ROOT_DIR/apps/api"

cd "$ROOT_DIR"

echo "[dual-e2e] 1/5 prisma client generate"
pnpm exec prisma generate

echo "[dual-e2e] 2/5 check DATABASE_URL"
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[dual-e2e] ERROR: DATABASE_URL is not set."
  echo "[dual-e2e] Please export DATABASE_URL and ensure DB is reachable (docker compose up -d --build)."
  exit 2
fi

echo "[dual-e2e] 3/5 run To C flow e2e"
pnpm --filter api test:e2e -- --runInBand toc-flow.e2e-spec.ts

echo "[dual-e2e] 4/5 run To B flow e2e"
pnpm --filter api test:e2e -- --runInBand tob-flow.e2e-spec.ts

echo "[dual-e2e] 5/5 dual-channel regression passed"
