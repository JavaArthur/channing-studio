import { KnowledgeDashboard } from '@/components/KnowledgeDashboard'
import { buildKnowledgeDashboard } from '@/lib/agent-knowledge/dashboard'
import { getKnowledgeDashboardData } from '@/lib/agent-knowledge/repository'
import { getAppCloudflareEnv } from '@/lib/cloudflare'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const env = await getAppCloudflareEnv()
  const db = env?.DB as D1Database | undefined
  const data = db
    ? await getKnowledgeDashboardData(db)
    : {
        latestRun: null,
        sourceItems: [],
        artifacts: [],
        weeklyMetrics: { checkedCount: 0, knowledgeCount: 0, publishedCount: 0 },
      }
  return <KnowledgeDashboard model={buildKnowledgeDashboard(data)} />
}
