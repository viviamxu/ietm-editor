import type { NodeViewProps } from '@tiptap/react'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'

function WarningTriangleIcon() {
  return (
    <svg
      className="s1000d-attention-block__icon-svg"
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
      {/* <header className="s1000d-attention-block__header" contentEditable={false}>
        <span className="s1000d-attention-block__icon-wrap" aria-hidden>
          <WarningTriangleIcon />
        </span>
      </header> */}
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