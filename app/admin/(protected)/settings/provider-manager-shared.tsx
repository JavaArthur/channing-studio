'use client'
import { ManualSheet } from '@/components/admin/ManualSheet'
import type { SaveHandler } from '@/components/admin/UnsavedChanges'

import { Button, Menu, Modal } from '@/components/admin/ui'
import type { ReactNode } from 'react'
import { Dropdown } from '@/components/Dropdown'

export interface BaseProviderProfile {
  id: number
  name: string
  provider: string
  provider_name: string
  provider_type: string
  provider_category: string
  api_key_url: string
  base_url: string
  model: string
  api_key_masked: string
  is_default: number
  updated_at?: number
}

export interface BaseProviderFormState {
  id?: number
  name: string
  provider: string
  provider_name: string
  provider_type: string
  provider_category: string
  api_key_url: string
  base_url: string
  model: string
  api_key: string
  is_default: boolean
  api_key_masked?: string
}

export interface ModelsResponse {
  models?: Array<{ id: string; name: string }>
  source?: 'provider' | 'preset'
  warning?: string
  error?: string
}

export interface ProviderTemplatePreset {
  id: string
  name: string
  category: string
  defaultModel: string
  description: string
  recommended?: boolean
}

export interface ProviderTemplateGroup {
  category: string
  presets: ProviderTemplatePreset[]
}

export function createModelOptions(
  models: Array<{ id: string; name: string }>,
  currentModel: string,
) {
  const options = models.map((model) => ({ value: model.id, label: model.name }))
  const normalizedCurrentModel = currentModel.trim()

  if (!normalizedCurrentModel || options.some((option) => option.value === normalizedCurrentModel)) {
    return options
  }

  return [
    { value: normalizedCurrentModel, label: `${normalizedCurrentModel}（当前值）` },
    ...options,
  ]
}

interface ProviderListTableProps<T extends BaseProviderProfile> {
  profiles: T[]
  defaultProfileId: number | null
  emptyText: string
  onEdit: (profile: T) => void
  onDelete: (profile: T) => void
  onSetDefault: (profile: T) => void
}

export function ProviderListTable<T extends BaseProviderProfile>({
  profiles,
  defaultProfileId,
  emptyText,
  onEdit,
  onDelete,
  onSetDefault,
}: ProviderListTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--editor-line)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--editor-soft)] text-left">
            <th className="px-3 py-2 font-medium text-[var(--editor-muted)]">名称</th>
            <th className="hidden px-3 py-2 font-medium text-[var(--editor-muted)] sm:table-cell">平台</th>
            <th className="hidden px-3 py-2 font-medium text-[var(--editor-muted)] md:table-cell">模型</th>
            <th className="hidden px-3 py-2 font-medium text-[var(--editor-muted)] lg:table-cell">更新时间</th>
            <th className="w-36 px-3 py-2 text-right font-medium text-[var(--editor-muted)]">操作</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((profile) => (
            <tr key={profile.id} className="border-t border-[var(--editor-line)] hover:bg-[var(--editor-panel)]">
              <td className="px-3 py-2 font-medium text-[var(--editor-ink)]">
                {profile.name}
                {profile.id === defaultProfileId || profile.is_default === 1 ? (
                  <span className="ml-2 rounded-md bg-[var(--success-soft-bg)] px-1.5 py-0.5 text-[10px] text-[var(--success)]">默认</span>
                ) : null}
              </td>
              <td className="hidden px-3 py-2 text-[var(--editor-muted)] sm:table-cell">
                {profile.provider_name || profile.provider || '-'}
              </td>
              <td className="hidden px-3 py-2 text-[var(--editor-muted)] md:table-cell">{profile.model}</td>
              <td className="hidden px-3 py-2 text-[var(--editor-muted)] lg:table-cell">
                {profile.updated_at ? new Date(profile.updated_at * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '-'}
              </td>
              <td className="px-3 py-2 text-right">
                <Button variant="ghost" onClick={() => onEdit(profile)}>编辑</Button>
                <Menu label={`${profile.name}的操作`} items={[
                  { label: '设为默认', disabled: profile.id === defaultProfileId || profile.is_default === 1, onSelect: () => onSetDefault(profile) },
                  { label: '删除配置', danger: true, onSelect: () => onDelete(profile) },
                ]} />
              </td>
            </tr>
          ))}
          {profiles.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-sm text-[var(--editor-muted)]">
                {emptyText}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}

interface ProviderDialogProps {
  title: string
  onClose: () => void
  value: unknown
  onSave: SaveHandler
  headerAction?: ReactNode
  children: ReactNode
}

export function ProviderDialog({ title, onClose, headerAction, children, value, onSave }: ProviderDialogProps) {
  return <ManualSheet title={title} onClose={onClose} value={value} onSave={onSave}><div className="provider-form">{headerAction && <div className="mb-4">{headerAction}</div>}{children}</div></ManualSheet>
}

interface ProviderTemplateModalProps {
  groups: ProviderTemplateGroup[]
  customOptionLabel: string
  customOptionDescription: string
  onClose: () => void
  onSelect: (presetId: string) => void
}

