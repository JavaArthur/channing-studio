import { afterEach, describe, expect, it, vi } from 'vitest'
import { LibrarySaveQueue } from '@/lib/library/save-queue'
import type { LibraryItem } from '@/lib/library/types'
const item = {
  kind: 'note',
  id: 'test',
  title: '标题',
  content: 'initial',
  summary: '',
  topics: [],
  revision: 1,
} as unknown as LibraryItem
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
afterEach(() => vi.useRealTimers())
describe('private autosave queue', () => {
  it('does not write on mount or unchanged input; debounces typing and respects Chinese composition', async () => {
    vi.useFakeTimers()
    const save = vi.fn(async (revision, changes) => ({
      ...item,
      ...changes,
      revision: revision + 1,
    }))
    const queue = new LibrarySaveQueue(item, save)
    queue.patch({ content: 'initial' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).not.toHaveBeenCalled()
    queue.composition(true)
    queue.patch({ content: '中' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).not.toHaveBeenCalled()
    queue.patch({ content: '中文输入完成' })
    queue.composition(false)
    await vi.advanceTimersByTimeAsync(799)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledExactlyOnceWith(1, { content: '中文输入完成' })
    expect(queue.snapshot.status).toBe('saved')
    queue.dispose()
  })
  it('serializes requests, coalesces changes during a slow save and uses the returned revision', async () => {
    let release!: (item: LibraryItem) => void
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<LibraryItem>((resolve) => {
            release = resolve
          }),
      )
      .mockImplementationOnce(async (revision, changes) => ({
        ...item,
        ...changes,
        revision: revision + 1,
      }))
    const queue = new LibrarySaveQueue(item, save)
    queue.patch({ content: 'one' })
    const flushed = queue.flush()
    queue.patch({ content: 'two', summary: 'new summary' })
    queue.patch({ content: 'three' })
    expect(save).toHaveBeenCalledTimes(1)
    release({ ...item, content: 'one', revision: 8 })
    expect(await flushed).toBe(true)
    expect(save).toHaveBeenNthCalledWith(2, 8, { content: 'three', summary: 'new summary' })
    expect(queue.snapshot.item.content).toBe('three')
    expect(queue.dirty).toBe(false)
    queue.dispose()
  })
  it('retains edits after network failure and blocks navigation until an explicit retry succeeds', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(async (revision, changes) => ({
        ...item,
        ...changes,
        revision: revision + 1,
      }))
    const queue = new LibrarySaveQueue(item, save)
    queue.patch({ content: 'local' })
    expect(await queue.flush()).toBe(false)
    queue.patch({ summary: 'while offline' })
    expect(await queue.flush()).toBe(false)
    expect(save).toHaveBeenCalledTimes(1)
    expect(queue.snapshot.item.content).toBe('local')
    expect(await queue.retry()).toBe(true)
    expect(queue.snapshot.item.summary).toBe('while offline')
    queue.dispose()
  })
  it('never retries a conflict against the new server revision or overwrites local edits on refresh', async () => {
    const save = vi.fn().mockRejectedValue(Object.assign(new Error('conflict'), { status: 412 }))
    const queue = new LibrarySaveQueue(item, save)
    queue.patch({ content: 'local' })
    await queue.flush()
    queue.accept({ ...item, content: 'agent', revision: 4 })
    expect(queue.snapshot.status).toBe('conflict')
    expect(queue.snapshot.item.content).toBe('local')
    expect(await queue.retry()).toBe(false)
    expect(save).toHaveBeenCalledTimes(1)
    queue.discard({ ...item, content: 'agent', revision: 4 })
    expect(queue.snapshot.item.content).toBe('agent')
    expect(queue.dirty).toBe(false)
    queue.dispose()
  })
  it('saves a reversal made while the first value is in flight', async () => {
    let release!: (item: LibraryItem) => void
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<LibraryItem>((resolve) => {
            release = resolve
          }),
      )
      .mockImplementationOnce(async (revision, changes) => ({
        ...item,
        ...changes,
        revision: revision + 1,
      }))
    const queue = new LibrarySaveQueue(item, save)
    queue.patch({ content: 'changed' })
    const saving = queue.flush()
    queue.patch({ content: 'initial' })
    release({ ...item, content: 'changed', revision: 2 })
    await saving
    await tick()
    expect(save).toHaveBeenNthCalledWith(2, 2, { content: 'initial' })
    expect(queue.snapshot.item.content).toBe('initial')
    queue.dispose()
  })
})
it('pauses queued input when composition begins during an existing save', async () => {
  let release!: (item: LibraryItem) => void
  const save = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<LibraryItem>((resolve) => {
          release = resolve
        }),
    )
    .mockImplementationOnce(async (revision, changes) => ({
      ...item,
      ...changes,
      revision: revision + 1,
    }))
  const queue = new LibrarySaveQueue(item, save)
  queue.patch({ content: 'committed' })
  const saving = queue.flush()
  queue.composition(true)
  queue.patch({ content: '正在组合' })
  release({ ...item, content: 'committed', revision: 2 })
  await saving
  expect(save).toHaveBeenCalledTimes(1)
  expect(queue.snapshot.status).toBe('pending')
  queue.composition(false)
  await queue.flush()
  expect(save).toHaveBeenCalledTimes(2)
  queue.dispose()
})
