// 统一远程抓取安全工具：SSRF 防护、逐跳重定向校验与流式响应体积上限

export class UnsafeRemoteUrlError extends Error {
  readonly status: number

  constructor(message: string, status = 403) {
    super(message)
    this.name = 'UnsafeRemoteUrlError'
    this.status = status
  }
}

export class PayloadTooLargeError extends Error {
  readonly status = 413

  constructor(message = '远程响应超过允许的大小限制') {
    super(message)
    this.name = 'PayloadTooLargeError'
  }
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

function isPrivateIpv4Octets(a: number, b: number, c: number, d: number): boolean {
  if (
    !Number.isInteger(a) || !Number.isInteger(b) || !Number.isInteger(c) || !Number.isInteger(d) ||
    a < 0 || a > 255 || b < 0 || b > 255 || c < 0 || c > 255 || d < 0 || d > 255
  ) {
    return true
  }

  if (a === 0) return true                          // 0.0.0.0/8 (this network)
  if (a === 10) return true                         // 10.0.0.0/8 (RFC1918)
  if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 (CGNAT RFC6598)
  if (a === 127) return true                        // 127.0.0.0/8 (loopback)
  if (a === 169 && b === 254) return true           // 169.254.0.0/16 (link-local / metadata)
  if (a === 172 && b >= 16 && b <= 31) return true  // 172.16.0.0/12 (RFC1918)
  if (a === 192 && b === 0 && c === 0) return true  // 192.0.0.0/24 (IETF protocol)
  if (a === 192 && b === 168) return true           // 192.168.0.0/16 (RFC1918)
  if (a === 198 && (b === 18 || b === 19)) return true // 198.18.0.0/15 (benchmarking)
  if (a >= 224) return true                         // 224.0.0.0/4+ (multicast & reserved)

  return false
}

function parseIpv4Dotted(host: string): [number, number, number, number] | null {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])]
}

function parseSingleIntIpv4(host: string): [number, number, number, number] | null {
  let num: number
  if (/^0x[0-9a-f]+$/i.test(host)) {
    num = Number.parseInt(host.slice(2), 16)
  } else if (/^\d+$/.test(host)) {
    num = Number.parseInt(host, 10)
  } else {
    return null
  }
  if (!Number.isSafeInteger(num) || num < 0 || num > 0xffffffff) return null
  return [
    (num >>> 24) & 0xff,
    (num >>> 16) & 0xff,
    (num >>> 8) & 0xff,
    num & 0xff,
  ]
}

