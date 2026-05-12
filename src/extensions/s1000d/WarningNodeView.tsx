import type { NodeViewProps } from '@tiptap/react'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'

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

export function WarningTriangleIcon() {
  return (
    <svg
      className="s1000d-attention-lead__icon-svg"
      width="20"
      height="20"
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
      width="20"
      height="20"
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
 * `warningAndCautionLead`：图标 + 可编辑引导文同一行，与示意稿一致。
 */
export function WarningAndCautionLeadNodeView(props: NodeViewProps) {
  const kind = attentionKindFromPos(props.getPos, props)
  return (
    <NodeViewWrapper
      as="div"
      className="s1000d-attention-lead"
      data-s1000d-lead-kind={kind}
    >
      <span className="s1000d-attention-lead__icon" contentEditable={false} aria-hidden>
        {kind === 'caution' ? <CautionInfoIcon /> : <WarningTriangleIcon />}
      </span>
      <NodeViewContent className="s1000d-attention-lead__text" />
    </NodeViewWrapper>
  )
}

/**
 * `warning` / `caution` 共用外壳：通过 `node.type.name` 区分皮肤与 `data-s1000d-node`。
 */
export function WarningNodeView(props: NodeViewProps) {
  const kind = props.node.type.name === 'caution' ? 'caution' : 'warning'
  return (
    <NodeViewWrapper
      as="aside"
      className={`s1000d-attention-block s1000d-attention-block--${kind}`}
      data-s1000d-node={kind}
      role="note"
    >
      <NodeViewContent className="s1000d-attention-block__body" />
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