import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { NodeSelection } from '@tiptap/pm/state'

type TableAction =
  | 'insertRowAbove'
  | 'insertRowBelow'
  | 'deleteRow'
  | 'insertColLeft'
  | 'insertColRight'
  | 'deleteCol'
  | 'mergeCells'
  | 'splitCell'
  | 'deleteCell'
  | 'clearCell'
  | 'deleteTable'

interface CellContext {
  table: PMNode
  tablePos: number
  tgroup: PMNode
  tgroupIndex: number
  section: PMNode
  sectionIndex: number
  row: PMNode
  rowIndex: number
  entry: PMNode
  entryIndex: number
}

const emptyParaJson = { type: 'para' }

function createEmptyEntry(editor: Editor) {
  return editor.schema.nodeFromJSON({
    type: 'entry',
    content: [emptyParaJson],
  })
}

function createEmptyRow(editor: Editor, cols: number) {
  const entries = Array.from({ length: Math.max(1, cols) }, () =>
    createEmptyEntry(editor),
  )
  return editor.schema.nodes.row.create(null, entries)
}

function colNumber(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const match = /^col(\d+)$/.exec(value)
  if (!match) return null
  const n = Number.parseInt(match[1], 10)
  return Number.isNaN(n) ? null : n
}

function entryColSpan(entry: PMNode): number {
  const start = colNumber(entry.attrs.namest)
  const end = colNumber(entry.attrs.nameend)
  if (start != null && end != null && end >= start) return end - start + 1
  return 1
}

function entryRowSpan(entry: PMNode): number {
  const raw = Number.parseInt(String(entry.attrs.morerows ?? '0'), 10)
  return Number.isNaN(raw) ? 1 : Math.max(1, raw + 1)
}

function tgroupColumnCount(tgroup: PMNode): number {
  const attrCols = Number.parseInt(String(tgroup.attrs.cols ?? ''), 10)
  let max = Number.isNaN(attrCols) ? 0 : attrCols
  tgroup.forEach((section) => {
    if (section.type.name !== 'thead' && section.type.name !== 'tbody') return
    section.forEach((row) => {
      if (row.type.name !== 'row') return
      let cols = 0
      row.forEach((entry) => {
        if (entry.type.name === 'entry') cols += entryColSpan(entry)
      })
      max = Math.max(max, cols)
    })
  })
  return Math.max(1, max)
}

function contentArray(node: PMNode): PMNode[] {
  const out: PMNode[] = []
  node.forEach((child) => out.push(child))
  return out
}

function findCellContext(editor: Editor, endpoint: 'anchor' | 'head'): CellContext | null {
  const selection = editor.state.selection
  const $pos = endpoint === 'anchor' ? selection.$anchor : selection.$head

  let tableDepth = -1
  let tgroupDepth = -1
  let sectionDepth = -1
  let rowDepth = -1
  let entryDepth = -1

  for (let d = $pos.depth; d > 0; d--) {
    const name = $pos.node(d).type.name
    if (entryDepth < 0 && name === 'entry') entryDepth = d
    if (rowDepth < 0 && name === 'row') rowDepth = d
    if (sectionDepth < 0 && (name === 'thead' || name === 'tbody')) sectionDepth = d
    if (tgroupDepth < 0 && name === 'tgroup') tgroupDepth = d
    if (tableDepth < 0 && name === 'table') tableDepth = d
  }

  if (
    tableDepth < 0 ||
    tgroupDepth < 0 ||
    sectionDepth < 0 ||
    rowDepth < 0 ||
    entryDepth < 0
  ) {
    return null
  }

  return {
    table: $pos.node(tableDepth),
    tablePos: $pos.before(tableDepth),
    tgroup: $pos.node(tgroupDepth),
    tgroupIndex: $pos.index(tableDepth),
    section: $pos.node(sectionDepth),
    sectionIndex: $pos.index(tgroupDepth),
    row: $pos.node(rowDepth),
    rowIndex: $pos.index(sectionDepth),
    entry: $pos.node(entryDepth),
    entryIndex: $pos.index(rowDepth),
  }
}

