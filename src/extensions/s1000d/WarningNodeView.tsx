import { NodeSelection } from '@tiptap/pm/state'
import type { NodeViewProps } from '@tiptap/react'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import { Brackets } from 'lucide-react'
import { AttentionBlockContinueHint } from './AttentionBlockContinueHint'
import { AttentionBlockDeleteButton } from './AttentionBlockDeleteButton'
import {
  AttentionBlockSymbolIconButton,
  readFirstAttentionSymbolFromBlock,
} from './attentionBlockSymbolIcon'
import { useNodeViewEditorState } from '../../hooks/useNodeViewEditorState'
import { openInsertSymbolModalForAttentionBlock } from '../../lib/editor/insertSymbols'
import {
  useCallback,
  useEffect,
  useReducer,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'

/** 从文档位置向上解析，判断是否位于 `caution` 内（否则视为 `warning`）。 */
function attentionKindFromPos(
  getPos: (() => number | undefined) | undefined,
  props: NodeViewProps,
): 'warning' | 'caution' {
  const gp = typeof getPos === 'function' ? getPos : undefined
  if (!gp) return 'warning'
  const pos = gp()
  if (pos == null) return 'warning'
  try {
    const { doc } = props.editor.state
    const $pos = doc.resolve(Math.min(pos, doc.content.size))
    for (let d = $pos.depth; d >= 0; d--) {
      const name = $pos.node(d).type.name
      if (name === 'caution') return 'caution'
      if (name === 'warning') return 'warning'
    }
  } catch {
    /* ignore */
  }
  return 'warning'
}

function selectionOnThisAttentionBlock(props: NodeViewProps): {
  nodeSelected: boolean
  caretInside: boolean
} {
  const { editor, getPos, node } = props
  const blockType = node.type.name
  const pos = typeof getPos === 'function' ? getPos() : undefined
  if (pos == null) return { nodeSelected: false, caretInside: false }

  const sel = editor.state.selection
  if (sel instanceof NodeSelection && sel.from === pos) {
    return { nodeSelected: true, caretInside: true }
  }

  const { from } = sel
  let $from
  try {
    $from = editor.state.doc.resolve(from)
  } catch {
    return { nodeSelected: false, caretInside: false }
  }

  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === blockType && $from.before(d) === pos) {
      return { nodeSelected: false, caretInside: true }
    }
  }
  return { nodeSelected: false, caretInside: false }
}

export function WarningTriangleIcon() {
  return (
    <svg
      className="s1000d-attention-lead__icon-svg"
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 3.5L2.5 20h19L12 3.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M12 9v5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17" r="1.25" fill="currentColor" />
    </svg>
  )
}

