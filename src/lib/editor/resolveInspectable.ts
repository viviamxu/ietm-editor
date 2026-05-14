import type { Editor } from '@tiptap/core'
import type { Node as PMNode, ResolvedPos } from '@tiptap/pm/model'
import { NodeSelection } from '@tiptap/pm/state'

import { INSPECTABLE_NODE_TYPES } from './inspectableNodeTypes'

/** 位于容器内的「正文」块：优先展示外层结构（如 `entry`、`note`）而非内层段落。 */
const INNER_INSPECT_DEFER = new Set<string>([
  'para',
  'notePara',
  'warningAndCautionPara',
])

/** 当光标处于 INNER_INSPECT_DEFER 内时，若路径上存在以下类型，则检视该外层节点。 */
const OUTRANKS_INNER_DEFER = new Set<string>([
  'entry',
  'tgroup',
  'table',
  'warning',
  'caution',
  'note',
])

function countEntryCellsInRow(row: PMNode): number {
  let n = 0
  row.forEach((c) => {
    if (c.type.name === 'entry') n += 1
  })
  return n
}

function accumulateTgroupGrid(tgroup: PMNode): {
  rows: number
  cols: number
} {
  let rows = 0
  let cols = 0
  tgroup.forEach((section) => {
    if (section.type.name !== 'thead' && section.type.name !== 'tbody') return
    section.forEach((r) => {
      if (r.type.name !== 'row') return
      rows += 1
      cols = Math.max(cols, countEntryCellsInRow(r))
    })
  })
  return { rows, cols }
}

export interface InspectTarget {
  /** ProseMirror / Tiptap 节点类型名，如 `levelledPara`、`para`、`image` */
  nodeType: string
  pos: number
  attrs: Record<string, unknown>
}

function inspectableTargetFromNode(
  nodeType: string,
  pos: number,
  attrs: Record<string, unknown>,
): InspectTarget {
  return { nodeType, pos, attrs }
}

/**
 * 自内向外查找可检视节点；对 `para` / `notePara` / `warningAndCautionPara` 做延迟，
 * 以便在表格单元格、note、warning 等容器内优先检视外层结构。
 */
function resolveInspectableFromResolved($from: ResolvedPos): InspectTarget | null {
  let innerDeferFallback: InspectTarget | null = null
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (!INSPECTABLE_NODE_TYPES.has(node.type.name)) continue
    const pos = $from.before(d)
    const attrs = { ...node.attrs } as Record<string, unknown>
    const t = inspectableTargetFromNode(node.type.name, pos, attrs)

    if (INNER_INSPECT_DEFER.has(node.type.name)) {
      innerDeferFallback = t
      continue
    }
    if (innerDeferFallback && OUTRANKS_INNER_DEFER.has(node.type.name)) return t
    if (!innerDeferFallback) return t
  }
  return innerDeferFallback
}

export function resolveInspectable(editor: Editor): InspectTarget | null {
  const { selection } = editor.state

  if (selection instanceof NodeSelection) {
    const node = selection.node
    if (INSPECTABLE_NODE_TYPES.has(node.type.name)) {
      return inspectableTargetFromNode(node.type.name, selection.from, {
        ...node.attrs,
      })
    }
  }

  return resolveInspectableFromResolved(selection.$from)
}

export function tableDimensions(editor: Editor, tablePos: number) {
  const node = editor.state.doc.nodeAt(tablePos)
  if (!node || node.type.name !== 'table') return null
  let rows = 0
  let cols = 0
  node.forEach((child) => {
    if (child.type.name !== 'tgroup') return
    const chunk = accumulateTgroupGrid(child)
    rows += chunk.rows
    cols = Math.max(cols, chunk.cols)
  })
  return rows > 0 ? { rows, cols } : null
}
