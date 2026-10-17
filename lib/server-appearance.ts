import type { Theme } from '@/lib/appearance'

// Color preference is applied before paint in the browser; public HTML is shared.
export async function resolveRequestTheme(defaultTheme: Theme): Promise<Theme> { return defaultTheme }