/** 注意：橙色主题下使用的信息圈「i」图标 */
function CautionInfoIcon() {
  return (
    <svg
      className="s1000d-attention-lead__icon-svg"
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="8.25" r="1.15" fill="currentColor" />
      <path
        d="M12 11.25v6.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * `warningAndCautionLead`：仅可编辑引导文；图标在父级 `warning`/`caution` 左侧固定列展示。
 */
export function WarningAndCautionLeadNodeView(props: NodeViewProps) {
  const kind = attentionKindFromPos(props.getPos, props)
  return (
    <NodeViewWrapper
      as="div"
      className="s1000d-attention-lead"
      data-s1000d-lead-kind={kind}
    >
      <NodeViewContent className="s1000d-attention-lead__text" />
    </NodeViewWrapper>
  )
}

/**
 * `warning` / `caution` 共用外壳：通过 `node.type.name` 区分皮肤与 `data-s1000d-node`。
 * 右上角句柄：hover 或选区在本块内时显示，点击后 `NodeSelection` 选中整块（与 `levelledPara` 一致）。
 */
export function WarningNodeView(props: NodeViewProps) {
  const { editor, getPos, node } = props
  const { readOnly } = useNodeViewEditorState(editor)
  const kind = props.node.type.name === 'caution' ? 'caution' : 'warning'
  const [hovered, setHovered] = useState(false)
  const [, bumpFromDoc] = useReducer((n: number) => n + 1, 0)

  const attentionSymbol = readFirstAttentionSymbolFromBlock(node)
  const hasAttentionSymbol = attentionSymbol != null

  useEffect(() => {
    const bump = () => bumpFromDoc()
    editor.on('selectionUpdate', bump)
    editor.on('transaction', bump)
    return () => {
      editor.off('selectionUpdate', bump)
      editor.off('transaction', bump)
    }
  }, [editor])

  const { nodeSelected, caretInside } = selectionOnThisAttentionBlock(props)
  const showChrome = hovered || caretInside || nodeSelected

  const selectWholeBlock = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.stopPropagation()
      const p = getPos?.()
      if (p == null) return
      editor.chain().focus().setNodeSelection(p).run()
    },
    [editor, getPos],
  )

  const openInsertSymbolFromIcon = useCallback(
    (e: ReactMouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (readOnly) return
      const p = getPos?.()
      if (p == null) return
      openInsertSymbolModalForAttentionBlock(editor, p)
    },
    [editor, getPos, readOnly],
  )

  const blockLabel = kind === 'caution' ? 'caution' : 'warning'
  const wrapClass = showChrome
    ? 's1000d-attention-block-wrap s1000d-attention-block-wrap--chrome'
    : 's1000d-attention-block-wrap'
  const asideClass = showChrome
    ? `s1000d-attention-block s1000d-attention-block--${kind} s1000d-attention-block--chrome`
    : `s1000d-attention-block s1000d-attention-block--${kind}`

  return (
    <NodeViewWrapper
      as="div"
      className={wrapClass}
      data-s1000d-node={kind}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={(e: ReactMouseEvent<HTMLDivElement>) => {
        const next = e.relatedTarget
        if (next instanceof globalThis.Node && e.currentTarget.contains(next)) return
        setHovered(false)
      }}
    >
      <aside className={asideClass} role="note">
      <AttentionBlockDeleteButton
        editor={editor}
        getPos={getPos}
        blockLabel={blockLabel}
      />
      <button
        type="button"
        className="s1000d-attention-block__block-handle"
        contentEditable={false}
        tabIndex={-1}
        aria-label={`选中整块 ${blockLabel}`}
        title="选中整块"
        onMouseDown={selectWholeBlock}
      >
        <Brackets size={14} strokeWidth={2} aria-hidden />
      </button>
      <div className="s1000d-attention-block__row">
        <div className="s1000d-attention-block__icon-col">
          <AttentionBlockSymbolIconButton
            readOnly={readOnly}
            symbol={attentionSymbol}
            ariaLabelInsert={
              kind === 'caution' ? '插入注意符号' : '插入警告符号'
            }
            ariaLabelReplace={
              kind === 'caution' ? '更换注意符号' : '更换警告符号'
            }
            onPick={openInsertSymbolFromIcon}
            defaultIcon={
              kind === 'caution' ? <CautionInfoIcon /> : <WarningTriangleIcon />
            }
          />
        </div>
        <NodeViewContent
          className={
            hasAttentionSymbol
              ? 's1000d-attention-block__content-col s1000d-attention-block__content-col--hide-inline-symbol'
              : 's1000d-attention-block__content-col'
          }
        />
      </div>
      </aside>
      <AttentionBlockContinueHint
        editor={editor}
        getPos={getPos}
        node={node}
        visible={showChrome}
      />
    </NodeViewWrapper>
  )
}

/**
 * 每个 `warningAndCautionPara` 对应正文区的一块（与 S1000D 一致：同壳内前导与 attention 列表为同级块流，不用 ol/li）。
 * `caution` 与 `warning` 共用同一节点类型时也会使用该视图（可用父节点区分后加样式）。
 */
export function WarningAndCautionParaNodeView(props: NodeViewProps) {
  void props
  return (
    <NodeViewWrapper as="div" className="s1000d-attention-block__body-item">
      <NodeViewContent className="s1000d-attention-block__body-item__content" />
    </NodeViewWrapper>
  )
}
