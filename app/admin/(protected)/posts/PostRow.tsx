'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Eye,
  Link2,
  Edit,
  Pin,
  PinOff,
  EyeOff,
  Eye as EyeIcon,
  Lock,
  Unlock,
  Check,
  FileText,
  Trash2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import { Tooltip } from '@/components/Tooltip'
import { Modal } from '@/components/Modal'
import { PasswordModal } from '@/components/PasswordModal'
import { Dropdown } from '@/components/Dropdown'
import type { PostWithTags } from '@/lib/db'
import { getSiteUrl } from '@/lib/site-config'

interface PostRowProps {
  post: PostWithTags
  categories: string[]
}

function formatDate(ts: number) {
  const date = new Date(ts * 1000)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays}天前`

  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Shanghai',
  })
}

export function PostRow({ post, categories }: PostRowProps) {
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showPermanentModal, setShowPermanentModal] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [showHiddenModal, setShowHiddenModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [loading, setLoading] = useState(false)

  const router = useRouter()
  const toast = useToast()

  const siteUrl = getSiteUrl()
  const baseArticleUrl = `${siteUrl}/${post.slug}`
  const articleUrl = post.password ? `${baseArticleUrl}?pwd=${post.password}` : baseArticleUrl

  const isDeleted = post.status === 'deleted'

  const categoryOptions = [
    { value: '', label: '未分类' },
    ...categories.map((cat) => ({ value: cat, label: cat })),
  ]

  const handleView = () => {
    window.open(articleUrl, '_blank')
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(articleUrl)
      toast.success(post.password ? '已复制带密码的链接' : '已复制链接')
    } catch {
      toast.error('复制失败')
    }
  }

  const handleCategoryChange = async (newCategory: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/posts/${post.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory || null }),
      })
      if (res.ok) {
        toast.success('分类已更新')
        router.refresh()
      } else {
        toast.error('更新失败')
      }
    } catch {
      toast.error('网络错误')
    } finally {
      setLoading(false)
    }
  }

  const handlePinToggle = async () => {
    setLoading(true)
    const newPinned = post.is_pinned === 1 ? 0 : 1
    try {
      const res = await fetch(`/api/admin/posts/${post.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: newPinned }),
      })
      if (res.ok) {
        toast.success(newPinned === 1 ? '已置顶' : '已取消置顶')
        setShowPinModal(false)
        router.refresh()
        return true
      } else {
        toast.error('操作失败')
        return false
      }
    } catch {
      toast.error('网络错误')
      return false
    } finally {
      setLoading(false)
    }
  }

  const handleHiddenToggle = async () => {
    setLoading(true)
    const newHidden = post.is_hidden === 1 ? 0 : 1
    try {
      const res = await fetch(`/api/admin/posts/${post.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_hidden: newHidden }),
      })
      if (res.ok) {
        toast.success(newHidden === 1 ? '已隐藏' : '已取消隐藏')
        setShowHiddenModal(false)
        router.refresh()
        return true
      } else {
        toast.error('操作失败')
        return false
      }
    } catch {
      toast.error('网络错误')
      return false
    } finally {
      setLoading(false)
    }
  }

  const handleStatusToggle = async () => {
    setLoading(true)
    const newStatus = post.status === 'published' ? 'draft' : 'published'
    try {
      const res = await fetch(`/api/admin/posts/${post.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        toast.success(newStatus === 'published' ? '已发布' : '已转为草稿')
        setShowStatusModal(false)
        router.refresh()
        return true
      } else {
        toast.error('操作失败')
        return false
      }
    } catch {
      toast.error('网络错误')
      return false
    } finally {
      setLoading(false)
    }
  }

  const handleSoftDelete = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/posts/${post.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'deleted' }),
      })
      if (res.ok) {
        toast.success('已删除（可恢复）')
        setShowDeleteModal(false)
        router.refresh()
        return true
      } else {
        toast.error('删除失败')
        return false
      }
    } catch {
      toast.error('网络错误')
      return false
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/posts/${post.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft' }),
      })
      if (res.ok) {
        toast.success('已恢复为草稿')
        router.refresh()
      } else {
        toast.error('恢复失败')
      }
    } catch {
      toast.error('网络错误')
    } finally {
      setLoading(false)
    }
  }

  const handlePermanentDelete = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/posts/${post.slug}`, { method: 'DELETE' })

      let data: { success?: boolean; error?: string }
      try {
        data = (await res.json()) as { success?: boolean; error?: string }
      } catch {
        toast.error(`删除失败: HTTP ${res.status}`)
        return false
      }

      if (res.ok && data.success) {
        toast.success('已永久删除')
        setShowPermanentModal(false)
        router.refresh()
        return true
      } else {
        toast.error(data.error || `删除失败 (${res.status})`)
        return false
      }
    } catch (err) {
      console.error('Delete error:', err)
      toast.error(`网络错误: ${err instanceof Error ? err.message : '未知'}`)
      return false
    } finally {
      setLoading(false)
    }
  }

  const statusDotClass =
    post.status === 'published'
      ? 'bg-[var(--success)]'
      : post.status === 'deleted'
        ? 'bg-[var(--danger)]'
        : 'bg-[var(--warning)]'

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden grid-cols-[54px_1fr_160px_96px_268px] items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--editor-soft)]/60 md:grid">
        {/* 状态列 */}
        <div className="flex flex-col items-center gap-1.5">
          <Tooltip
            label={
              post.status === 'published'
                ? '已发布'
                : post.status === 'deleted'
                  ? '已删除'
                  : '草稿'
            }
          >
            <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
          </Tooltip>
          <div className="flex items-center gap-1">
            {post.is_pinned === 1 && <Pin className="h-3 w-3 text-[var(--atelier-vermilion)]" />}
            {post.password && <Lock className="h-3 w-3 text-[var(--stone-gray)]" />}
            {post.is_hidden === 1 && <EyeOff className="h-3 w-3 text-[var(--stone-gray)]" />}
          </div>
        </div>

        {/* 标题列 */}
        <div className="min-w-0">
          <Link
            href={`/editor?edit=${post.slug}`}
            className="min-h-11 min-w-11 line-clamp-1 flex items-center font-medium text-[var(--editor-ink)] transition-colors hover:text-[var(--atelier-vermilion)]"
          >
            {post.title}
          </Link>
          {post.description && (
            <p className="mt-0.5 line-clamp-1 text-xs leading-relaxed text-[var(--editor-muted)]">
              {post.description}
            </p>
          )}
        </div>

        {/* 分类列 */}
        <div className="flex min-w-0 items-center">
          <Dropdown
            options={categoryOptions}
            value={post.category || ''}
            onChange={handleCategoryChange}
            placeholder="未分类"
            className="w-full [&_button]:whitespace-nowrap [&_button>span]:truncate [&_button>svg]:shrink-0"
            disabled={loading || isDeleted}
          />
        </div>

        {/* 阅读/日期列 */}
        <div className="atelier-mono flex flex-col items-center justify-center text-xs">
          <span className="font-medium text-[var(--editor-ink)]">
            {post.view_count.toLocaleString()}
          </span>
          <span className="text-[11px] text-[var(--stone-gray)]">
            {formatDate(post.published_at)}
          </span>
        </div>

        {/* 操作列 */}
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
          {isDeleted ? (
            <>
              <Tooltip label="恢复为草稿">
                <button
                  onClick={handleRestore}
                  disabled={loading}
                  className="min-h-11 min-w-11 rounded-[var(--radius-xs)] p-1.5 transition-colors hover:bg-[var(--editor-soft)] disabled:opacity-50"
                  aria-label="恢复为草稿"
                >
                  <Check className="h-4 w-4 text-[var(--success)]" />
                </button>
              </Tooltip>
              <Tooltip label="永久删除">
                <button
                  onClick={() => setShowPermanentModal(true)}
                  disabled={loading}
                  className="min-h-11 min-w-11 rounded-[var(--radius-xs)] p-1.5 transition-colors hover:bg-[var(--editor-soft)] disabled:opacity-50"
                  aria-label="永久删除"
                >
                  <Trash2 className="h-4 w-4 text-[var(--danger)]" />
                </button>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip label="查看文章">
                <button
                  onClick={handleView}
                  className="min-h-11 min-w-11 rounded-[var(--radius-xs)] p-1.5 transition-colors hover:bg-[var(--editor-soft)]"
                  aria-label="查看文章"
                >
                  <Eye className="h-4 w-4 text-[var(--stone-gray)]" />
                </button>
              </Tooltip>
              <Tooltip label="复制链接">
                <button
                  onClick={handleCopyLink}
                  className="min-h-11 min-w-11 rounded-[var(--radius-xs)] p-1.5 transition-colors hover:bg-[var(--editor-soft)]"
                  aria-label="复制链接"
                >
                  <Link2 className="h-4 w-4 text-[var(--stone-gray)]" />
                </button>
              </Tooltip>
              <Tooltip label="编辑文章">
                <Link
                  href={`/editor?edit=${post.slug}`}
                  className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-[var(--radius-xs)] p-1.5 transition-colors hover:bg-[var(--editor-soft)]"
                  aria-label="编辑文章"
                >
                  <Edit className="h-4 w-4 text-[var(--stone-gray)]" />
                </Link>
              </Tooltip>
              <Tooltip label={post.is_pinned === 1 ? '取消置顶' : '置顶文章'}>
                <button
                  onClick={() => setShowPinModal(true)}
                  disabled={loading}
                  className="min-h-11 min-w-11 rounded-[var(--radius-xs)] p-1.5 transition-colors hover:bg-[var(--editor-soft)] disabled:opacity-50"
                  aria-label={post.is_pinned === 1 ? '取消置顶' : '置顶文章'}
                >
                  {post.is_pinned === 1 ? (
                    <PinOff className="h-4 w-4 text-[var(--atelier-vermilion)]" />
                  ) : (
                    <Pin className="h-4 w-4 text-[var(--stone-gray)]" />
                  )}
                </button>
              </Tooltip>
              <Tooltip label={post.is_hidden === 1 ? '取消隐藏' : '隐藏文章'}>
                <button
                  onClick={() => setShowHiddenModal(true)}
                  disabled={loading}
                  className="min-h-11 min-w-11 rounded-[var(--radius-xs)] p-1.5 transition-colors hover:bg-[var(--editor-soft)] disabled:opacity-50"
                  aria-label={post.is_hidden === 1 ? '取消隐藏' : '隐藏文章'}
                >
                  {post.is_hidden === 1 ? (
                    <EyeOff className="h-4 w-4 text-[var(--stone-gray)]" />
                  ) : (
                    <EyeIcon className="h-4 w-4 text-[var(--stone-gray)]" />
                  )}
                </button>
              </Tooltip>
              <Tooltip label={post.password ? '管理访问密码' : '设置访问密码'}>
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="min-h-11 min-w-11 rounded-[var(--radius-xs)] p-1.5 transition-colors hover:bg-[var(--editor-soft)]"
                  aria-label={post.password ? '管理访问密码' : '设置访问密码'}
                >
                  {post.password ? (
                    <Lock className="h-4 w-4 text-[var(--atelier-vermilion)]" />
                  ) : (
                    <Unlock className="h-4 w-4 text-[var(--stone-gray)]" />
                  )}
                </button>
              </Tooltip>
              <Tooltip label={post.status === 'published' ? '转为草稿' : '发布文章'}>
                <button
                  onClick={() => setShowStatusModal(true)}
                  disabled={loading}
                  className="min-h-11 min-w-11 rounded-[var(--radius-xs)] p-1.5 transition-colors hover:bg-[var(--editor-soft)] disabled:opacity-50"
                  aria-label={post.status === 'published' ? '转为草稿' : '发布文章'}
                >
                  {post.status === 'published' ? (
                    <FileText className="h-4 w-4 text-[var(--warning)]" />
                  ) : (
                    <Check className="h-4 w-4 text-[var(--success)]" />
                  )}
                </button>
              </Tooltip>
              <Tooltip label="删除文章">
                <button
                  onClick={() => setShowDeleteModal(true)}
                  disabled={loading}
                  className="min-h-11 min-w-11 rounded-[var(--radius-xs)] p-1.5 transition-colors hover:bg-[var(--editor-soft)] disabled:opacity-50"
                  aria-label="删除文章"
                >
                  <Trash2 className="h-4 w-4 text-[var(--danger)]" />
                </button>
              </Tooltip>
            </>
          )}
        </div>
      </div>

      {/* 移动端 */}
      <div className="p-4 transition-colors hover:bg-[var(--editor-soft)]/60 md:hidden">
        <div className="mb-2 flex items-start gap-3">
          <div className="mt-1.5 flex flex-shrink-0 flex-col items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${statusDotClass}`} />
            <div className="flex flex-col gap-0.5">
              {post.is_pinned === 1 && <Pin className="h-3 w-3 text-[var(--atelier-vermilion)]" />}
              {post.password && <Lock className="h-3 w-3 text-[var(--stone-gray)]" />}
              {post.is_hidden === 1 && <EyeOff className="h-3 w-3 text-[var(--stone-gray)]" />}
            </div>
          </div>

          <Link
            href={`/editor?edit=${post.slug}`}
            className="min-h-11 min-w-11 line-clamp-2 flex-1 font-medium text-[var(--editor-ink)] transition-colors hover:text-[var(--atelier-vermilion)]"
          >
            {post.title}
          </Link>
        </div>

        {post.description && (
          <p className="mb-3 ml-5 line-clamp-2 text-xs leading-relaxed text-[var(--editor-muted)]">
            {post.description}
          </p>
        )}

        <div className="mb-3 ml-5 flex flex-wrap items-center gap-2 text-xs text-[var(--stone-gray)]">
          <div className="min-w-[140px] max-w-[180px]">
            <Dropdown
              options={categoryOptions}
              value={post.category || ''}
              onChange={handleCategoryChange}
              placeholder="未分类"
              className="w-full [&_button]:whitespace-nowrap [&_button>span]:truncate [&_button>svg]:shrink-0"
              disabled={loading || isDeleted}
            />
          </div>
          <span>·</span>
          <span className="atelier-mono">{post.view_count.toLocaleString()} 次</span>
          <span>·</span>
          <span className="atelier-mono">{formatDate(post.published_at)}</span>
        </div>

        <div className="ml-5 flex flex-wrap items-center gap-1">
          {isDeleted ? (
            <>
              <Tooltip label="恢复为草稿">
                <button
                  onClick={handleRestore}
                  disabled={loading}
                  className="min-h-11 min-w-11 rounded-[var(--radius-xs)] p-1.5 transition-colors hover:bg-[var(--editor-soft)] disabled:opacity-50"
                  aria-label="恢复为草稿"
                >
                  <Check className="h-4 w-4 text-[var(--success)]" />
                </button>
              </Tooltip>
              <Tooltip label="永久删除">
                <button
                  onClick={() => setShowPermanentModal(true)}
                  disabled={loading}
                  className="min-h-11 min-w-11 rounded-[var(--radius-xs)] p-1.5 transition-colors hover:bg-[var(--editor-soft)] disabled:opacity-50"
                  aria-label="永久删除"
                >
                  <Trash2 className="h-4 w-4 text-[var(--danger)]" />
                </button>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip label="查看文章">
                <button
                  onClick={handleView}
                  className="min-h-11 min-w-11 rounded-[var(--radius-xs)] p-1.5 transition-colors hover:bg-[var(--editor-soft)]"
                  aria-label="查看文章"
                >
                  <Eye className="h-4 w-4 text-[var(--stone-gray)]" />
                </button>
              </Tooltip>
              <Tooltip label="复制链接">
                <button
                  onClick={handleCopyLink}
                  className="min-h-11 min-w-11 rounded-[var(--radius-xs)] p-1.5 transition-colors hover:bg-[var(--editor-soft)]"
                  aria-label="复制链接"
                >
                  <Link2 className="h-4 w-4 text-[var(--stone-gray)]" />
                </button>
              </Tooltip>
              <Tooltip label="编辑文章">
                <Link
                  href={`/editor?edit=${post.slug}`}
                  className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-[var(--radius-xs)] p-1.5 transition-colors hover:bg-[var(--editor-soft)]"
                  aria-label="编辑文章"
                >
                  <Edit className="h-4 w-4 text-[var(--stone-gray)]" />
                </Link>
              </Tooltip>
              <Tooltip label={post.is_pinned === 1 ? '取消置顶' : '置顶文章'}>
                <button
                  onClick={() => setShowPinModal(true)}
                  disabled={loading}
                  className="min-h-11 min-w-11 rounded-[var(--radius-xs)] p-1.5 transition-colors hover:bg-[var(--editor-soft)] disabled:opacity-50"
                  aria-label={post.is_pinned === 1 ? '取消置顶' : '置顶文章'}
                >
                  {post.is_pinned === 1 ? (
                    <PinOff className="h-4 w-4 text-[var(--atelier-vermilion)]" />
                  ) : (
                    <Pin className="h-4 w-4 text-[var(--stone-gray)]" />
                  )}
                </button>
              </Tooltip>
              <Tooltip label={post.is_hidden === 1 ? '取消隐藏' : '隐藏文章'}>
                <button
                  onClick={() => setShowHiddenModal(true)}
                  disabled={loading}
                  className="min-h-11 min-w-11 rounded-[var(--radius-xs)] p-1.5 transition-colors hover:bg-[var(--editor-soft)] disabled:opacity-50"
                  aria-label={post.is_hidden === 1 ? '取消隐藏' : '隐藏文章'}
                >
                  {post.is_hidden === 1 ? (
                    <EyeOff className="h-4 w-4 text-[var(--stone-gray)]" />
                  ) : (
                    <EyeIcon className="h-4 w-4 text-[var(--stone-gray)]" />
                  )}
                </button>
              </Tooltip>
              <Tooltip label={post.password ? '管理访问密码' : '设置访问密码'}>
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="min-h-11 min-w-11 rounded-[var(--radius-xs)] p-1.5 transition-colors hover:bg-[var(--editor-soft)]"
                  aria-label={post.password ? '管理访问密码' : '设置访问密码'}
                >
                  {post.password ? (
                    <Lock className="h-4 w-4 text-[var(--atelier-vermilion)]" />
                  ) : (
                    <Unlock className="h-4 w-4 text-[var(--stone-gray)]" />
                  )}
                </button>
              </Tooltip>
              <Tooltip label={post.status === 'published' ? '转为草稿' : '发布文章'}>
                <button
                  onClick={() => setShowStatusModal(true)}
                  disabled={loading}
                  className="min-h-11 min-w-11 rounded-[var(--radius-xs)] p-1.5 transition-colors hover:bg-[var(--editor-soft)] disabled:opacity-50"
                  aria-label={post.status === 'published' ? '转为草稿' : '发布文章'}
                >
                  {post.status === 'published' ? (
                    <FileText className="h-4 w-4 text-[var(--warning)]" />
                  ) : (
                    <Check className="h-4 w-4 text-[var(--success)]" />
                  )}
                </button>
              </Tooltip>
              <Tooltip label="删除文章">
                <button
                  onClick={() => setShowDeleteModal(true)}
                  disabled={loading}
                  className="min-h-11 min-w-11 rounded-[var(--radius-xs)] p-1.5 transition-colors hover:bg-[var(--editor-soft)] disabled:opacity-50"
                  aria-label="删除文章"
                >
                  <Trash2 className="h-4 w-4 text-[var(--danger)]" />
                </button>
              </Tooltip>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <PasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        slug={post.slug}
        currentPassword={post.password}
        articleUrl={baseArticleUrl}
        onSuccess={() => {
          window.location.reload()
        }}
      />

      <Modal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onConfirm={handlePinToggle}
        title={post.is_pinned === 1 ? '取消置顶' : '置顶文章'}
        description={post.is_pinned === 1 ? '确定要取消置顶吗？' : '置顶后文章将显示在列表顶部。'}
        confirmText="确认"
        type="info"
      />

      <Modal
        isOpen={showHiddenModal}
        onClose={() => setShowHiddenModal(false)}
        onConfirm={handleHiddenToggle}
        title={post.is_hidden === 1 ? '取消隐藏' : '隐藏文章'}
        description={
          post.is_hidden === 1
            ? '取消隐藏后，文章将重新出现在首页、RSS 和搜索结果中。'
            : '隐藏后，文章不会在首页、RSS 和搜索中显示，但可以通过直接私密。'
        }
        confirmText="确认"
        type="info"
      />

      <Modal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        onConfirm={handleStatusToggle}
        title={post.status === 'published' ? '转为草稿' : '发布文章'}
        description={
          post.status === 'published'
            ? '转为草稿后，文章将不再公开显示。'
            : '发布后，文章将在首页和 RSS 中显示。'
        }
        confirmText="确认"
        type="info"
      />

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleSoftDelete}
        title="删除文章"
        description={`确定要删除「${post.title}」吗？删除后可以在已删除列表中恢复。`}
        confirmText="删除"
        type="warning"
      />

      <Modal
        isOpen={showPermanentModal}
        onClose={() => setShowPermanentModal(false)}
        onConfirm={handlePermanentDelete}
        title="永久删除"
        description={`确定要永久删除「${post.title}」吗？此操作不可恢复！`}
        confirmText="永久删除"
        type="danger"
      />
    </>
  )
}
