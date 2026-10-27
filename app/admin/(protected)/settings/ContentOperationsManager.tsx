'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button, Input, Select, Menu, Modal } from '@/components/admin/ui'
import { ManualSheet } from '@/components/admin/ManualSheet'
import { AI_IMAGE_ASPECT_RATIO_OPTIONS, AI_IMAGE_RESOLUTION_OPTIONS } from '@/lib/ai-image-options'
type Profile = { id: number; name: string; is_default: number }
type Operation = {
  id?: number
  action_key?: string
  target_key?: string
  label: string
  description: string
  prompt: string
  is_enabled: number
  sort_order?: number
  profile_id?: number | null
  temperature?: number
  max_tokens?: number
  aspect_ratio?: string
  resolution?: string
  provider_mode?: string
  text_profile_id?: number | null
  image_profile_id?: number | null
  workers_model?: string
}
async function request(url: string, method = 'GET', body?: unknown) {
  const res = await fetch(url, {
    method,
    ...(body
      ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '操作失败')
  return data
}
export function ContentOperationsManager({ kind }: { kind: 'text' | 'image' | 'generators' }) {
  const endpoint =
    kind === 'generators'
      ? '/api/admin/ai-post-generators'
      : `/api/admin/${kind === 'image' ? 'ai-image-actions' : 'ai-actions'}`
  const [items, setItems] = useState<Operation[]>([]),
    [textProfiles, setTextProfiles] = useState<Profile[]>([]),
    [imageProfiles, setImageProfiles] = useState<Profile[]>([])
  const [availability, setAvailability] = useState<Record<string, boolean>>({}),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [edit, setEdit] = useState<Operation | null>(null),
    [remove, setRemove] = useState<Operation | null>(null),
    [models, setModels] = useState<string[]>([])
  const load = useCallback(async () => {
    setError('')
    try {
      const [data, text, image] = await Promise.all([
        request(endpoint),
        request('/api/admin/ai-provider'),
        request('/api/admin/ai-image-provider'),
      ])
      const rows = kind === 'generators' ? data.generators : data.actions
      setItems(rows)
      setTextProfiles(text.profiles || [])
      setImageProfiles(image.profiles || [])
      setAvailability(
        await request(
          `/api/admin/model-status?kind=${kind}&ids=${rows.map((r: Operation) => r.profile_id || 0).join(',')}`,
        ),
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [endpoint, kind])
  useEffect(() => {
    void load()
  }, [load])
  async function save() {
    if (
      !edit ||
      !edit.label.trim() ||
      !edit.prompt.trim() ||
      (kind !== 'generators' && (!edit.action_key?.trim() || !edit.description.trim()))
    ) {
      setError('请填写名称、用途、标识和提示词。')
      return false
    }
    setBusy(true)
    setError('')
    try {
      await request(
        kind === 'generators' ? endpoint : edit.id ? `${endpoint}/${edit.id}` : endpoint,
        kind === 'generators' || edit.id ? 'PUT' : 'POST',
        edit,
      )
      setEdit(null)
      await load()
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }
  const patch = (value: Partial<Operation>) => setEdit((e) => e && { ...e, ...value })
  async function move(index: number, step: number) {
    const next = items[index + step]
    if (!next) return
    setBusy(true)
    try {
      await request(endpoint, 'PUT', {
        items: [
          { id: items[index].id, sort_order: next.sort_order },
          { id: next.id, sort_order: items[index].sort_order },
        ],
      })
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const isImage = kind === 'image' || edit?.target_key === 'cover',
    profiles = isImage ? imageProfiles : textProfiles
  const profileKey =
    kind === 'generators' ? (isImage ? 'image_profile_id' : 'text_profile_id') : 'profile_id'
  function status(item: Operation) {
    const available =
      availability[kind === 'generators' ? item.target_key || '' : String(item.profile_id || 0)]
    if (available === undefined) return '检查配置中…'
    if (!available) return '尚未配置'
    if (kind === 'generators' && item.provider_mode === 'workers_ai') return 'Workers AI 已配置'
    const id =
      kind === 'generators'
        ? item.target_key === 'cover'
          ? item.image_profile_id
          : item.text_profile_id
        : item.profile_id
    return id ? '指定模型' : '使用默认模型'
  }
  return (
    <div>
      <div className="resource-toolbar">
        <p>
          {kind === 'text'
            ? '选中文字时使用的快捷操作'
            : kind === 'image'
              ? '文章配图使用的提示模板'
              : '文章摘要、标签、地址和封面的生成方式'}
        </p>
        {kind !== 'generators' && (
          <Button
            onClick={() => {
              setError('')
              setEdit({
                action_key: '',
                label: '',
                description: '',
                prompt: '',
                is_enabled: 1,
                temperature: 0.6,
                profile_id: null,
                aspect_ratio: '16:9',
                resolution: '2k',
              })
            }}
          >
            新增{kind === 'text' ? '操作' : '提示'}
          </Button>
        )}
      </div>
      {error && !edit && (
        <p role="alert">
          {error}
          <Button onClick={() => void load()}>重试</Button>
        </p>
      )}
      {loading && <p role="status">正在加载…</p>}
      <div className="operation-list">
        {items.map((item, index) => (
          <div className="operation-row" key={item.target_key || item.id}>
            <div>
              <h3>{item.label}</h3>
              <p>{item.description}</p>
            </div>
            <span className="operation-status">
              {item.is_enabled ? '已启用' : '已停用'}
              <small>{status(item)}</small>
            </span>
            <Button
              onClick={() => {
                setError('')
                setModels([])
                setEdit({ ...item })
              }}
            >
              编辑
            </Button>
            {kind !== 'generators' && (
              <Menu
                label={`${item.label}的操作`}
                items={[
                  {
                    label: '上移',
                    disabled: busy || index === 0,
                    onSelect: () => void move(index, -1),
                  },
                  {
                    label: '下移',
                    disabled: busy || index === items.length - 1,
                    onSelect: () => void move(index, 1),
                  },
                  { label: '删除', danger: true, onSelect: () => setRemove(item) },
                ]}
              />
            )}
          </div>
        ))}
      </div>
      {edit && (
        <ManualSheet
          title={`编辑${kind === 'generators' ? '文章生成' : kind === 'image' ? '图片提示' : '文本操作'}`}
          value={edit}
          onSave={save}
          onClose={() => setEdit(null)}
        >
          <label>
            名称
            <Input
              value={edit.label}
              readOnly={kind === 'generators'}
              onChange={(e) => patch({ label: e.target.value })}
            />
          </label>
          <label>
            用途
            <Input
              value={edit.description}
              readOnly={kind === 'generators'}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </label>
          {kind !== 'generators' && (
            <label>
              操作标识
              <Input
                value={edit.action_key || ''}
                onChange={(e) => patch({ action_key: e.target.value })}
              />
            </label>
          )}
          <label>
            提示模板
            <textarea
              className="admin-input"
              rows={10}
              value={edit.prompt}
              onChange={(e) => patch({ prompt: e.target.value })}
            />
          </label>
          {kind === 'generators' && (
            <label>
              模型来源
              <Select
                value={edit.provider_mode}
                onChange={(e) => patch({ provider_mode: e.target.value })}
              >
                <option value="profile">已配置的模型</option>
                <option value="workers_ai">Workers AI</option>
              </Select>
            </label>
          )}
          {edit.provider_mode === 'workers_ai' ? (
            <>
              <label>
                Workers AI 模型
                <Input
                  list="worker-model-options"
                  value={edit.workers_model || ''}
                  onChange={(e) => patch({ workers_model: e.target.value })}
                />
                <datalist id="worker-model-options">
                  {models.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </label>
              <Button
                onClick={() =>
                  void request(`/api/admin/workers-ai-models?kind=${isImage ? 'image' : 'text'}`)
                    .then((r) => {
                      setModels((r.models || []).map((m: { id: string }) => m.id))
                      if (r.warning) setError(r.warning)
                    })
                    .catch((e) => setError(e.message))
                }
              >
                加载模型列表
              </Button>
            </>
          ) : (
            <label>
              使用的模型
              <Select
                value={edit[profileKey] || ''}
                onChange={(e) =>
                  patch({ [profileKey]: e.target.value ? Number(e.target.value) : null })
                }
              >
                <option value="">使用默认模型</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.is_default ? '（默认）' : ''}
                  </option>
                ))}
              </Select>
              <Link href={`/admin/settings?section=${isImage ? 'image' : 'text'}`}>
                管理{isImage ? '图片' : '文本'}模型
              </Link>
            </label>
          )}
          <label>
            <input
              type="checkbox"
              checked={!!edit.is_enabled}
              onChange={(e) => patch({ is_enabled: e.target.checked ? 1 : 0 })}
            />
            启用此操作
          </label>
          <details>
            <summary>高级参数</summary>
            <div className="admin-form">
              {isImage ? (
                <>
                  <label>
                    画面比例
                    <Select
                      value={edit.aspect_ratio || '16:9'}
                      onChange={(e) => patch({ aspect_ratio: e.target.value })}
                    >
                      {AI_IMAGE_ASPECT_RATIO_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label>
                    分辨率
                    <Select
                      value={edit.resolution || '2k'}
                      onChange={(e) => patch({ resolution: e.target.value })}
                    >
                      {AI_IMAGE_RESOLUTION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </label>
                </>
              ) : (
                <>
                  <label>
                    温度
                    <Input
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={edit.temperature ?? 0.6}
                      onChange={(e) => patch({ temperature: Number(e.target.value) })}
                    />
                  </label>
                  {kind === 'generators' && (
                    <label>
                      最大输出 Token
                      <Input
                        type="number"
                        min="1"
                        max="32768"
                        value={edit.max_tokens || 2000}
                        onChange={(e) => patch({ max_tokens: Number(e.target.value) })}
                      />
                    </label>
                  )}
                </>
              )}
            </div>
          </details>
          {error && <p role="alert">{error}</p>}
          <Button variant="primary" disabled={busy} onClick={() => void save()}>
            {busy ? '保存中…' : '保存修改'}
          </Button>
        </ManualSheet>
      )}
      <Modal
        open={!!remove}
        onOpenChange={(open) => {
          if (!open) setRemove(null)
        }}
        title="删除操作"
        description={`确定删除「${remove?.label || ''}」？`}
      >
        <Button
          variant="danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await request(`${endpoint}/${remove?.id}`, 'DELETE')
              setRemove(null)
              await load()
            } catch (e) {
              setError((e as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          确认删除
        </Button>
      </Modal>
    </div>
  )
}