export function ProviderTemplateModal({
  groups,
  customOptionLabel,
  customOptionDescription,
  onClose,
  onSelect,
}: ProviderTemplateModalProps) {
  return (
    <Modal open onOpenChange={open => { if (!open) onClose() }} title="快捷模板">
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.category}>
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--editor-muted)]">
                {group.category}
              </div>
              <div className="space-y-2">
                {group.presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onSelect(preset.id)}
                    className="min-h-11 min-w-11 w-full rounded-lg border border-[var(--editor-line)] px-4 py-3 text-left hover:bg-[var(--editor-soft)]"
                  >
                    <div className="font-serif text-sm font-medium text-[var(--editor-ink)]">
                      {preset.name}
                      {preset.recommended ? (
                        <span className="ml-2 rounded-md bg-[var(--success-soft-bg)] px-1.5 py-0.5 text-[10px] text-[var(--success)]">推荐</span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-[var(--editor-muted)]">{preset.description}</div>
                    <div className="mt-1 text-xs text-[var(--editor-muted)]">{preset.defaultModel}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onSelect('custom')}
            className="min-h-11 min-w-11 w-full rounded-lg border border-dashed border-[var(--editor-line)] px-4 py-3 text-left hover:bg-[var(--editor-soft)]"
          >
            <div className="font-serif text-sm font-medium text-[var(--editor-ink)]">{customOptionLabel}</div>
            <div className="mt-1 text-xs text-[var(--editor-muted)]">{customOptionDescription}</div>
          </button>
        </div>
    </Modal>
  )
}

interface ProviderBasicFieldsProps<T extends BaseProviderFormState> {
  editing: T
  modelOptions: Array<{ value: string; label: string }>
  loadingModels: boolean
  models: Array<{ id: string; name: string }>
  modelsSource: 'provider' | 'preset' | null
  modelsWarning: string
  onChange: (patch: Partial<T>) => void
  onFetchModels: () => void
  fetchModelsLabel?: string
}

export function ProviderBasicFields<T extends BaseProviderFormState>({
  editing,
  modelOptions,
  loadingModels,
  models,
  modelsSource,
  modelsWarning,
  onChange,
  onFetchModels,
  fetchModelsLabel = '拉取模型列表',
}: ProviderBasicFieldsProps<T>) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--editor-ink)]">配置名称</label>
        <input
          type="text"
          value={editing.name}
          onChange={(event) => onChange({ name: event.target.value } as Partial<T>)}
          className="min-h-11 min-w-11 w-full rounded-lg border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--editor-ink)] outline-none focus:border-[var(--focus-ring)]"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--editor-ink)]">平台</label>
        <input
          type="text"
          value={editing.provider_name || editing.provider}
          onChange={(event) => onChange({ provider_name: event.target.value } as Partial<T>)}
          className="min-h-11 min-w-11 w-full rounded-lg border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--editor-ink)] outline-none focus:border-[var(--focus-ring)]"
        />
      </div>

      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-medium text-[var(--editor-ink)]">Base URL</label>
        <input
          type="url"
          value={editing.base_url}
          onChange={(event) => onChange({ base_url: event.target.value } as Partial<T>)}
          className="min-h-11 min-w-11 w-full rounded-lg border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--editor-ink)] outline-none focus:border-[var(--focus-ring)]"
        />
      </div>

      <div className="sm:col-span-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="block text-sm font-medium text-[var(--editor-ink)]">API Key</label>
          {editing.api_key_url ? (
            <a
              href={editing.api_key_url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11 min-w-11 inline-flex items-center text-xs text-[var(--editor-accent)] hover:underline"
            >
              获取 Key
            </a>
          ) : null}
        </div>
        <input
          type="password"
          value={editing.api_key}
          onChange={(event) => onChange({ api_key: event.target.value } as Partial<T>)}
          className="min-h-11 min-w-11 w-full rounded-lg border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--editor-ink)] outline-none focus:border-[var(--focus-ring)]"
        />
        {editing.api_key_masked ? (
          <div className="mt-1 text-xs text-[var(--editor-muted)]">已保存：{editing.api_key_masked}</div>
        ) : null}
      </div>

      <div className="sm:col-span-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="block text-sm font-medium text-[var(--editor-ink)]">模型</label>
          <button
            type="button"
            onClick={onFetchModels}
            disabled={loadingModels}
            className="min-h-11 min-w-11 rounded-md border border-[var(--editor-line)] px-2.5 py-1 text-xs text-[var(--editor-ink)] hover:bg-[var(--editor-soft)] disabled:opacity-50"
          >
            {loadingModels ? '拉取中…' : fetchModelsLabel}
          </button>
        </div>
        <input
          type="text"
          value={editing.model}
          onChange={(event) => onChange({ model: event.target.value } as Partial<T>)}
          className="min-h-11 min-w-11 w-full rounded-lg border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--editor-ink)] outline-none focus:border-[var(--focus-ring)]"
        />
        {models.length > 0 ? (
          <div className="mt-2 space-y-2">
            <Dropdown
              options={modelOptions}
              value={editing.model}
              onChange={(value) => onChange({ model: value } as Partial<T>)}
              placeholder={`搜索并选择已加载的 ${models.length} 个模型`}
            />
            <div className="text-xs text-[var(--editor-muted)]">
              已加载 {models.length} 个模型。可在下拉里搜索，也可以直接在上方手动输入模型 ID。
            </div>
          </div>
        ) : null}
        {modelsSource || modelsWarning ? (
          <div className="mt-1 text-xs text-[var(--editor-muted)]">
            {modelsSource === 'provider' ? '来源：服务商接口' : modelsSource === 'preset' ? '来源：模板回退' : ''}
            {modelsWarning ? ` · ${modelsWarning}` : ''}
          </div>
        ) : null}
      </div>
    </div>
  )
}
