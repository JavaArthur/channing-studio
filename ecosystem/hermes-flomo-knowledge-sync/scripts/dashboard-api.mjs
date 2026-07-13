#!/usr/bin/env node

import { readFile } from 'node:fs/promises'

function option(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function required(value, message) {
  if (!value) throw new Error(message)
  return value
}

async function payloadFromFile() {
  const path = required(option('--payload'), '缺少 --payload 文件路径')
  return JSON.parse(await readFile(path, 'utf8'))
}

const command = process.argv[2]
const baseUrl = required(process.env.HERMES_DASHBOARD_URL, '缺少 HERMES_DASHBOARD_URL')
  .replace(/\/$/, '')
const token = required(process.env.HERMES_SYNC_TOKEN, '缺少 HERMES_SYNC_TOKEN')

let path
let method = 'GET'
let body

if (command === 'start') {
  path = '/api/agent/v1/runs'
  method = 'POST'
  body = await payloadFromFile()
} else if (command === 'state') {
  const startDate = required(option('--start-date'), '缺少 --start-date')
  const endDate = required(option('--end-date'), '缺少 --end-date')
  path = `/api/agent/v1/state?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`
} else if (command === 'complete' || command === 'fail') {
  const runId = required(option('--run-id'), '缺少 --run-id')
  path = `/api/agent/v1/runs/${encodeURIComponent(runId)}/${command}`
  method = 'POST'
  body = await payloadFromFile()
} else {
  throw new Error('命令必须是 start、state、complete 或 fail')
}

const response = await fetch(`${baseUrl}${path}`, {
  method,
  headers: {
    Authorization: `Bearer ${token}`,
    ...(body ? { 'Content-Type': 'application/json' } : {}),
  },
  body: body ? JSON.stringify(body) : undefined,
})

const text = await response.text()
if (!response.ok) {
  let message = `Dashboard API 返回 ${response.status}`
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed.error === 'string') message += `: ${parsed.error}`
  } catch {
    // Never echo an untrusted HTML response body.
  }
  throw new Error(message)
}

if (text) process.stdout.write(`${text}\n`)
