export type Database = D1Database
export function getDB(env: CloudflareEnv) { return env.DB }
// Compatibility hook for existing repositories. Schema changes run through migrations.
export async function ensureSchema(_db: Database): Promise<void> { void _db }
