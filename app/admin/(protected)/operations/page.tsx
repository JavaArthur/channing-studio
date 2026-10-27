import { notFound, redirect } from 'next/navigation'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { BrainApiError } from '@/lib/agent-brain/validation'
import { getXDraft, listXDrafts } from '@/lib/repositories/x-drafts'
import { X_ACCOUNTS, OPERATION_STATUSES, type XAccountId } from '@/lib/x-drafts/accounts'
import { OperationsBoard } from '@/components/operations/OperationsBoard'
import type { LibraryParams } from '@/components/library/LibraryPage'
export const dynamic = 'force-dynamic'
export default async function Page({ searchParams }: { searchParams: Promise<LibraryParams> }) {
  const params = await searchParams
  const value = (key: string) => (typeof params[key] === 'string' ? params[key] : '')
  const account = Object.hasOwn(X_ACCOUNTS, value('account_id'))
    ? (value('account_id') as XAccountId)
    : 'ai'
  const status = Object.hasOwn(OPERATION_STATUSES, value('status'))
    ? (value('status') as keyof typeof OPERATION_STATUSES)
    : 'pending'
  const q = value('q').slice(0, 200)
  const page = Math.max(1, Math.min(10000, Number.parseInt(value('page')) || 1))
  const env = await getAppCloudflareEnv()
  if (!env.DB) return <p role="alert">数据库未连接，请检查环境配置。</p>
  let selected = null
  if (value('item')) {
    try {
      selected = await getXDraft(env.DB, value('item'))
    } catch (error) {
      if (error instanceof BrainApiError && [400, 404].includes(error.status)) notFound()
      throw error
    }
    // Old links carry only an ID. Resolve its account and status before rendering the workspace.
    if (value('account_id') !== selected.account_id || status !== selected.status) {
      redirect(
        `/admin/operations?${new URLSearchParams({ account_id: selected.account_id, status: selected.status, item: selected.id, ...(q ? { q } : {}) })}`,
      )
    }
  }
  const data = await listXDrafts(env.DB, { account_id: account, status, q, page })
  return (
    <OperationsBoard {...data} account={account} status={status} query={q} selected={selected} />
  )
}
