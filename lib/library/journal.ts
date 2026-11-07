export const journalTopics = { learning: '学习记录', reflection: '日复盘' } as const
export type JournalKind = keyof typeof journalTopics
export type JournalFilter = JournalKind | 'all'
export const journalTemplates: Record<JournalKind, string> = {
  learning: '## 今天学到什么\n\n\n\n## 我的理解与实践\n\n\n\n## 下一步\n\n',
  reflection: '## 今天的进展\n\n\n\n## 哪些做得好，哪些需要调整\n\n\n\n## 明天的一小步\n\n',
}
export function journalKind(topics: string[]): JournalKind | null {
  if (topics.includes(journalTopics.reflection)) return 'reflection'
  if (topics.includes(journalTopics.learning)) return 'learning'
  return null
}
export function journalDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
}
