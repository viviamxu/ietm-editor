import type { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'

export type InspectKind = 'image' | 'table' | 's1000dApplicability'

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
  node.forEach((row) => {
    if (row.type.name === 'tableRow') {
      rows++
      if (cols === 0) cols = row.childCount
    }
  })
  return { rows, cols }
}