function findTableContext(editor: Editor): Pick<CellContext, 'table' | 'tablePos'> | null {
  const cell = findCellContext(editor, 'anchor')
  if (cell) return { table: cell.table, tablePos: cell.tablePos }

  const { selection } = editor.state
  if (selection instanceof NodeSelection && selection.node.type.name === 'table') {
    return { table: selection.node, tablePos: selection.from }
  }
  return null
}

function replaceTgroup(editor: Editor, ctx: CellContext, nextTgroup: PMNode): boolean {
  const tableChildren = contentArray(ctx.table)
  tableChildren[ctx.tgroupIndex] = nextTgroup
  const nextTable = ctx.table.type.create(ctx.table.attrs, tableChildren)
  const tr = editor.state.tr.replaceWith(
    ctx.tablePos,
    ctx.tablePos + ctx.table.nodeSize,
    nextTable,
  )
  editor.view.dispatch(tr.scrollIntoView())
  return true
}

function clearEntry(editor: Editor, entry: PMNode) {
  return entry.type.create(entry.attrs, [editor.schema.nodes.para.create()])
}

function clearEntrySpan(entry: PMNode) {
  return {
    ...entry.attrs,
    namest: null,
    nameend: null,
    morerows: null,
  }
}

function updateTgroupCols(tgroup: PMNode, cols: number, children: PMNode[]) {
  return tgroup.type.create(
    {
      ...tgroup.attrs,
      cols: String(Math.max(1, cols)),
    },
    children,
  )
}

function mutateSectionRows(
  tgroup: PMNode,
  sectionIndex: number,
  mutate: (rows: PMNode[], section: PMNode) => PMNode[],
): PMNode[] {
  return contentArray(tgroup).map((section, index) => {
    if (index !== sectionIndex) return section
    return section.type.create(section.attrs, mutate(contentArray(section), section))
  })
}

function insertRow(editor: Editor, below: boolean): boolean {
  const ctx = findCellContext(editor, 'anchor')
  if (!ctx) return false
  const cols = tgroupColumnCount(ctx.tgroup)
  const tgroupChildren = mutateSectionRows(ctx.tgroup, ctx.sectionIndex, (rows) => {
    const nextRows = [...rows]
    nextRows.splice(ctx.rowIndex + (below ? 1 : 0), 0, createEmptyRow(editor, cols))
    return nextRows
  })
  return replaceTgroup(editor, ctx, updateTgroupCols(ctx.tgroup, cols, tgroupChildren))
}

function deleteRow(editor: Editor): boolean {
  const ctx = findCellContext(editor, 'anchor')
  if (!ctx) return false
  const cols = tgroupColumnCount(ctx.tgroup)
  const tgroupChildren = contentArray(ctx.tgroup)
  const rows = contentArray(ctx.section)

  if (ctx.section.type.name === 'thead' && rows.length === 1) {
    tgroupChildren.splice(ctx.sectionIndex, 1)
  } else if (rows.length === 1) {
    tgroupChildren[ctx.sectionIndex] = ctx.section.type.create(ctx.section.attrs, [
      createEmptyRow(editor, cols),
    ])
  } else {
    rows.splice(ctx.rowIndex, 1)
    tgroupChildren[ctx.sectionIndex] = ctx.section.type.create(ctx.section.attrs, rows)
  }

  return replaceTgroup(editor, ctx, updateTgroupCols(ctx.tgroup, cols, tgroupChildren))
}

function insertColumn(editor: Editor, right: boolean): boolean {
  const ctx = findCellContext(editor, 'anchor')
  if (!ctx) return false
  const cols = tgroupColumnCount(ctx.tgroup)
  const insertAt = ctx.entryIndex + (right ? 1 : 0)
  const tgroupChildren = contentArray(ctx.tgroup).map((section) => {
    if (section.type.name !== 'thead' && section.type.name !== 'tbody') return section
    const rows = contentArray(section).map((row) => {
      const entries = contentArray(row)
      entries.splice(Math.min(insertAt, entries.length), 0, createEmptyEntry(editor))
      return row.type.create(row.attrs, entries)
    })
    return section.type.create(section.attrs, rows)
  })
  return replaceTgroup(editor, ctx, updateTgroupCols(ctx.tgroup, cols + 1, tgroupChildren))
}

