import { Extension, type Editor } from '@tiptap/core'
import { Plugin, TextSelection, NodeSelection, type EditorState, type Selection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

import {
  clampHeadToAnchorSection,
  collectEntryPositionsInRange,
  entryPosFromAddress,
  getTableCellSelectionState,
  normalizeTableRangeInDoc,
  resolveCellFromDom,
  resolveCellFromResolvedPos,
  resolveSelectionPosInCell,
  tableSelectionPluginKey,
  type TableCellAddress,
  type TableCellSelectionState,
} from '../../lib/editor/tableSelection'

const CELL_SELECTOR = '.s1000d-tgroup-table td.s1000d-entry, .s1000d-tgroup-table th.s1000d-entry'

function findCellElement(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  return target.closest(CELL_SELECTOR) as HTMLElement | null
}

function findTableElement(cell: HTMLElement): HTMLElement | null {
  return cell.closest('.s1000d-tgroup-table') as HTMLElement | null
}

function applyHeadFromMouse(
  editor: Editor,
  anchor: TableCellAddress,
  head: TableCellAddress,
  e: Pick<MouseEvent, 'clientX' | 'clientY'>,
): { head: TableCellAddress; cellSelectMode: boolean } {
  const under = document.elementFromPoint(e.clientX, e.clientY)
  const cell = findCellElement(under)
  if (!cell) {
    const cellSelectMode =
      head.rowIndex !== anchor.rowIndex || head.colIndex !== anchor.colIndex
    return { head, cellSelectMode }
  }

  const addr = resolveCellFromDom(editor, cell)
  if (!addr) {
    const cellSelectMode =
      head.rowIndex !== anchor.rowIndex || head.colIndex !== anchor.colIndex
    return { head, cellSelectMode }
  }

  const nextHead = clampHeadToAnchorSection(editor, anchor, addr)
  const cellSelectMode =
    nextHead.rowIndex !== anchor.rowIndex || nextHead.colIndex !== anchor.colIndex
  return { head: nextHead, cellSelectMode }
}

function syncTableSelectingClass(view: { dom: Element }, state: EditorState): void {
  const sel = tableSelectionPluginKey.getState(state)
  const tables = view.dom.querySelectorAll<HTMLElement>('.s1000d-tgroup-table')
  tables.forEach((table) => {
    if (sel) {
      table.classList.add('is-cell-selecting')
    } else {
      table.classList.remove('is-cell-selecting')
    }
  })
}

function buildCellDecorationList(state: EditorState): Decoration[] {
  const sel = tableSelectionPluginKey.getState(state)
  if (!sel) return []

  const range = normalizeTableRangeInDoc(state.doc, sel)
  if (!range || range.isSingleCell) return []

  return collectEntryPositionsInRange(state.doc, range)
    .map((pos) => {
      const node = state.doc.nodeAt(pos)
      if (!node) return null
      return Decoration.node(pos, pos + node.nodeSize, {
        class: 'is-cell-selected',
      })
    })
    .filter((d): d is Decoration => d != null)
}

/** 当前文本光标所在 entry：用 decoration 挂 class，避免 PM 重绘抹掉手动 DOM class。 */
function buildActiveCellDecorationList(state: EditorState): Decoration[] {
  if (tableSelectionPluginKey.getState(state)) return []

  const address = resolveCellFromResolvedPos(state.selection.$from)
  if (!address) return []

  const entryPos = entryPosFromAddress(state.doc, address)
  if (entryPos == null) return []

  const node = state.doc.nodeAt(entryPos)
  if (!node) return []

  return [
    Decoration.node(entryPos, entryPos + node.nodeSize, {
      class: 'is-cell-editing',
    }),
  ]
}

function buildTableCellDecorations(state: EditorState): DecorationSet {
  const decorations = [
    ...buildCellDecorationList(state),
    ...buildActiveCellDecorationList(state),
  ]
  return DecorationSet.create(state.doc, decorations)
}

function resolveTextSelectionFromCellClick(
  view: {
    state: EditorState
    posAtCoords: (coords: { left: number; top: number }) => { pos: number } | null
  },
  anchor: TableCellAddress,
  e: Pick<MouseEvent, 'clientX' | 'clientY'>,
): Selection | null {
  const coords = view.posAtCoords({ left: e.clientX, top: e.clientY })
  if (coords) {
    const $pos = view.state.doc.resolve(coords.pos)
    if ($pos.parent.isTextblock) {
      return TextSelection.create(view.state.doc, coords.pos)
    }
  }
  const collapsePos = resolveSelectionPosInCell(view.state.doc, anchor)
  if (collapsePos == null) return null
  return TextSelection.near(view.state.doc.resolve(collapsePos))
}

function dispatchCellDragState(
  view: {
    state: EditorState
    dispatch: (tr: import('@tiptap/pm/state').Transaction) => void
    focus: () => void
  },
  anchor: TableCellAddress,
  head: TableCellAddress,
  cellSelectMode: boolean,
): void {
  let tr = view.state.tr
  // 只有在拖拽多选时才强制设置选区到单元格起始位置
  // 单单元格点击时保持默认行为，让浏览器根据鼠标位置定位光标
  if (cellSelectMode) {
    const collapsePos = resolveSelectionPosInCell(view.state.doc, anchor)
    if (collapsePos != null) {
      tr = tr.setSelection(TextSelection.near(view.state.doc.resolve(collapsePos)))
    }
  }
  tr = tr.setMeta(
    tableSelectionPluginKey,
    cellSelectMode ? { anchor, head } : null,
  )
  view.dispatch(tr)
  view.focus()
}

/**
 * S1000D 表格通用单元格拖拽选区：WPS 式矩形框选，供合并单元格及后续表格命令复用。
 */
export const S1000dTableCellSelectionExtension = Extension.create({
  name: 's1000dTableCellSelection',

  addProseMirrorPlugins() {
    const editor = this.editor

    return [
      new Plugin({
        key: tableSelectionPluginKey,
        state: {
          init(): TableCellSelectionState {
            return null
          },
          apply(tr, value): TableCellSelectionState {
            const meta = tr.getMeta(tableSelectionPluginKey)
            if (meta !== undefined) return meta
            if (tr.docChanged) return null
            return value
          },
        },
        view(editorView) {
          syncTableSelectingClass(editorView, editorView.state)
          return {
            update(_view, prevState) {
              if (editorView.state !== prevState) {
                syncTableSelectingClass(editorView, editorView.state)
              }
            },
          }
        },
        props: {
          decorations(state) {
            return buildTableCellDecorations(state)
          },
          handleDOMEvents: {
            mousedown(view, event) {
              if (!editor.isEditable || event.button !== 0) return false

              const td = findCellElement(event.target)
              if (!td) {
                if (getTableCellSelectionState(editor)) {
                  view.dispatch(view.state.tr.setMeta(tableSelectionPluginKey, null))
                }
                return false
              }

              const anchor = resolveCellFromDom(editor, td)
              if (!anchor) return false

              // 延迟 preventDefault，只有在确认开始拖拽时才阻止默认行为
              // 简单点击时让浏览器正常处理光标定位
              let hasDragged = false
              let dragging = true
              let head: TableCellAddress = anchor
              let cellSelectMode = false
              const tableEl = findTableElement(td)

              const onMove = (e: MouseEvent) => {
                if (!dragging) return
                if (!hasDragged) {
                  hasDragged = true
                  event.preventDefault()
                  tableEl?.classList.add('is-cell-dragging')
                }
                e.preventDefault()
                window.getSelection()?.removeAllRanges()

                const next = applyHeadFromMouse(editor, anchor, head, e)
                head = next.head
                cellSelectMode = next.cellSelectMode
                dispatchCellDragState(view, anchor, head, cellSelectMode)
              }

              const onUp = (e: MouseEvent) => {
                dragging = false
                document.removeEventListener('mousemove', onMove)
                document.removeEventListener('mouseup', onUp)
                tableEl?.classList.remove('is-cell-dragging')
                window.getSelection()?.removeAllRanges()

                // 如果发生了拖拽，应用最终选区；否则保持浏览器默认的光标位置
                if (hasDragged || cellSelectMode) {
                  const next = applyHeadFromMouse(editor, anchor, head, e)
                  head = next.head
                  cellSelectMode = next.cellSelectMode
                  dispatchCellDragState(view, anchor, head, cellSelectMode)
                } else {
                  let tr = view.state.tr.setMeta(tableSelectionPluginKey, null)
                  const { selection } = view.state
                  if (
                    selection instanceof NodeSelection &&
                    selection.node.type.name === 'table'
                  ) {
                    const textSel = resolveTextSelectionFromCellClick(
                      view,
                      anchor,
                      e,
                    )
                    if (textSel) {
                      tr = tr.setSelection(textSel)
                    }
                  }
                  view.dispatch(tr)
                  view.focus()
                }
              }

              document.addEventListener('mousemove', onMove)
              document.addEventListener('mouseup', onUp)
              return true
            },
          },
        },
      }),
    ]
  },
})
