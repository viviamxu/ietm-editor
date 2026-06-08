import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { ResolvedPos } from '@tiptap/pm/model'
import { PluginKey } from '@tiptap/pm/state'

/** Plugin 内维护的拖拽单元格选区 */
export type TableCellSelectionState = {
  anchor: TableCellAddress
  head: TableCellAddress
} | null

export const tableSelectionPluginKey = new PluginKey<TableCellSelectionState>(
  's1000dTableSelection',
)

/** 单元格在文档中的逻辑坐标 */
export type TableCellAddress = {
  tablePos: number
  tgroupIndex: number
  sectionIndex: number
  sectionType: 'thead' | 'tbody'
  rowIndex: number
  entryIndex: number
}

export type TableCellRange = {
  anchor: TableCellAddress
  head: TableCellAddress
}

/** 命令层使用的规范化矩形选区 */
export type NormalizedTableRange = {
  tablePos: number
  tgroupIndex: number
  sectionIndex: number
  sectionType: 'thead' | 'tbody'
  rowStart: number
  rowEnd: number
  colStart: number
  colEnd: number
  rowCount: number
  colCount: number
  isSingleCell: boolean
  isFullRow: boolean
  isFullColumn: boolean
}

export type TableCellContext = {
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

function isTableSectionName(name: string): name is 'thead' | 'tbody' {
  return name === 'thead' || name === 'tbody'
}

export function resolveCellFromResolvedPos($pos: ResolvedPos): TableCellAddress | null {
  let tableDepth = -1
  let tgroupDepth = -1
  let sectionDepth = -1
  let rowDepth = -1
  let entryDepth = -1

  for (let d = $pos.depth; d > 0; d--) {
    const name = $pos.node(d).type.name
    if (entryDepth < 0 && name === 'entry') entryDepth = d
    if (rowDepth < 0 && name === 'row') rowDepth = d
    if (sectionDepth < 0 && isTableSectionName(name)) sectionDepth = d
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

  const sectionType = $pos.node(sectionDepth).type.name
  if (!isTableSectionName(sectionType)) return null

  return {
    tablePos: $pos.before(tableDepth),
    tgroupIndex: $pos.index(tableDepth),
    sectionIndex: $pos.index(tgroupDepth),
    sectionType,
    rowIndex: $pos.index(sectionDepth),
    entryIndex: $pos.index(rowDepth),
  }
}

export function resolveCellFromPos(editor: Editor, pos: number): TableCellAddress | null {
  try {
    return resolveCellFromResolvedPos(editor.state.doc.resolve(pos))
  } catch {
    return null
  }
}

export function resolveCellFromDom(editor: Editor, el: HTMLElement): TableCellAddress | null {
  try {
    const pos = editor.view.posAtDOM(el, 0)
    return resolveCellFromPos(editor, pos)
  } catch {
    return null
  }
}

export function sameTableCell(a: TableCellAddress, b: TableCellAddress): boolean {
  return (
    a.tablePos === b.tablePos &&
    a.tgroupIndex === b.tgroupIndex &&
    a.sectionIndex === b.sectionIndex &&
    a.rowIndex === b.rowIndex &&
    a.entryIndex === b.entryIndex
  )
}

export function canExtendCellSelection(anchor: TableCellAddress, head: TableCellAddress): boolean {
  return (
    anchor.tablePos === head.tablePos &&
    anchor.tgroupIndex === head.tgroupIndex &&
    anchor.sectionIndex === head.sectionIndex
  )
}

function getSectionDimensions(
  doc: PMNode,
  address: Pick<TableCellAddress, 'tablePos' | 'tgroupIndex' | 'sectionIndex'>,
): { rowCount: number; colCount: number } | null {
  const table = doc.nodeAt(address.tablePos)
  if (!table || table.type.name !== 'table') return null
  const tgroup = table.child(address.tgroupIndex)
  if (!tgroup) return null
  const section = tgroup.child(address.sectionIndex)
  if (!section) return null

  let rowCount = 0
  let colCount = 0
  section.forEach((row) => {
    if (row.type.name !== 'row') return
    rowCount += 1
    let entries = 0
    row.forEach((entry) => {
      if (entry.type.name === 'entry') entries += 1
    })
    colCount = Math.max(colCount, entries)
  })
  return { rowCount, colCount }
}

/** 跨 thead/tbody 时将 head 钳制在 anchor 所在 section 的边界内 */
export function clampHeadToAnchorSection(
  editor: Editor,
  anchor: TableCellAddress,
  target: TableCellAddress,
): TableCellAddress {
  if (canExtendCellSelection(anchor, target)) return target
  if (
    anchor.tablePos !== target.tablePos ||
    anchor.tgroupIndex !== target.tgroupIndex
  ) {
    return anchor
  }

  const dims = getSectionDimensions(editor.state.doc, anchor)
  if (!dims || dims.rowCount === 0 || dims.colCount === 0) return anchor

  const maxRow = dims.rowCount - 1
  const maxCol = dims.colCount - 1
  let rowIndex = anchor.rowIndex
  const entryIndex = Math.max(0, Math.min(maxCol, target.entryIndex))

  if (target.sectionIndex > anchor.sectionIndex) {
    rowIndex = maxRow
  } else if (target.sectionIndex < anchor.sectionIndex) {
    rowIndex = 0
  } else {
    rowIndex = Math.max(0, Math.min(maxRow, target.rowIndex))
  }

  return {
    ...anchor,
    rowIndex,
    entryIndex,
  }
}

export function resolveSelectionPosInCell(
  doc: PMNode,
  address: TableCellAddress,
): number | null {
  const pos = entryPosFromAddress(doc, address)
  if (pos == null) return null
  const entry = doc.nodeAt(pos)
  if (!entry || entry.type.name !== 'entry') return null
  return pos + 1
}

export function normalizeTableRange(range: TableCellRange): NormalizedTableRange | null {
  const { anchor, head } = range
  if (!canExtendCellSelection(anchor, head)) return null

  const rowStart = Math.min(anchor.rowIndex, head.rowIndex)
  const rowEnd = Math.max(anchor.rowIndex, head.rowIndex)
  const colStart = Math.min(anchor.entryIndex, head.entryIndex)
  const colEnd = Math.max(anchor.entryIndex, head.entryIndex)
  const rowCount = rowEnd - rowStart + 1
  const colCount = colEnd - colStart + 1
  const isSingleCell = rowCount === 1 && colCount === 1

  return {
    tablePos: anchor.tablePos,
    tgroupIndex: anchor.tgroupIndex,
    sectionIndex: anchor.sectionIndex,
    sectionType: anchor.sectionType,
    rowStart,
    rowEnd,
    colStart,
    colEnd,
    rowCount,
    colCount,
    isSingleCell,
    isFullRow: false,
    isFullColumn: false,
  }
}

export function normalizeTableRangeInDoc(
  doc: PMNode,
  range: TableCellRange,
): NormalizedTableRange | null {
  const base = normalizeTableRange(range)
  if (!base) return null

  const table = doc.nodeAt(base.tablePos)
  if (!table || table.type.name !== 'table') return null
  const tgroup = table.child(base.tgroupIndex)
  if (!tgroup) return null
  const section = tgroup.child(base.sectionIndex)
  if (!section) return null

  let maxEntries = 0
  let rowCountInSection = 0
  section.forEach((row) => {
    if (row.type.name !== 'row') return
    rowCountInSection += 1
    let entries = 0
    row.forEach((entry) => {
      if (entry.type.name === 'entry') entries += 1
    })
    maxEntries = Math.max(maxEntries, entries)
  })

  return {
    ...base,
    isFullRow: base.colStart === 0 && base.colEnd === maxEntries - 1,
    isFullColumn: base.rowStart === 0 && base.rowEnd === rowCountInSection - 1,
  }
}

export function getTableCellSelection(editor: Editor): TableCellRange | null {
  const state = tableSelectionPluginKey.getState(editor.state)
  if (!state) return null
  return { anchor: state.anchor, head: state.head }
}

export function getTableCellSelectionState(editor: Editor): TableCellSelectionState {
  return tableSelectionPluginKey.getState(editor.state) ?? null
}

export function clearTableCellSelection(editor: Editor): void {
  if (!getTableCellSelectionState(editor)) return
  const tr = editor.state.tr.setMeta(tableSelectionPluginKey, null)
  editor.view.dispatch(tr)
}

export function setTableCellSelection(
  editor: Editor,
  anchor: TableCellAddress,
  head: TableCellAddress,
): void {
  const tr = editor.state.tr.setMeta(tableSelectionPluginKey, { anchor, head })
  editor.view.dispatch(tr)
}

export function resolveCellContext(
  editor: Editor,
  address: TableCellAddress,
): TableCellContext | null {
  const table = editor.state.doc.nodeAt(address.tablePos)
  if (!table || table.type.name !== 'table') return null
  const tgroup = table.child(address.tgroupIndex)
  if (!tgroup || tgroup.type.name !== 'tgroup') return null
  const section = tgroup.child(address.sectionIndex)
  if (!section || !isTableSectionName(section.type.name)) return null
  const row = section.child(address.rowIndex)
  if (!row || row.type.name !== 'row') return null
  const entry = row.child(address.entryIndex)
  if (!entry || entry.type.name !== 'entry') return null

  return {
    table,
    tablePos: address.tablePos,
    tgroup,
    tgroupIndex: address.tgroupIndex,
    section,
    sectionIndex: address.sectionIndex,
    row,
    rowIndex: address.rowIndex,
    entry,
    entryIndex: address.entryIndex,
  }
}

export function resolveCellContextFromSelection(
  editor: Editor,
  endpoint: 'anchor' | 'head',
): TableCellContext | null {
  const selection = editor.state.selection
  const $pos = endpoint === 'anchor' ? selection.$anchor : selection.$head
  const address = resolveCellFromResolvedPos($pos)
  if (!address) return null
  return resolveCellContext(editor, address)
}

/** 主单元格：拖拽选区左上角，或文本光标所在格 */
export function resolvePrimaryCellContext(editor: Editor): TableCellContext | null {
  const dragSel = getTableCellSelection(editor)
  if (dragSel) {
    const normalized = normalizeTableRange(dragSel)
    if (normalized) {
      return resolveCellContext(editor, {
        ...dragSel.anchor,
        rowIndex: normalized.rowStart,
        entryIndex: normalized.colStart,
      })
    }
  }
  return resolveCellContextFromSelection(editor, 'anchor')
}

export function resolveActiveTableTarget(editor: Editor): TableCellRange | null {
  const dragSel = getTableCellSelection(editor)
  if (dragSel) return dragSel

  const anchor = resolveCellContextFromSelection(editor, 'anchor')
  const head = resolveCellContextFromSelection(editor, 'head')
  if (!anchor) return null

  const anchorAddr: TableCellAddress = {
    tablePos: anchor.tablePos,
    tgroupIndex: anchor.tgroupIndex,
    sectionIndex: anchor.sectionIndex,
    sectionType: anchor.section.type.name as 'thead' | 'tbody',
    rowIndex: anchor.rowIndex,
    entryIndex: anchor.entryIndex,
  }

  if (!head) {
    return { anchor: anchorAddr, head: anchorAddr }
  }

  const headAddr: TableCellAddress = {
    tablePos: head.tablePos,
    tgroupIndex: head.tgroupIndex,
    sectionIndex: head.sectionIndex,
    sectionType: head.section.type.name as 'thead' | 'tbody',
    rowIndex: head.rowIndex,
    entryIndex: head.entryIndex,
  }

  return { anchor: anchorAddr, head: headAddr }
}

export function resolveCommandRange(editor: Editor): NormalizedTableRange | null {
  const target = resolveActiveTableTarget(editor)
  if (!target) return null
  return normalizeTableRangeInDoc(editor.state.doc, target)
}

export function entryPosFromAddress(doc: PMNode, address: TableCellAddress): number | null {
  const table = doc.nodeAt(address.tablePos)
  if (!table || table.type.name !== 'table') return null
  const tgroup = table.child(address.tgroupIndex)
  if (!tgroup) return null
  const section = tgroup.child(address.sectionIndex)
  if (!section) return null
  const row = section.child(address.rowIndex)
  if (!row) return null
  const entry = row.child(address.entryIndex)
  if (!entry || entry.type.name !== 'entry') return null

  let pos = address.tablePos + 1
  for (let i = 0; i < address.tgroupIndex; i += 1) {
    pos += table.child(i).nodeSize
  }
  pos += 1
  for (let i = 0; i < address.sectionIndex; i += 1) {
    pos += tgroup.child(i).nodeSize
  }
  pos += 1
  for (let i = 0; i < address.rowIndex; i += 1) {
    pos += section.child(i).nodeSize
  }
  pos += 1
  for (let i = 0; i < address.entryIndex; i += 1) {
    pos += row.child(i).nodeSize
  }
  return pos
}

export function collectEntryPositionsInRange(
  doc: PMNode,
  range: NormalizedTableRange,
): number[] {
  const positions: number[] = []
  for (let r = range.rowStart; r <= range.rowEnd; r += 1) {
    for (let c = range.colStart; c <= range.colEnd; c += 1) {
      const pos = entryPosFromAddress(doc, {
        tablePos: range.tablePos,
        tgroupIndex: range.tgroupIndex,
        sectionIndex: range.sectionIndex,
        sectionType: range.sectionType,
        rowIndex: r,
        entryIndex: c,
      })
      if (pos != null) positions.push(pos)
    }
  }
  return positions
}