export function isPrivateHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/\.+$/, '')
  if (!normalized) return true

  // localhost 及保留内网后缀
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal')
  ) {
    return true
  }

  // 去掉 IPv6 方括号
  const bare = normalized.startsWith('[') && normalized.endsWith(']')
    ? normalized.slice(1, -1)
    : normalized

  if (!bare) return true

  // 常规 IPv4 点分十进制
  const ipv4 = parseIpv4Dotted(bare)
  if (ipv4) {
    return isPrivateIpv4Octets(...ipv4)
  }

  // 单整数/十六进制 IPv4 表示（例如 2130706433 / 0x7f000001）
  const intIpv4 = parseSingleIntIpv4(bare)
  if (intIpv4) {
    return isPrivateIpv4Octets(...intIpv4)
  }

  // IPv6 检查
  if (bare.includes(':')) {
    if (
      bare === '::' ||
      bare === '::1' ||
      bare === '0:0:0:0:0:0:0:0' ||
      bare === '0:0:0:0:0:0:0:1'
    ) {
      return true
    }

    // fc00::/7 (ULA)
    if (/^f[cd][0-9a-f]{0,2}:/.test(bare)) return true
    // fe80::/10 (link-local)
    if (/^fe[89ab][0-9a-f]?:/.test(bare)) return true
    // ff00::/8 (multicast)
    if (/^ff[0-9a-f]{0,2}:/.test(bare)) return true

    // IPv4-mapped IPv6 点分形式：::ffff:127.0.0.1 或 0:0:0:0:0:ffff:127.0.0.1
    const mappedDotted = bare.match(/^(?:::ffff:|(?:0:){5}ffff:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
    if (mappedDotted) {
      const octets = parseIpv4Dotted(mappedDotted[1])
      return octets ? isPrivateIpv4Octets(...octets) : true
    }

    // IPv4-mapped IPv6 十六进制形式（WHATWG URL 规范化输出，如 ::ffff:7f00:1）
    const mappedHex = bare.match(/^(?:::ffff:|(?:0:){5}ffff:)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
    if (mappedHex) {
      const hi = Number.parseInt(mappedHex[1], 16)
      const lo = Number.parseInt(mappedHex[2], 16)
      return isPrivateIpv4Octets((hi >>> 8) & 0xff, hi & 0xff, (lo >>> 8) & 0xff, lo & 0xff)
    }

    // IPv4-compatible IPv6：::127.0.0.1
    const compatDotted = bare.match(/^::(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
    if (compatDotted) {
      const octets = parseIpv4Dotted(compatDotted[1])
      return octets ? isPrivateIpv4Octets(...octets) : true
    }
  }

  return false
}

export function assertSafeRemoteUrl(rawUrl: string): URL {
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    throw new UnsafeRemoteUrlError('URL 不能为空', 400)
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new UnsafeRemoteUrlError('URL 格式不正确', 400)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UnsafeRemoteUrlError('仅支持 http/https 协议', 400)
  }

  if (parsed.username || parsed.password) {
    throw new UnsafeRemoteUrlError('不允许包含认证信息的 URL', 400)
  }

  if (isPrivateHost(parsed.hostname)) {
    throw new UnsafeRemoteUrlError('不允许访问内网地址', 403)
  }

  return parsed
}

export async function safeFetchWithRedirects(
  url: URL,
  init: RequestInit = {},
  maxRedirects = 4,
): Promise<Response> {
  let currentUrl = assertSafeRemoteUrl(url.toString())

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const resp = await fetch(currentUrl.toString(), {
      ...init,
      redirect: 'manual',
    })

    if (!REDIRECT_STATUSES.has(resp.status)) {
      return resp
    }

    const location = resp.headers.get('location')
    await resp.body?.cancel().catch(() => {})

    if (!location) {
      return resp
    }

    if (hop >= maxRedirects) {
      throw new UnsafeRemoteUrlError('重定向次数过多', 502)
    }

    let nextRawUrl: string
    try {
      nextRawUrl = new URL(location, currentUrl).toString()
    } catch {
      throw new UnsafeRemoteUrlError('重定向目标地址无效', 502)
    }

    currentUrl = assertSafeRemoteUrl(nextRawUrl)
  }

  throw new UnsafeRemoteUrlError('重定向次数过多', 502)
}

export async function readTextUpToBytes(resp: Response, maxBytes: number): Promise<string> {
  if (maxBytes <= 0) {
    await resp.body?.cancel().catch(() => {})
    return ''
  }

  if (!resp.body) {
    const text = await resp.text()
    const bytes = new TextEncoder().encode(text)
    if (bytes.byteLength <= maxBytes) return text
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, maxBytes))
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: false })
  let received = 0
  let result = ''

  try {
    while (received < maxBytes) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.byteLength === 0) continue

      const remaining = maxBytes - received
      if (value.byteLength >= remaining) {
        result += decoder.decode(value.subarray(0, remaining), { stream: false })
        received = maxBytes
        await reader.cancel().catch(() => {})
        return result
      }

      result += decoder.decode(value, { stream: true })
      received += value.byteLength
    }

    result += decoder.decode()
    return result
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // ignore if stream was already cancelled/released
    }
  }
}

export async function readBytesUpToLimit(resp: Response, maxBytes: number): Promise<Uint8Array> {
  const contentLengthHeader = resp.headers.get('content-length')
  if (contentLengthHeader) {
    const declared = Number(contentLengthHeader)
    if (Number.isFinite(declared) && declared > maxBytes) {
      await resp.body?.cancel().catch(() => {})
      throw new PayloadTooLargeError()
    }
  }

  if (!resp.body) {
    const buffer = await resp.arrayBuffer()
    if (buffer.byteLength > maxBytes) {
      throw new PayloadTooLargeError()
    }
    return new Uint8Array(buffer)
  }

  const reader = resp.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.byteLength === 0) continue

      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => {})
        throw new PayloadTooLargeError()
      }

      chunks.push(value)
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // ignore if stream was already cancelled/released
    }
  }

  const combined = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return combined
}
