import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { TextStyleKit } from '@tiptap/extension-text-style/text-style-kit'
import type { JSONContent } from '@tiptap/core'
import { IETMImage } from '../../extensions/IETMImage'
import {
  getDescriptionInnerXmlFromDmXml,
  preprocessS1000dDescriptionHtmlFragment,
  s1000dPhase1Nodes,
} from '../../extensions/S1000DNodes'
import { createMinimalS1000dTableInsertJson } from '../../extensions/s1000d/s1000dTableNodes'
import bikeDmSampleXml from '../../data/bikeDmSample.xml?raw'
import { FormatToolbar } from './FormatToolbar'
import {
  resolveInspectable,
  tableDimensions,
  type InspectTarget,
} from '../../lib/editor/resolveInspectable'

export interface IETMEditorRefValue {
  setContent: (content: JSONContent | string) => void
  getJSON: () => JSONContent
  focus: () => void
}

interface IETMEditorProps {
  initialContent?: JSONContent | string
  editable: boolean
  onUpdate: (json: JSONContent) => void
  onSelectionChange: (range: { from: number; to: number }) => void
  onReady: () => void
}

const DEFAULT_CONTENT_FROM_BIKE_DM_XML =
  getDescriptionInnerXmlFromDmXml(bikeDmSampleXml)

function normalizeEditorContentInput(
  content: JSONContent | string | undefined,
): JSONContent | string | undefined {
  if (typeof content !== 'string') return content
  return preprocessS1000dDescriptionHtmlFragment(content)
}

const FALLBACK_DOCUMENT: JSONContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: '（未能从 Bike DM XML 解析出 description，请检查 data/bikeDmSample.xml）',
        },
      ],
    },
  ],
}

const DOC_TITLE_PLACEHOLDER = '数据模块标题 DMC-XXXX-XX-XXXX-XX-A-D'

const UNIT_PRESETS = ['ph01(h)', 'mm', 'in', 'deg']

