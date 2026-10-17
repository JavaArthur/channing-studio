#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
if [[ -z "${CF_CONFIG_PATH:-}" ]]; then
  echo "Set CF_CONFIG_PATH to the reviewed production config. Back up D1 and apply pending migrations separately before deploying." >&2
  exit 1
fi
CONFIG_PATH="$(bash "${SCRIPT_DIR}/cf-config.sh")"

cd "${REPO_ROOT}"

echo "==> using wrangler config: ${CONFIG_PATH}"
bash "${SCRIPT_DIR}/cf-validate-config.sh" "${CONFIG_PATH}"

rm -rf .next .open-next
npx opennextjs-cloudflare build

OPEN_NEXT_DEPLOY=true npx wrangler deploy -c "${CONFIG_PATH}"
