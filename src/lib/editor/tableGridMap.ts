import type { Node as PMNode } from '@tiptap/pm/model'

/**
 * S1000D/CALS 表格的「逻辑网格」映射。
 *
 * 合并单元格后，`entry` 在 `row` 内的子节点序号（entryIndex）不再等于视觉列号：
 * - 横向合并用 `namest`/`nameend`
 * - 纵向合并用 `morerows`（被跨越的后续行会缺少对应 entry）
 *
 * 本模块按这些属性把每个 entry 还原成它在网格中占据的行列范围，
 * 供选区、命令层用「逻辑行列」而非 entryIndex 计算。
 */

/** 定位某个 section 的最小地址 */
export type SectionGridAddress = {
  tablePos: number
  tgroupIndex: number
  sectionIndex: number
}

/** 网格中一个 entry 占据的范围（逻辑坐标，0-based） */
export type GridCellSlot = {
  /** entry 在 row 内的子节点序号 */
  rowIndex: number
  entryIndex: number
  colStart: number
  colEnd: number
  rowStart: number
  rowEnd: number
}

export type SectionGridMap = {
  rowCount: number
  colCount: number
  slots: GridCellSlot[]
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

function entryExplicitCols(
  entry: PMNode,
): { colStart: number; colEnd: number } | null {
  const start = colNumber(entry.attrs.namest)
  const end = colNumber(entry.attrs.nameend)
  if (start != null && end != null && end >= start) {
    return { colStart: start - 1, colEnd: end - 1 }
  }
  return null
}

function key(row: number, col: number): string {
  return `${row}:${col}`
}

/** tgroup 的逻辑列数：取属性 cols 与各行展开列数的最大值 */
export function tgroupLogicalColumnCount(tgroup: PMNode): number {
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

/** 为单个 section 构建逻辑网格 */
export function buildSectionGridMap(
  section: PMNode,
  colCount: number,
): SectionGridMap {
  const occupied = new Set<string>()
  const slots: GridCellSlot[] = []
  let rowCount = 0

  section.forEach((row, _rowOffset, rowIndex) => {
    if (row.type.name !== 'row') return
    rowCount += 1

    let cursor = 0
    let entryIndex = 0
    row.forEach((entry) => {
      if (entry.type.name !== 'entry') return

      // 跳过被上方 morerows 占据的列
      while (cursor < colCount && occupied.has(key(rowIndex, cursor))) {
        cursor += 1
      }

      const explicit = entryExplicitCols(entry)
      const colStart = explicit ? explicit.colStart : cursor
      const colEnd = explicit
        ? explicit.colEnd
        : cursor + entryColSpan(entry) - 1
      const rowEnd = rowIndex + entryRowSpan(entry) - 1

      slots.push({
        rowIndex,
        entryIndex,
        colStart,
        colEnd,
        rowStart: rowIndex,
        rowEnd,
      })

      for (let r = rowIndex; r <= rowEnd; r += 1) {
        for (let c = colStart; c <= colEnd; c += 1) {
          occupied.add(key(r, c))
        }
      }

      cursor = colEnd + 1
      entryIndex += 1
    })
  })

  return { rowCount, colCount, slots }
}

export function getSectionGridMap(
  doc: PMNode,
  address: SectionGridAddress,
): SectionGridMap | null {
  const table = doc.nodeAt(address.tablePos)
  if (!table || table.type.name !== 'table') return null
  const tgroup = table.child(address.tgroupIndex)
  if (!tgroup || tgroup.type.name !== 'tgroup') return null
  const section = tgroup.child(address.sectionIndex)
  if (!section) return null
  return buildSectionGridMap(section, tgroupLogicalColumnCount(tgroup))
}

function findSlotByEntry(
  map: SectionGridMap,
  rowIndex: number,
  entryIndex: number,
): GridCellSlot | null {
  return (
    map.slots.find(
      (slot) => slot.rowIndex === rowIndex && slot.entryIndex === entryIndex,
    ) ?? null
  )
}

function findSlotAtCell(
  map: SectionGridMap,
  rowIndex: number,
  colIndex: number,
): GridCellSlot | null {
  return (
    map.slots.find(
      (slot) =>
        rowIndex >= slot.rowStart &&
        rowIndex <= slot.rowEnd &&
        colIndex >= slot.colStart &&
        colIndex <= slot.colEnd,
    ) ?? null
  )
}

/** 由 (rowIndex, entryIndex) 求逻辑列起点；找不到返回 null（调用方需降级） */
export function resolveLogicalColIndex(
  doc: PMNode,
  address: SectionGridAddress & { rowIndex: number; entryIndex: number },
): number | null {
  const map = getSectionGridMap(doc, address)
  if (!map) return null
  return findSlotByEntry(map, address.rowIndex, address.entryIndex)?.colStart ?? null
}

/** 由逻辑 (rowIndex, colIndex) 反查真实 entry 的 (rowIndex, entryIndex) */
export function entryAddressAtLogicalCell(
  doc: PMNode,
  address: SectionGridAddress,
  rowIndex: number,
  colIndex: number,
): { rowIndex: number; entryIndex: number; colIndex: number } | null {
  const map = getSectionGridMap(doc, address)
  if (!map) return null
  const slot = findSlotAtCell(map, rowIndex, colIndex)
  if (!slot) return null
  return {
    rowIndex: slot.rowIndex,
    entryIndex: slot.entryIndex,
    colIndex: slot.colStart,
  }
}

/** 收集逻辑矩形范围内的所有 slot（去重，按行、列排序） */
export function collectSlotsInLogicalRange(
  map: SectionGridMap,
  rowStart: number,
  rowEnd: number,
  colStart: number,
  colEnd: number,
): GridCellSlot[] {
  const seen = new Set<string>()
  const out: GridCellSlot[] = []
  for (let r = rowStart; r <= rowEnd; r += 1) {
    for (let c = colStart; c <= colEnd; c += 1) {
      const slot = findSlotAtCell(map, r, c)
      if (!slot) continue
      const id = `${slot.rowIndex}:${slot.entryIndex}`
      if (seen.has(id)) continue
      seen.add(id)
      out.push(slot)
    }
  }
  return out.sort((a, b) => a.rowIndex - b.rowIndex || a.colStart - b.colStart)
}

export function slotOverlapsLogicalRange(
  slot: GridCellSlot,
  rowStart: number,
  rowEnd: number,
  colStart: number,
  colEnd: number,
): boolean {
  return (
    slot.rowStart <= rowEnd &&
    slot.rowEnd >= rowStart &&
    slot.colStart <= colEnd &&
    slot.colEnd >= colStart
  )
}
