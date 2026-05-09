import type { Editor } from '@tiptap/core'
import { useEffect, useReducer } from 'react'

import { createMinimalS1000dTableInsertJson } from '../../extensions/s1000d/s1000dTableNodes'
import { List,ListOrdered,Table,Undo2 ,Redo2   } from 'lucide-react';

const FONT_CHOICES: { label: string; value: string }[] = [
  { label: 'Inter', value: 'Inter, ui-sans-serif, system-ui, sans-serif' },
  {
    label: 'PingFang SC',
    value: '"PingFang SC", "Microsoft YaHei", sans-serif',
  },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Consolas', value: 'Consolas, ui-monospace, monospace' },
]

const FONT_SIZES = ['11px', '12px', '14px', '16px', '18px', '24px']

interface FormatToolbarProps {
  editor: Editor
}

function isInsideNodeType(editor: Editor, nodeTypeName: string): boolean {
  const $from = editor.state.selection.$from
  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name === nodeTypeName) return true
  }
  return false
}

function insertSequentialListBySchema(editor: Editor) {
  // Schema: sequentialList -> listItem+（在编辑器映射为 orderedList -> listItem -> paragraph）
  return editor
    .chain()
    .focus()
    .insertContent({
      type: 'orderedList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [] }],
        },
      ],
    })
    .run()
}

function insertRandomOrAttentionListBySchema(editor: Editor) {
  if (isInsideNodeType(editor, 'warningAndCautionPara')) {
    // Schema: attentionRandomList -> attentionRandomListItem+ -> attentionListItemPara+
    return editor
      .chain()
      .focus()
      .insertContent({
        type: 'attentionRandomList',
        content: [
          {
            type: 'attentionRandomListItem',
            content: [{ type: 'attentionListItemPara', content: [] }],
          },
        ],
      })
      .run()
  }

  // Schema: randomList -> listItem+（在编辑器映射为 bulletList -> listItem -> paragraph）
  return editor
    .chain()
    .focus()
    .insertContent({
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [] }],
        },
      ],
    })
    .run()
}

export function FormatToolbar({ editor }: FormatToolbarProps) {
  const [, refresh] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    const onTxn = () => {
      refresh()
    }
    editor.on('transaction', onTxn)
    return () => {
      editor.off('transaction', onTxn)
    }
  }, [editor])

  const textAttrs = editor.getAttributes('textStyle') as {
    fontFamily?: string | null
    fontSize?: string | null
    color?: string | null
    backgroundColor?: string | null
  }

  const highlightAttrs = editor.getAttributes('highlight') as {
    color?: string | null
  }

  const alignLeft =
    editor.isActive({ textAlign: 'left' }) ||
    (!editor.isActive({ textAlign: 'center' }) &&
      !editor.isActive({ textAlign: 'right' }) &&
      !editor.isActive({ textAlign: 'justify' }))

  return (
    <div className="ietm-format-toolbar" aria-label="格式工具栏">
      <div className="ietm-format-toolbar__cluster">
        <button
          type="button"
          className="ietm-icon-btn"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
          title="撤销"
        >
          <Undo2 size={16} aria-hidden className="shrink-0" />
        </button>
        <button
          type="button"
          className="ietm-icon-btn"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
          title="重做"
        >
          <Redo2 size={16} aria-hidden className="shrink-0" />
        </button>
        <button
          type="button"
          className="ietm-icon-btn"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertContent(
                createMinimalS1000dTableInsertJson(
                  4,
                  1,
                  3,
                  true,
                ),
              )
              .run()
          }
          title="插入表格（S1000D：title?、tgroup、thead?、tbody、row+、entry+、para+）"
        >
          <Table size={16} aria-hidden className="shrink-0" />
        </button>
        <button
          type="button"
          className="ietm-icon-btn"
          onClick={() => insertSequentialListBySchema(editor)}
          title="插入有序列表（sequentialList）"
          aria-label="插入有序列表"
        >
          <ListOrdered size={16} aria-hidden className="shrink-0" />
        </button>
        <button
          type="button"
          className="ietm-icon-btn"
          onClick={() => insertRandomOrAttentionListBySchema(editor)}
          title="插入无序列表（randomList / attentionRandomList）"
          aria-label="插入无序列表"
        >
          <List size={16} aria-hidden className="shrink-0" />
        </button>
      </div>

      <span className="ietm-format-toolbar__divider" />

      <div className="ietm-format-toolbar__cluster">
        <select
          className="ietm-toolbar-select"
          aria-label="字体"
          value={textAttrs.fontFamily ?? ''}
          onChange={(e) => {
            const v = e.target.value
            const chain = editor.chain().focus()
            if (!v) chain.unsetFontFamily().run()
            else chain.setFontFamily(v).run()
          }}
        >
          <option value="">默认字体</option>
          {FONT_CHOICES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        <select
          className="ietm-toolbar-select ietm-toolbar-select--narrow"
          aria-label="字号"
          value={textAttrs.fontSize ?? ''}
          onChange={(e) => {
            const v = e.target.value
            const chain = editor.chain().focus()
            if (!v) chain.unsetFontSize().run()
            else chain.setFontSize(v).run()
          }}
        >
          <option value="">默认</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s.replace('px', '')}
            </option>
          ))}
        </select>
      </div>

      <span className="ietm-format-toolbar__divider" />

      <div className="ietm-format-toolbar__cluster">
        <button
          type="button"
          className={`ietm-toggle-btn ${editor.isActive('bold') ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="加粗"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={`ietm-toggle-btn ${editor.isActive('italic') ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="斜体"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className={`ietm-toggle-btn ${editor.isActive('underline') ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="下划线"
        >
          <span className="ietm-underline-label">U</span>
        </button>

        <label className="ietm-color-swatch" title="文字颜色">
          <span className="ietm-color-swatch__glyph">A</span>
          <input
            type="color"
            value={rgbToHex(textAttrs.color ?? '#1f2330')}
            onChange={(e) =>
              editor.chain().focus().setColor(e.target.value).run()
            }
          />
        </label>

        <label className="ietm-color-swatch ietm-color-swatch--highlight" title="背景色">
          <span className="ietm-highlight-icon">▮</span>
          <input
            type="color"
            value={rgbToHex(highlightAttrs.color ?? '#fef08a')}
            onChange={(e) =>
              editor.chain().focus().setHighlight({ color: e.target.value }).run()
            }
          />
        </label>
      </div>

      <span className="ietm-format-toolbar__divider" />

      <div className="ietm-format-toolbar__cluster">
        <button
          type="button"
          className={`ietm-toggle-btn ${alignLeft ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          title="左对齐"
        >
          ≡
        </button>
        <button
          type="button"
          className={`ietm-toggle-btn ${editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          title="居中"
        >
          ☰
        </button>
        <button
          type="button"
          className={`ietm-toggle-btn ${editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          title="右对齐"
        >
          ≡
        </button>
        <button
          type="button"
          className={`ietm-toggle-btn ${editor.isActive({ textAlign: 'justify' }) ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          title="两端对齐"
        >
          ≋
        </button>
      </div>
    </div>
  )
}

function rgbToHex(color: string): string {
  const s = color.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s
  const m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (!m) return '#1f2330'
  const r = Number(m[1]).toString(16).padStart(2, '0')
  const g = Number(m[2]).toString(16).padStart(2, '0')
  const b = Number(m[3]).toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}