function deleteColumn(editor: Editor): boolean {
  const ctx = findCellContext(editor, 'anchor')
  if (!ctx) return false
  const cols = tgroupColumnCount(ctx.tgroup)
  const deleteAt = ctx.entryIndex

  if (cols <= 1) {
    return clearCell(editor)
  }

  const tgroupChildren = contentArray(ctx.tgroup).map((section) => {
    if (section.type.name !== 'thead' && section.type.name !== 'tbody') return section
    const rows = contentArray(section).map((row) => {
      const entries = contentArray(row)
      if (entries.length > deleteAt) entries.splice(deleteAt, 1)
      if (entries.length === 0) entries.push(createEmptyEntry(editor))
      return row.type.create(row.attrs, entries)
    })
    return section.type.create(section.attrs, rows)
  })

  return replaceTgroup(editor, ctx, updateTgroupCols(ctx.tgroup, cols - 1, tgroupChildren))
}

function clearCell(editor: Editor): boolean {
  const ctx = findCellContext(editor, 'anchor')
  if (!ctx) return false
  const rows = contentArray(ctx.section)
  const entries = contentArray(ctx.row)
  entries[ctx.entryIndex] = clearEntry(editor, ctx.entry)
  rows[ctx.rowIndex] = ctx.row.type.create(ctx.row.attrs, entries)
  const tgroupChildren = mutateSectionRows(ctx.tgroup, ctx.sectionIndex, () => rows)
  return replaceTgroup(editor, ctx, updateTgroupCols(ctx.tgroup, tgroupColumnCount(ctx.tgroup), tgroupChildren))
}

function deleteCell(editor: Editor): boolean {
  const ctx = findCellContext(editor, 'anchor')
  if (!ctx) return false
  const cols = tgroupColumnCount(ctx.tgroup)
  const rows = contentArray(ctx.section)
  const entries = contentArray(ctx.row)
  entries.splice(ctx.entryIndex, 1)
  entries.push(createEmptyEntry(editor))
  rows[ctx.rowIndex] = ctx.row.type.create(ctx.row.attrs, entries)
  const tgroupChildren = mutateSectionRows(ctx.tgroup, ctx.sectionIndex, () => rows)
  return replaceTgroup(editor, ctx, updateTgroupCols(ctx.tgroup, cols, tgroupChildren))
}

function mergeContent(editor: Editor, entries: PMNode[]) {
  const children: PMNode[] = []
  entries.forEach((entry) => {
    entry.forEach((child) => {
      if (child.type.name !== 'para' || child.textContent.trim() !== '') {
        children.push(child)
      }
    })
  })
  return children.length > 0 ? children : [editor.schema.nodes.para.create()]
}

function mergeCells(editor: Editor): boolean {
  const anchor = findCellContext(editor, 'anchor')
  const head = findCellContext(editor, 'head')
  if (!anchor || !head) return false
  if (anchor.tablePos !== head.tablePos || anchor.sectionIndex !== head.sectionIndex) return false

  const rowStart = Math.min(anchor.rowIndex, head.rowIndex)
  const rowEnd = Math.max(anchor.rowIndex, head.rowIndex)
  const colStart = Math.min(anchor.entryIndex, head.entryIndex)
  const colEnd = Math.max(anchor.entryIndex, head.entryIndex)
  if (rowStart === rowEnd && colStart === colEnd) return false

  const rowSpan = rowEnd - rowStart + 1
  const colSpan = colEnd - colStart + 1
  const rows = contentArray(anchor.section)
  const collected: PMNode[] = []

  for (let r = rowStart; r <= rowEnd; r += 1) {
    const entries = contentArray(rows[r])
    collected.push(...entries.slice(colStart, colEnd + 1))
  }

  for (let r = rowEnd; r >= rowStart; r -= 1) {
    const row = rows[r]
    const entries = contentArray(row)
    entries.splice(colStart, colSpan)
    if (r === rowStart) {
      const first = collected[0]
      entries.splice(
        colStart,
        0,
        first.type.create(
          {
            ...clearEntrySpan(first),
            namest: colSpan > 1 ? `col${colStart + 1}` : null,
            nameend: colSpan > 1 ? `col${colEnd + 1}` : null,
            morerows: rowSpan > 1 ? String(rowSpan - 1) : null,
          },
          mergeContent(editor, collected),
        ),
      )
    }
    rows[r] = row.type.create(row.attrs, entries.length > 0 ? entries : [createEmptyEntry(editor)])
  }

  const tgroupChildren = mutateSectionRows(anchor.tgroup, anchor.sectionIndex, () => rows)
  return replaceTgroup(
    editor,
    anchor,
    updateTgroupCols(anchor.tgroup, tgroupColumnCount(anchor.tgroup), tgroupChildren),
  )
}

