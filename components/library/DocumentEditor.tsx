'use client'
import { useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Quote,
  Code2,
  Table2,
  Undo2,
  Redo2,
  Link2,
} from 'lucide-react'
import { createDocumentCore } from '@/lib/document-editor'
import { renderLibraryMarkdown, requiresSourceEditor } from '@/lib/library/markdown'
import { Button, Input, Modal } from '@/components/admin/ui'
const normalize = (html: string) => html.replace(/>\s+</g, '><').trim()
export default function DocumentEditor({
  initial,
  onChange,
  onComposition,
}: {
  initial: string
  onChange: (value: string) => void
  onComposition: (active: boolean) => void
}) {
  const [initialSource] = useState(() => requiresSourceEditor(initial))
  const [source, setSource] = useState(initialSource)
  const [sourceValue, setSourceValue] = useState(initial)
  const [legacy, setLegacy] = useState(
    initialSource ? '原文包含不能无损转换的格式，已保留原文。请使用源码编辑。' : '',
  )
  const [linkOpen, setLinkOpen] = useState(false)
  const [url, setUrl] = useState('')
  const editor = useEditor({
    extensions: createDocumentCore(),
    content: initialSource ? '' : initial,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        'aria-label': '资料正文编辑器',
        role: 'textbox',
        'aria-multiline': 'true',
        class: 'library-prose document-content',
      },
      handleDOMEvents: {
        compositionstart: () => {
          onComposition(true)
          return false
        },
        compositionend: () => {
          onComposition(false)
          return false
        },
      },
    },
    onCreate: ({ editor }) => {
      if (initialSource) return
      const output = editor.storage.markdown.getMarkdown()
      if (normalize(renderLibraryMarkdown(initial)) !== normalize(renderLibraryMarkdown(output))) {
        setLegacy('原文包含不能无损转换的格式，已保留原文。请使用源码编辑。')
        setSource(true)
      }
    },
    onUpdate: ({ editor }) => {
      const value = editor.storage.markdown.getMarkdown()
      setSourceValue(value)
      onChange(value)
    },
  })
  if (!editor) return <p role="status">正在加载编辑器…</p>
  const commands = [
    ['加粗', Bold, () => editor.chain().focus().toggleBold().run()],
    ['斜体', Italic, () => editor.chain().focus().toggleItalic().run()],
    ['标题', Heading2, () => editor.chain().focus().toggleHeading({ level: 2 }).run()],
    ['无序列表', List, () => editor.chain().focus().toggleBulletList().run()],
    ['有序列表', ListOrdered, () => editor.chain().focus().toggleOrderedList().run()],
    ['引用', Quote, () => editor.chain().focus().toggleBlockquote().run()],
    ['代码块', Code2, () => editor.chain().focus().toggleCodeBlock().run()],
    [
      '插入表格',
      Table2,
      () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    ],
    [
      '链接',
      Link2,
      () => {
        setUrl(editor.getAttributes('link').href || '')
        setLinkOpen(true)
      },
    ],
    ['撤销', Undo2, () => editor.chain().focus().undo().run()],
    ['重做', Redo2, () => editor.chain().focus().redo().run()],
  ] as const
  return (
    <div className="document-editor">
      {legacy && (
        <p className="reader-warning" role="status">
          {legacy}
        </p>
      )}
      <div className="document-toolbar" role="toolbar" aria-label="正文格式">
        {!source &&
          commands.map(([label, Icon, action]) => (
            <Button
              key={label}
              variant="ghost"
              aria-label={label}
              title={label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={action}
            >
              <Icon size={16} />
            </Button>
          ))}
        <Button
          variant="ghost"
          onClick={() => {
            if (!source) {
              setSourceValue(editor.storage.markdown.getMarkdown())
              setSource(true)
            } else if (!legacy) {
              if (requiresSourceEditor(sourceValue)) {
                setLegacy('原文包含不能无损转换的格式，已保留原文。请使用源码编辑。')
                return
              }
              editor.commands.setContent(sourceValue, { emitUpdate: false })
              if (
                normalize(renderLibraryMarkdown(sourceValue)) !==
                normalize(renderLibraryMarkdown(editor.storage.markdown.getMarkdown()))
              ) {
                setLegacy('原文包含不能无损转换的格式，已保留原文。请使用源码编辑。')
              } else setSource(false)
            }
          }}
          disabled={source && !!legacy}
        >
          {source ? '源码模式' : 'Markdown 源码'}
        </Button>
      </div>
      {source ? (
        <textarea
          className="exact-editor"
          aria-label="正文（Markdown）"
          value={sourceValue}
          maxLength={50000}
          onCompositionStart={() => onComposition(true)}
          onCompositionEnd={() => onComposition(false)}
          onChange={(e) => {
            setSourceValue(e.target.value)
            onChange(e.target.value)
          }}
        />
      ) : (
        <EditorContent editor={editor} />
      )}
      <Modal open={linkOpen} onOpenChange={setLinkOpen} title="编辑链接">
        <form
          className="admin-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!url) editor.chain().focus().unsetLink().run()
            else if (/^https?:\/\//i.test(url)) editor.chain().focus().setLink({ href: url }).run()
            else return
            setLinkOpen(false)
          }}
        >
          <label>
            HTTP(S) 地址
            <Input
              aria-label="链接地址"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <Button type="submit" variant="primary">
            应用链接
          </Button>
        </form>
      </Modal>
    </div>
  )
}
