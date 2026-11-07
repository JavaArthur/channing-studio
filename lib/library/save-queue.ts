import type { LibraryItem } from './types'
export type LibraryChanges = Partial<
  Pick<
    LibraryItem,
    | 'title'
    | 'content'
    | 'summary'
    | 'source_url'
    | 'saved_reason'
    | 'topics'
    | 'favorite'
    | 'archived'
    | 'decision_question'
  >
>
export type SaveStatus = 'saved' | 'pending' | 'saving' | 'error' | 'conflict'
export class LibrarySaveQueue {
  private base: LibraryItem
  private pending: LibraryChanges = {}
  private draftRevision: number | undefined
  private running: Promise<boolean> | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private listeners = new Set<() => void>()
  private composing = false
  snapshot: { item: LibraryItem; status: SaveStatus; error: string }
  constructor(
    item: LibraryItem,
    private persist: (revision: number, changes: LibraryChanges) => Promise<LibraryItem>,
    private delay = 800,
  ) {
    this.base = item
    this.snapshot = { item, status: 'saved', error: '' }
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  getSnapshot = () => this.snapshot
  private emit(status: SaveStatus, error = '') {
    this.snapshot = { item: { ...this.base, ...this.pending }, status, error }
    this.listeners.forEach((listener) => listener())
  }
  get dirty() {
    return Object.keys(this.pending).length > 0 || !!this.running
  }
  get draft() {
    return Object.keys(this.pending).length ? { revision: this.draftRevision ?? this.base.revision, changes: { ...this.pending } } : null
  }
  restoreDraft(draft: { revision: number; changes: LibraryChanges }) {
    if (this.dirty) return
    this.pending = { ...draft.changes }
    this.draftRevision = draft.revision
    for (const key of Object.keys(this.pending) as (keyof LibraryChanges)[]) {
      if (JSON.stringify(this.pending[key]) === JSON.stringify(this.base[key])) delete this.pending[key]
    }
    if (!Object.keys(this.pending).length) { this.draftRevision = undefined; this.emit('saved'); return }
    this.emit(draft.revision === this.base.revision ? 'error' : 'conflict',
      draft.revision === this.base.revision ? '已恢复未保存的草稿，请确认后重试保存。' : '已恢复本地草稿，服务端版本已变化，请比较后选择保留的内容。')
  }
  patch(changes: LibraryChanges) {
    this.pending = { ...this.pending, ...changes }
    if (!this.running)
      for (const key of Object.keys(this.pending) as (keyof LibraryChanges)[]) {
        if (JSON.stringify(this.pending[key]) === JSON.stringify(this.base[key]))
          delete this.pending[key]
      }
    const blocked = ['error', 'conflict'].includes(this.snapshot.status)
    this.emit(
      blocked ? this.snapshot.status : this.running ? 'saving' : this.dirty ? 'pending' : 'saved',
      this.snapshot.error,
    )
    clearTimeout(this.timer)
    if (!blocked && !this.composing && this.dirty)
      this.timer = setTimeout(() => {
        void this.flush()
      }, this.delay)
  }
  composition(active: boolean) {
    this.composing = active
    clearTimeout(this.timer)
    if (!active && this.dirty)
      this.timer = setTimeout(() => {
        void this.flush()
      }, this.delay)
  }
  async flush(): Promise<boolean> {
    clearTimeout(this.timer)
    if (this.running) return this.running
    if (['error', 'conflict'].includes(this.snapshot.status) || this.composing) return false
    if (!this.dirty) return true
    this.running = this.drain()
    const ok = await this.running
    this.running = null
    return ok
  }
  private async drain() {
    while (Object.keys(this.pending).length) {
      const sent = { ...this.pending }
      this.emit('saving')
      try {
        const saved = await this.persist(this.base.revision, sent)
        this.base = saved
        this.draftRevision = undefined
        for (const key of Object.keys(sent) as (keyof LibraryChanges)[]) {
          if (JSON.stringify(this.pending[key]) === JSON.stringify(sent[key]))
            delete this.pending[key]
        }
        this.emit(
          Object.keys(this.pending).length ? (this.composing ? 'pending' : 'saving') : 'saved',
        )
        if (this.composing && Object.keys(this.pending).length) return false
      } catch (error) {
        this.emit(
          (error as { status?: number }).status === 412 ? 'conflict' : 'error',
          error instanceof Error ? error.message : '保存失败',
        )
        return false
      }
    }
    return true
  }
  async retry() {
    if (this.snapshot.status === 'conflict') return false
    this.emit('pending')
    return this.flush()
  }
  accept(item: LibraryItem) {
    if (this.dirty) return
    this.base = item
    this.draftRevision = undefined
    this.emit('saved')
  }
  discard(item: LibraryItem) {
    this.pending = {}
    this.base = item
    this.draftRevision = undefined
    this.emit('saved')
  }
  dispose() {
    clearTimeout(this.timer)
  }
}
