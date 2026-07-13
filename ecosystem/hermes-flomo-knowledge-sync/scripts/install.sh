#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${HOME}/.openclaw/workspace/skills/hermes-flomo-knowledge-sync"
MARKER_FILE="${TARGET_DIR}/.installed-from-chen-blog"

mkdir -p "$(dirname "$TARGET_DIR")"

if [[ -L "$TARGET_DIR" ]]; then
  rm "$TARGET_DIR"
elif [[ -e "$TARGET_DIR" && ! -f "$MARKER_FILE" ]]; then
  echo "安装目标已存在且不是本安装器管理的目录：$TARGET_DIR" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"
cp -R "$SOURCE_DIR"/. "$TARGET_DIR"/
printf '%s\n' "$SOURCE_DIR" > "$MARKER_FILE"

echo "已安装 skill：$TARGET_DIR"

if ! command -v openclaw >/dev/null 2>&1; then
  echo "未找到 openclaw，无法校验 Skill 或注册定时任务" >&2
  exit 1
fi

openclaw skills check >/dev/null
openclaw skills info hermes-flomo-knowledge-sync >/dev/null

if [[ "${HERMES_SKIP_CRON_INSTALL:-0}" == "1" ]]; then
  echo "已跳过 cron 注册（HERMES_SKIP_CRON_INSTALL=1）"
  exit 0
fi

CRON_JOBS_JSON="$(openclaw cron list --all --json)"

cron_exists() {
  local name="$1"
  CRON_JOBS_JSON="$CRON_JOBS_JSON" CRON_JOB_NAME="$name" node -e '
    const value = JSON.parse(process.env.CRON_JOBS_JSON)
    process.exit(value.jobs?.some((job) => job.name === process.env.CRON_JOB_NAME) ? 0 : 1)
  '
}

register_cron() {
  local name="$1"
  shift
  if cron_exists "$name"; then
    echo "cron 已存在，跳过：$name"
    return
  fi
  openclaw cron add --name "$name" "$@" >/dev/null
  echo "已创建禁用态 cron：$name"
}

register_cron hermes-flomo-hourly \
  --description "每小时扫描 Flomo 新增或修改内容，仅登记筛选结果" \
  --agent main --session isolated --light-context --no-deliver --disabled --exact \
  --cron "17 * * * *" --tz Asia/Shanghai --timeout-seconds 600 \
  --message "Use \$hermes-flomo-knowledge-sync in hourly mode. Scan today and yesterday, deduplicate against dashboard state, never write chen-notes, and complete or fail the dashboard run accurately."

register_cron hermes-flomo-nightly \
  --description "夜间严格沉淀候选到 chen-notes，并回传成果投影" \
  --agent main --session isolated --light-context --no-deliver --disabled --exact \
  --cron "40 22 * * *" --tz Asia/Shanghai --timeout-seconds 1800 \
  --message "Use \$hermes-flomo-knowledge-sync in nightly mode. Re-read pending candidates, enforce chen-notes Git and readback gates, push before reporting synchronized artifacts, and preserve a valid no-op when nothing clears the threshold."

register_cron hermes-flomo-reconcile \
  --description "每周逐日重扫最近 30 天并识别旧 Memo 修改" \
  --agent main --session isolated --light-context --no-deliver --disabled --exact \
  --cron "10 23 * * 0" --tz Asia/Shanghai --timeout-seconds 3600 \
  --message "Use \$hermes-flomo-knowledge-sync in reconcile mode. Scan the latest 30 Shanghai calendar days one day at a time, stop on any 50-item saturated day, retain artifacts for unavailable memos, and never claim incomplete coverage as complete."

echo "三个 cron 均保持禁用；轮换 Flomo Token 并手动验收后再启用"
