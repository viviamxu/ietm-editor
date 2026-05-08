import type { NodeViewProps } from '@tiptap/react'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'

function WarningTriangleIcon() {
  return (
    <svg
      className="s1000d-warning__icon-svg"
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
 * `warning` 的外壳：内部仍为可编辑的 `warningAndCautionPara+` 结构。
 */
export function WarningNodeView(props: NodeViewProps) {
  void props
  return (
    <NodeViewWrapper
      as="aside"
      className="s1000d-warning"
      data-s1000d-node="warning"
      role="note"
    >
      <header className="s1000d-warning__header" contentEditable={false}>
        <span className="s1000d-warning__icon-wrap" aria-hidden>
          <WarningTriangleIcon />
        </span>
        <span className="s1000d-warning__title">警告文本</span>
      </header>
      <NodeViewContent className="s1000d-warning__body" />
    </NodeViewWrapper>
  )
}
