import { NextRequest, NextResponse } from 'next/server'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { authenticateRequest } from '@/lib/admin-auth'
import { nanoid } from 'nanoid'
import { readFlag, sanitizeFilename, buildAssetUrls, type RuntimeEnv } from '@/lib/upload-utils'
import {
  assertSafeRemoteUrl,
  PayloadTooLargeError,
  readBytesUpToLimit,
  safeFetchWithRedirects,
  UnsafeRemoteUrlError,
} from '@/lib/net-safety'

const MAX_IMAGE_SIZE = 25 * 1024 * 1024 // 25MB — remote fetch to R2
const FETCH_TIMEOUT_MS = 15_000

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/avif',
]

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

function extractFilenameFromUrl(url: URL): string {
  const last = url.pathname.split('/').pop() || 'image'
  const clean = last.split('?')[0].split('#')[0]
  return clean || 'image'
}

function inferContentType(rawType: string | null, url: URL): string | null {
  const normalized = (rawType || '').toLowerCase().split(';')[0].trim()
  if (normalized && ALLOWED_IMAGE_TYPES.includes(normalized)) return normalized

  const name = extractFilenameFromUrl(url)
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (ext && EXT_TO_MIME[ext]) return EXT_TO_MIME[ext]
  return null
}

export async function POST(req: NextRequest) {
  try {
    const env = (await getAppCloudflareEnv()) as RuntimeEnv
    const isAuthenticated = await authenticateRequest(req, env?.DB)

    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!env?.IMAGES) {
      return NextResponse.json(
        { error: '图片存储未配置，请用 Cloudflare preview/runtime 启动。' },
        { status: 500 }
      )
    }

    const body = await req.json().catch(() => null) as { url?: unknown } | null
    const rawUrl = typeof body?.url === 'string' ? body.url.trim() : ''

    if (!rawUrl) {
      return NextResponse.json({ error: '缺少 url' }, { status: 400 })
    }

    let sourceUrl: URL
    try {
      sourceUrl = assertSafeRemoteUrl(rawUrl)
    } catch (err) {
      if (err instanceof UnsafeRemoteUrlError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      return NextResponse.json({ error: 'url 格式非法' }, { status: 400 })
    }

    // Fetch without Referer to bypass hotlink-protection; no cookies.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    let remote: Response
    let buffer: ArrayBuffer
    let contentType: string | null
    try {
      try {
        remote = await safeFetchWithRedirects(sourceUrl, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; MorningAIBlogBot/1.0)',
            'Accept': 'image/*;q=0.95,*/*;q=0.1',
          },
        })
      } catch (err) {
        if (err instanceof UnsafeRemoteUrlError) {
          return NextResponse.json({ error: err.message }, { status: err.status })
        }
        const message = err instanceof Error && err.name === 'AbortError' ? '远程拉取超时' : '远程拉取失败'
        return NextResponse.json({ error: message }, { status: 502 })
      }

      if (!remote.ok) {
        await remote.body?.cancel().catch(() => {})
        return NextResponse.json(
          { error: `远程返回 ${remote.status}` },
          { status: 502 }
        )
      }

      contentType = inferContentType(remote.headers.get('content-type'), sourceUrl)
      if (!contentType) {
        await remote.body?.cancel().catch(() => {})
        return NextResponse.json({ error: '不支持的图片类型' }, { status: 415 })
      }

      try {
        const bytes = await readBytesUpToLimit(remote, MAX_IMAGE_SIZE)
        buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
      } catch (err) {
        if (err instanceof PayloadTooLargeError) {
          return NextResponse.json({ error: '图片超过 25MB 限制' }, { status: 413 })
        }
        const message = err instanceof Error && err.name === 'AbortError' ? '远程拉取超时' : '远程拉取失败'
        return NextResponse.json({ error: message }, { status: 502 })
      }
    } finally {
      clearTimeout(timer)
    }

    if (buffer.byteLength === 0) {
      return NextResponse.json({ error: '远程内容为空' }, { status: 502 })
    }

    const now = new Date()
    const yyyy = now.getUTCFullYear()
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
    const cloudflareImagePipeline = readFlag(env.ENABLE_CF_IMAGE_PIPELINE)

    const originalName = extractFilenameFromUrl(sourceUrl)
    const fileHash = await sha256Hex(buffer)
    const safeName = sanitizeFilename(originalName)
    const dedupKey = `image/${yyyy}/${mm}/${fileHash}-${safeName}`

    const existing = await env.IMAGES.get(dedupKey)
    if (existing) {
      const encodedKey = dedupKey.split('/').map(encodeURIComponent).join('/')
      return NextResponse.json({
        success: true,
        key: dedupKey,
        url: `/api/images/${encodedKey}`,
        type: 'image',
        name: originalName,
        size: buffer.byteLength,
        deduplicated: true,
        sourceUrl: sourceUrl.toString(),
        delivery: cloudflareImagePipeline ? 'cloudflare' : 'origin',
        variants: buildAssetUrls(encodedKey, cloudflareImagePipeline),
      })
    }

    // Fallback if hash collided with unusual filename — append nanoid.
    const key = dedupKey || `image/${yyyy}/${mm}/${nanoid(10)}-${safeName}`

    await env.IMAGES.put(key, buffer, {
      httpMetadata: {
        contentType,
        cacheControl: 'public, max-age=31536000, immutable',
      },
      customMetadata: {
        originalName,
        sourceUrl: sourceUrl.toString(),
        importedAt: now.toISOString(),
      },
    })

    const encodedKey = key.split('/').map(encodeURIComponent).join('/')
    return NextResponse.json({
      success: true,
      key,
      url: `/api/images/${encodedKey}`,
      type: 'image',
      name: originalName,
      size: buffer.byteLength,
      sourceUrl: sourceUrl.toString(),
      delivery: cloudflareImagePipeline ? 'cloudflare' : 'origin',
      variants: buildAssetUrls(encodedKey, cloudflareImagePipeline),
    })
  } catch (error) {
    console.error('Import from URL error:', error)
    return NextResponse.json(
      { error: '远程图片导入失败' },
      { status: 500 }
    )
  }
}
