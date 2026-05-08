import type { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'

const FLASH_MS = 1000
const FLASH_CLASS = 's1000d-internal-ref-target-flash'

/**
 * 在当前文档内按元素的 `id` 属性查找可被内部引用指向的节点（`figure`、`para`、`table` 等）。
 * @returns 块节点的文档起始位置。
 */
export function findDocPosByElementId(editor: Editor, refId: string): number | null {
  let found: number | null = null
  editor.state.doc.descendants((node, pos) => {
    if (found !== null) return
    const idAttr =
      typeof node.attrs.id === 'string' ? node.attrs.id : null
    if (!idAttr || idAttr !== refId) return
    const isTarget =
      node.type.name === 'figure' ||
      node.type.name === 'para' ||
      node.type.name === 'table'
    if (isTarget) {
      found = pos
    }
  })
  return found
}

export function flashRefTargetInDom(editor: Editor, refId: string): void {
  const root = editor.view.dom
  let target: HTMLElement | null = null
  for (const el of Array.from(root.querySelectorAll('[id]'))) {
    if (!(el instanceof HTMLElement)) continue
    if (el.id !== refId) continue
    const tag = el.localName.toLowerCase()
    if (tag === 'figure' || tag === 'para' || tag === 'table') {
      target = el
      break
    }
  }
  if (!target) return
  try {
    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  } catch {
    target.scrollIntoView()
  }
  target.classList.add(FLASH_CLASS)
  window.setTimeout(() => target?.classList.remove(FLASH_CLASS), FLASH_MS)
}

/**
 * NodeSelection 定位目标块，再在 DOM 上闪烁提示约 1 秒。
 */
export function navigateInternalRefTarget(editor: Editor, refId: string): void {
  const trimmed = refId.trim()
  if (!trimmed) return

  const pos = findDocPosByElementId(editor, trimmed)
  if (pos === null) {
    editor.chain().focus().run()
    return
  }

  const tr = editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos)).scrollIntoView()

  editor.view.dispatch(tr)

  requestAnimationFrame(() => flashRefTargetInDom(editor, trimmed))
}
