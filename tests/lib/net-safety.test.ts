import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertSafeRemoteUrl,
  isPrivateHost,
  PayloadTooLargeError,
  readBytesUpToLimit,
  readTextUpToBytes,
  safeFetchWithRedirects,
  UnsafeRemoteUrlError,
} from '@/lib/net-safety'

describe('net-safety SSRF protection, redirects, and stream caps', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('identifies private, loopback, link-local, CGNAT, and IPv6-mapped hosts', () => {
    const blocked = [
      'localhost',
      'sub.localhost',
      'localhost.',
      'printer.local',
      'metadata.google.internal',
      '127.0.0.1',
      '127.255.255.254',
      '10.0.0.1',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.0.1',
      '169.254.169.254',
      '100.64.0.1',
      '100.127.255.254',
      '0.0.0.0',
      '224.0.0.1',
      '2130706433',
      '0x7f000001',
      '[::1]',
      '::1',
      '[::]',
      '[fc00::1]',
      '[fd12:3456:789a::1]',
      '[fe80::1]',
      '[::ffff:127.0.0.1]',
      '[::ffff:7f00:1]',
      '[::ffff:a9fe:a9fe]',
      '[::ffff:6440:1]',
    ]

    for (const host of blocked) {
      expect(isPrivateHost(host), `expected ${host} to be blocked`).toBe(true)
    }

    const allowed = [
      'example.com',
      'github.com',
      '1.1.1.1',
      '8.8.8.8',
      '100.63.255.255',
      '100.128.0.1',
      '172.15.255.255',
      '172.32.0.1',
      '[2606:4700:4700::1111]',
    ]

    for (const host of allowed) {
      expect(isPrivateHost(host), `expected ${host} to be allowed`).toBe(false)
    }
  })

  it('assertSafeRemoteUrl enforces protocol, rejects credentials and private targets', () => {
    expect(assertSafeRemoteUrl('https://github.com/vercel/next.js').hostname).toBe('github.com')

    expect(() => assertSafeRemoteUrl('file:///etc/passwd')).toThrow(UnsafeRemoteUrlError)
    expect(() => assertSafeRemoteUrl('ftp://example.com/file')).toThrow(UnsafeRemoteUrlError)
    expect(() => assertSafeRemoteUrl('https://user:pass@example.com/path')).toThrow(UnsafeRemoteUrlError)
    expect(() => assertSafeRemoteUrl('http://127.0.0.1:8080/')).toThrow(UnsafeRemoteUrlError)
    expect(() => assertSafeRemoteUrl('http://100.64.1.1/')).toThrow(UnsafeRemoteUrlError)
    expect(() => assertSafeRemoteUrl('http://[::ffff:127.0.0.1]/')).toThrow(UnsafeRemoteUrlError)
    expect(() => assertSafeRemoteUrl('http://169.254.169.254/latest/meta-data/')).toThrow(UnsafeRemoteUrlError)
  })

  it('safeFetchWithRedirects manually validates every redirect hop and blocks SSRF pivots', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { location: 'https://cdn.example.com/final' },
      }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))

    vi.stubGlobal('fetch', fetchMock)

    const resp = await safeFetchWithRedirects(new URL('https://example.com/start'))
    expect(resp.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' })
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://cdn.example.com/final')
  })

  it('safeFetchWithRedirects rejects redirects targeting internal networks or exceeding hop cap', async () => {
    const ssrfFetch = vi.fn().mockResolvedValueOnce(new Response(null, {
      status: 302,
      headers: { location: 'http://169.254.169.254/latest/meta-data/' },
    }))
    vi.stubGlobal('fetch', ssrfFetch)

    await expect(safeFetchWithRedirects(new URL('https://example.com/start'))).rejects.toThrow(UnsafeRemoteUrlError)
    expect(ssrfFetch).toHaveBeenCalledTimes(1)

    const loopFetch = vi.fn().mockImplementation(async () => new Response(null, {
      status: 302,
      headers: { location: 'https://example.com/loop' },
    }))
    vi.stubGlobal('fetch', loopFetch)

    await expect(safeFetchWithRedirects(new URL('https://example.com/loop'), {}, 2)).rejects.toThrow('重定向次数过多')
    expect(loopFetch).toHaveBeenCalledTimes(3)
  })

  it('readTextUpToBytes cancels the stream once the byte cap is reached', async () => {
    let pulls = 0
    let cancelled = false
    const chunk = new TextEncoder().encode('a'.repeat(1024))

    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1
        controller.enqueue(chunk)
      },
      cancel() {
        cancelled = true
      },
    })

    const resp = new Response(stream)
    const text = await readTextUpToBytes(resp, 2500)

    expect(text.length).toBe(2500)
    expect(cancelled).toBe(true)
    expect(pulls).toBeLessThanOrEqual(4)
  })

  it('readBytesUpToLimit rejects oversized streams without buffering everything', async () => {
    let cancelled = false
    const chunk = new Uint8Array(1024)

    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(chunk)
      },
      cancel() {
        cancelled = true
      },
    })

    const resp = new Response(stream)
    await expect(readBytesUpToLimit(resp, 2048)).rejects.toThrow(PayloadTooLargeError)
    expect(cancelled).toBe(true)

    const headerTooBig = new Response('tiny', { headers: { 'content-length': '99999999' } })
    await expect(readBytesUpToLimit(headerTooBig, 1024)).rejects.toThrow(PayloadTooLargeError)
  })
})
