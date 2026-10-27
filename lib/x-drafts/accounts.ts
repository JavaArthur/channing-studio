export const X_ACCOUNTS = {
  'ai': 'AI Agent 开发',
  bg: '娱乐八卦闲聊',
} as const
export type XAccountId = keyof typeof X_ACCOUNTS
export const OPERATION_STATUSES = {
  pending: '待处理',
  posted: '已处理',
  discarded: '忽略',
} as const
export function polishPrompt(account: XAccountId, extra: string) {
  return [
    '润色这份准备发布到 X 的文案，保留事实与原意，不编造信息，不添加未经证实的细节。使用独立、自然的表达，不照搬来源或只替换同义词。保留不确定性，不把传闻写成确定事实。只返回文案。',
    account === 'ai'
      ? '面向 AI Agent 开发者，清晰准确、言之有物。'
      : '面向娱乐闲聊读者，自然口语、有自己的观点，不夸大传闻。',
    extra.trim() ? `补充要求：${extra.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}