function splitCell(editor: Editor): boolean {
  const ctx = findCellContext(editor, 'anchor')
  if (!ctx) return false
  const colSpan = entryColSpan(ctx.entry)
  const rowSpan = entryRowSpan(ctx.entry)
  if (colSpan === 1 && rowSpan === 1) return false

  const rows = contentArray(ctx.section)
  const firstEntries = contentArray(rows[ctx.rowIndex])
  firstEntries[ctx.entryIndex] = ctx.entry.type.create(
    clearEntrySpan(ctx.entry),
    ctx.entry.content,
  )
  for (let i = 1; i < colSpan; i += 1) {
    firstEntries.splice(ctx.entryIndex + i, 0, createEmptyEntry(editor))
  }
  rows[ctx.rowIndex] = rows[ctx.rowIndex].type.create(rows[ctx.rowIndex].attrs, firstEntries)

  for (let r = 1; r < rowSpan; r += 1) {
    const rowIndex = ctx.rowIndex + r
    if (rowIndex >= rows.length) break
    const entries = contentArray(rows[rowIndex])
    for (let c = 0; c < colSpan; c += 1) {
      entries.splice(ctx.entryIndex + c, 0, createEmptyEntry(editor))
    }
    rows[rowIndex] = rows[rowIndex].type.create(rows[rowIndex].attrs, entries)
  }

  const tgroupChildren = mutateSectionRows(ctx.tgroup, ctx.sectionIndex, () => rows)
  return replaceTgroup(editor, ctx, updateTgroupCols(ctx.tgroup, tgroupColumnCount(ctx.tgroup), tgroupChildren))
}

function deleteTable(editor: Editor): boolean {
  const ctx = findTableContext(editor)
  if (!ctx) return false
  const tr = editor.state.tr.delete(ctx.tablePos, ctx.tablePos + ctx.table.nodeSize)
  editor.view.dispatch(tr.scrollIntoView())
  return true
}

export function canRunS1000dTableAction(editor: Editor, action: TableAction): boolean {
  if (action === 'deleteTable') return findTableContext(editor) != null
  const ctx = findCellContext(editor, 'anchor')
  if (!ctx) return false
  if (action === 'mergeCells') {
    const head = findCellContext(editor, 'head')
    return !!head && (ctx.rowIndex !== head.rowIndex || ctx.entryIndex !== head.entryIndex)
  }
  if (action === 'splitCell') {
    return entryColSpan(ctx.entry) > 1 || entryRowSpan(ctx.entry) > 1
  }
  return true
}

export function runS1000dTableAction(editor: Editor, action: TableAction): boolean {
  switch (action) {
    case 'insertRowAbove':
      return insertRow(editor, false)
    case 'insertRowBelow':
      return insertRow(editor, true)
    case 'deleteRow':
      return deleteRow(editor)
    case 'insertColLeft':
      return insertColumn(editor, false)
    case 'insertColRight':
      return insertColumn(editor, true)
    case 'deleteCol':
      return deleteColumn(editor)
    case 'mergeCells':
      return mergeCells(editor)
    case 'splitCell':
      return splitCell(editor)
    case 'deleteCell':
      return deleteCell(editor)
    case 'clearCell':
      return clearCell(editor)
    case 'deleteTable':
      return deleteTable(editor)
    default:
      return false
  }
}
