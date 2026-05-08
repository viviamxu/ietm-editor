import type { MouseEvent as ReactMouseEvent } from 'react'
import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper } from '@tiptap/react'

import { navigateInternalRefTarget } from '../../lib/editor/internalRefNavigate'

import { describeInternalRefTargetType } from './internalRefLabels'

/**
 * `internalRef` 行内 NodeView：
 * — 整块 chip 原生 `title` 悬浮展示「类型 · ID」（符合「悬浮查看引用对象类型与 ID」）；
 * — 箭头按钮独占点击，执行跳转与目标闪烁；
 * — `mousedown` preventDefault，避免拖动/选区被按钮抢走焦点。
 */
export function InternalRefNodeView(props: NodeViewProps) {
  const { editor, node } = props
  void props

  const refId = String(node.attrs.internalRefId ?? '').trim()
  const irrtt = node.attrs.internalRefTargetType as string | undefined | null
  const typeLabel = describeInternalRefTargetType(irrtt)
  const titleText = `${typeLabel} · ID：${refId || '（未设置）'}`

  const onArrowClick = (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    navigateInternalRefTarget(editor, refId)
  }

  return (
    <NodeViewWrapper
      as="span"
      className="s1000d-internal-ref"
      data-internal-ref-id={refId || undefined}
      data-internal-ref-type={irrtt ?? undefined}
      contentEditable={false}
    >
      <span className="s1000d-internal-ref__chip" title={titleText}>
        {refId ? <span className="s1000d-internal-ref__id">{refId}</span> : (
          <span className="s1000d-internal-ref__missing">?</span>
        )}
      </span>
      <button
        type="button"
        className="s1000d-internal-ref__jump"
        title={titleText}
        aria-label={`跳转至引用目标：${titleText}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onArrowClick}
      >
        ↗
      </button>
    </NodeViewWrapper>
  )
}
