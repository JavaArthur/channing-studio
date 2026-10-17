export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
  } catch {
    return false
  }
}
export function isSafeLink(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    ((value.startsWith('/') && !value.startsWith('//') && !/[\\\u0000-\u0020]/.test(value)) ||
      isHttpUrl(value))
  )
}
