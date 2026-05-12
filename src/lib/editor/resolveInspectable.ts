import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { NodeSelection } from '@tiptap/pm/state'

export type InspectKind = 'image' | 'table' | 's1000dApplicability'

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
  kind: InspectKind
  pos: number
  attrs: Record<string, unknown>
}

export function resolveInspectable(editor: Editor): InspectTarget | null {
  const { selection } = editor.state

  if (selection instanceof NodeSelection) {
    const node = selection.node
    if (node.type.name === 'image') {
      return {
        kind: 'image',
        pos: selection.from,
        attrs: { ...node.attrs },
      }
    }
    if (node.type.name === 'table') {
      return {
        kind: 'table',
        pos: selection.from,
        attrs: { ...node.attrs },
      }
    }
    if (node.type.name === 's1000dApplicability') {
      return {
        kind: 's1000dApplicability',
        pos: selection.from,
        attrs: { ...node.attrs },
      }
    }
  }

  const $from = selection.$from
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (node.type.name === 'table') {
      return {
        kind: 'table',
        pos: $from.before(d),
        attrs: { ...node.attrs },
      }
    }
  }

  return null
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
