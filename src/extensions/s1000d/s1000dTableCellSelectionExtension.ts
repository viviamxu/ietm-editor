import { Extension, type Editor } from '@tiptap/core'
import { Plugin, TextSelection, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

import {
  clampHeadToAnchorSection,
  collectEntryPositionsInRange,
  getTableCellSelectionState,
  normalizeTableRangeInDoc,
  resolveCellFromDom,
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

function buildCellDecorations(state: EditorState): DecorationSet {
  const sel = tableSelectionPluginKey.getState(state)
  if (!sel) return DecorationSet.empty

  const range = normalizeTableRangeInDoc(state.doc, sel)
  if (!range || range.isSingleCell) return DecorationSet.empty

  const positions = collectEntryPositionsInRange(state.doc, range)
  const decorations = positions
    .map((pos) => {
      const node = state.doc.nodeAt(pos)
      if (!node) return null
      return Decoration.node(pos, pos + node.nodeSize, {
        class: 'is-cell-selected',
      })
    })
    .filter((d): d is Decoration => d != null)

  return DecorationSet.create(state.doc, decorations)
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
            return buildCellDecorations(state)
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
                  // 简单点击时，只清除可能的拖拽选区状态，不强制设置光标位置
                  view.dispatch(view.state.tr.setMeta(tableSelectionPluginKey, null))
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