export const IETMEditor = forwardRef<IETMEditorRefValue, IETMEditorProps>(
  function IETMEditor(props, ref) {
    const readyFiredRef = useRef(false)
    const selectionAnchorRef = useRef<string>('')

    const [menuOpen, setMenuOpen] = useState<
      null | 'file' | 'edit' | 'insert'
    >(null)

    const [propertiesDismissed, setPropertiesDismissed] = useState(false)

    const editor = useEditor({
      immediatelyRender: false,
      editable: props.editable,
      extensions: [
        StarterKit.configure({
          bulletList: { keepMarks: true },
          orderedList: { keepMarks: true },
        }),
        TextStyleKit.configure({
          lineHeight: false,
        }),
        Underline,
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
        Highlight.configure({ multicolor: true }),
        IETMImage.configure({
          resize: false,
        }),
        ...s1000dPhase1Nodes,
      ],
      content:
        normalizeEditorContentInput(props.initialContent) ??
        DEFAULT_CONTENT_FROM_BIKE_DM_XML ??
        FALLBACK_DOCUMENT,
      editorProps: {
        attributes: {
          class: 'ietm-tiptap-root',
          spellcheck: 'false',
        },
      },
      onUpdate: ({ editor }) => props.onUpdate(editor.getJSON()),
      onSelectionUpdate: ({ editor }) => {
        props.onSelectionChange({
          from: editor.state.selection.from,
          to: editor.state.selection.to,
        })

        const anchorKey = `${editor.state.selection.anchor}-${editor.state.selection.head}`
        if (anchorKey !== selectionAnchorRef.current) {
          selectionAnchorRef.current = anchorKey
          setPropertiesDismissed(false)
        }
      },
    })

    useEffect(() => {
      if (!editor) return
      editor.setEditable(props.editable)
    }, [editor, props.editable])

    useEffect(() => {
      if (!editor || readyFiredRef.current) return
      readyFiredRef.current = true
      props.onReady()
    }, [editor, props])

    useImperativeHandle(
      ref,
      () => ({
        setContent: (content) => {
          editor?.commands.setContent(normalizeEditorContentInput(content) ?? '')
        },
        getJSON: () => editor?.getJSON() ?? { type: 'doc', content: [] },
        focus: () => {
          editor?.commands.focus()
        },
      }),
      [editor],
    )

    const resolvedTarget: InspectTarget | null = editor
      ? resolveInspectable(editor)
      : null

    const showPropertyPanel =
      resolvedTarget !== null && !propertiesDismissed

    const inspectStableKey = resolvedTarget
      ? `${resolvedTarget.kind}-${resolvedTarget.pos}`
      : null

    useEffect(() => {
      if (inspectStableKey === null) setPropertiesDismissed(false)
    }, [inspectStableKey])

    if (!editor) {
      return null
    }

    const insertTable = () =>
      editor
        .chain()
        .focus()
        .insertContent(createMinimalS1000dTableInsertJson(4, 1, 3))
        .run()

    const insertImageFromPrompt = () => {
      const url = window.prompt('请输入图片 URL')
      if (!url) return
      editor.chain().focus().setImage({ src: url }).run()
    }

    const closeMenus = () => setMenuOpen(null)

    const toggleMenu = (id: typeof menuOpen) =>
      setMenuOpen((prev) => (prev === id ? null : id))

    const applyImageAttrs = (attrs: Record<string, unknown>) => {
      if (!resolvedTarget || resolvedTarget.kind !== 'image') return
      editor
        .chain()
        .focus()
        .setNodeSelection(resolvedTarget.pos)
        .updateAttributes('image', attrs)
        .run()
    }

    return (
      <div className="ietm-editor-root">
        <div className="ietm-editor-chrome">
        <header className="ietm-app-header">
          <nav className="ietm-app-nav" aria-label="主菜单">
            <div className="ietm-menu">
              <button
                type="button"
                className={`ietm-menu-trigger ${menuOpen === 'file' ? 'is-open' : ''}`}
                aria-expanded={menuOpen === 'file'}
                onClick={() => toggleMenu('file')}
              >
                文件
              </button>
              {menuOpen === 'file' ? (
                <div className="ietm-menu-dropdown" role="menu">
                  <button type="button" className="ietm-menu-item" disabled>
                    新建（占位）
                  </button>
                  <button type="button" className="ietm-menu-item" disabled>
                    打开（占位）
                  </button>
                </div>
              ) : null}
            </div>

            <div className="ietm-menu">
              <button
                type="button"
                className={`ietm-menu-trigger ${menuOpen === 'edit' ? 'is-open' : ''}`}
                aria-expanded={menuOpen === 'edit'}
                onClick={() => toggleMenu('edit')}
              >
                编辑
              </button>
              {menuOpen === 'edit' ? (
                <div className="ietm-menu-dropdown" role="menu">
                  <button
                    type="button"
                    className="ietm-menu-item"
                    onClick={() => {
                      editor.chain().focus().undo().run()
                      closeMenus()
                    }}
                  >
                    撤销
                  </button>
                  <button
                    type="button"
                    className="ietm-menu-item"
                    onClick={() => {
                      editor.chain().focus().redo().run()
                      closeMenus()
                    }}
                  >
                    重做
                  </button>
                </div>
              ) : null}
            </div>

            <div className="ietm-menu">
              <button
                type="button"
                className={`ietm-menu-trigger ${menuOpen === 'insert' ? 'is-open' : ''}`}
                aria-expanded={menuOpen === 'insert'}
                onClick={() => toggleMenu('insert')}
              >
                插入
              </button>
              {menuOpen === 'insert' ? (
                <div className="ietm-menu-dropdown" role="menu">
                  <button
                    type="button"
                    className="ietm-menu-item"
                    onClick={() => {
                      insertTable()
                      closeMenus()
                    }}
                  >
                    插入表格
                  </button>
                  <button
                    type="button"
                    className="ietm-menu-item"
                    onClick={() => {
                      insertImageFromPrompt()
                      closeMenus()
                    }}
                  >
                    插入图片
                  </button>
                </div>
              ) : null}
            </div>

          </nav>

          <div className="ietm-app-header-right">
            <span className="ietm-doc-title">{DOC_TITLE_PLACEHOLDER}</span>
            <button type="button" className="ietm-share-btn" disabled>
              分享
            </button>
            <span className="ietm-user-avatar" aria-hidden>
              A
            </span>
          </div>
        </header>

        <FormatToolbar editor={editor} />
        </div>

        <div className="ietm-app-main">
          <div
            className="ietm-editor-pane"
            onMouseDown={() => closeMenus()}
          >
            <EditorContent editor={editor} className="ietm-editor-surface" />
          </div>

          <aside className="ietm-right-pane">
            {showPropertyPanel && resolvedTarget ? (
              <div className="ietm-property-panel">
                <div className="ietm-property-panel__head">
                  <h2 className="ietm-property-panel__title">属性设置</h2>
                  <button
                    type="button"
                    className="ietm-property-panel__close"
                    onClick={() => setPropertiesDismissed(true)}
                    aria-label="关闭属性面板"
                  >
                    ×
                  </button>
                </div>
                <div className="ietm-property-panel__body">
                  {resolvedTarget.kind === 'image' ? (
                    <>
                      <label className="ietm-prop-field">
                        <span>ID</span>
                        <input
                          type="text"
                          value={String(resolvedTarget.attrs.figureId ?? '')}
                          onChange={(e) =>
                            applyImageAttrs({ figureId: e.target.value })
                          }
                        />
                      </label>
                      <label className="ietm-prop-field">
                        <span>unitOfMeasure</span>
                        <select
                          value={String(
                            resolvedTarget.attrs.unitOfMeasure ?? '',
                          )}
                          onChange={(e) =>
                            applyImageAttrs({
                              unitOfMeasure: e.target.value,
                            })
                          }
                        >
                          {UNIT_PRESETS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="ietm-prop-field">
                        <span>宽度（px）</span>
                        <input
                          type="text"
                          value={
                            resolvedTarget.attrs.width != null
                              ? String(resolvedTarget.attrs.width)
                              : ''
                          }
                          placeholder="自动"
                          onChange={(e) => {
                            const v = e.target.value.trim()
                            const n = Number.parseInt(v, 10)
                            applyImageAttrs({
                              width: v === '' || Number.isNaN(n) ? null : n,
                            })
                          }}
                        />
                      </label>
                      <label className="ietm-prop-field">
                        <span>高度（px）</span>
                        <input
                          type="text"
                          value={
                            resolvedTarget.attrs.height != null
                              ? String(resolvedTarget.attrs.height)
                              : ''
                          }
                          placeholder="自动"
                          onChange={(e) => {
                            const v = e.target.value.trim()
                            const n = Number.parseInt(v, 10)
                            applyImageAttrs({
                              height: v === '' || Number.isNaN(n) ? null : n,
                            })
                          }}
                        />
                      </label>
                    </>
                  ) : null}

                  {resolvedTarget.kind === 'table' ? (
                    <>
                      <p className="ietm-prop-hint">
                        表格结构与样式可通过编辑器直接调整。
                      </p>
                      {(() => {
                        const dim = tableDimensions(editor, resolvedTarget.pos)
                        return dim ? (
                          <>
                            <div className="ietm-prop-readonly">
                              <span>行数</span>
                              <span>{dim.rows}</span>
                            </div>
                            <div className="ietm-prop-readonly">
                              <span>列数</span>
                              <span>{dim.cols}</span>
                            </div>
                          </>
                        ) : null
                      })()}
                    </>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="ietm-preview-placeholder">
                <p>功能开发中，敬请期待</p>
              </div>
            )}
          </aside>
        </div>

        <footer className="ietm-app-footer">
          <span className="ietm-save-status">
            <span className="ietm-save-status__icon" aria-hidden>
              ✓
            </span>
            已保存
          </span>
        </footer>

        {menuOpen ? (
          <button
            type="button"
            className="ietm-menu-backdrop"
            aria-label="关闭菜单"
            onClick={closeMenus}
          />
        ) : null}

      </div>
    )
  },
)
