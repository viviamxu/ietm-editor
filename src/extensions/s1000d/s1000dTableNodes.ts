import { mergeAttributes, Node } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'

import {
  SOURCE_XML_ATTR_KEYS,
  hasXmlAttr,
  xmlAttrsPresentOnElement,
} from '../../lib/s1000d/sourceXmlAttrKeys'

const emptyPara: JSONContent = { type: 'para', content: [] }

function colNumber(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const match = /^col(\d+)$/.exec(value)
  if (!match) return null
  const n = Number.parseInt(match[1], 10)
  return Number.isNaN(n) ? null : n
}

function htmlSpanAttrs(attrs: Record<string, unknown>) {
  const start = colNumber(attrs.namest)
  const end = colNumber(attrs.nameend)
  const colSpan = start != null && end != null && end >= start ? end - start + 1 : 1
  const moreRows = Number.parseInt(String(attrs.morerows ?? '0'), 10)
  const rowSpan = Number.isNaN(moreRows) ? 1 : Math.max(1, moreRows + 1)
  return {
    ...(colSpan > 1 ? { colspan: String(colSpan) } : {}),
    ...(rowSpan > 1 ? { rowspan: String(rowSpan) } : {}),
  }
}

/**
 * 生成符合 `src/data/描述类Schema.json` 中表格定义的 JSON，供 `insertContent` 使用：
 * - `table`: `title? tgroup+`
 * - `tgroup`: `thead? tbody`（编辑器侧 `tbody+`，插入时仅一个 `tbody`；`tfoot` 未建模）
 * - `thead`/`tbody`: `row+`；`row`: `entry+`；`entry`: `(para|warning|caution)+`（此处用 `para+`）
 *
 * @param includeEmptyTitle 是否与常见 DM 一致插入空 `title`（对应 schema 可选 `title?`）
 */
export function createMinimalS1000dTableInsertJson(
  cols: number,
  headerRowCount: number,
  bodyRows: number,
  includeEmptyTitle = true,
): JSONContent {
  const safeCols = Math.max(1, Math.min(cols, 32))
  const safeHead = Math.max(0, headerRowCount)
  const safeBody = Math.max(1, bodyRows)

  const cell = (): JSONContent => ({
    type: 'entry',
    content: [{ ...emptyPara }],
  })

  const headerRows: JSONContent[] = []
  for (let i = 0; i < safeHead; i++) {
    headerRows.push({
      type: 'row',
      content: [...Array(safeCols)].map(() => cell()),
    })
  }

  const bodyRowNodes: JSONContent[] = []
  for (let i = 0; i < safeBody; i++) {
    bodyRowNodes.push({
      type: 'row',
      content: [...Array(safeCols)].map(() => cell()),
    })
  }

  const tgroupContent: JSONContent[] = []
  if (headerRows.length > 0) {
    tgroupContent.push({ type: 'thead', content: headerRows })
  }
  tgroupContent.push({ type: 'tbody', content: bodyRowNodes })

  const tableChildren: JSONContent[] = []
  if (includeEmptyTitle) {
    tableChildren.push({ type: 'title', content: [] })
  }
  tableChildren.push({
    type: 'tgroup',
    attrs: { cols: String(safeCols) },
    content: tgroupContent,
  })

  return {
    type: 'table',
    content: tableChildren,
  }
}

function readEntryAttrsFromDom(el: Element) {
  return {
    colname: el.getAttribute('colname'),
    namest: el.getAttribute('namest'),
    nameend: el.getAttribute('nameend'),
    morerows: el.getAttribute('morerows'),
    align: el.getAttribute('align'),
  }
}

function readEntrySourceXmlAttrKeys(el: Element): string[] {
  return ['colname', 'namest', 'nameend', 'morerows', 'align'].filter((n) =>
    hasXmlAttr(el, n),
  )
}

function readTgroupSourceXmlAttrKeys(el: Element): string[] {
  const keys: string[] = []
  if (hasXmlAttr(el, 'cols') || hasXmlAttr(el, 'data-s1000d-tgroup-cols')) {
    keys.push('cols')
  }
  if (hasXmlAttr(el, 'colsep') || hasXmlAttr(el, 'data-s1000d-tgroup-colsep')) {
    keys.push('colsep')
  }
  if (hasXmlAttr(el, 'rowsep') || hasXmlAttr(el, 'data-s1000d-tgroup-rowsep')) {
    keys.push('rowsep')
  }
  return keys
}

/**
 * S1000D `entry`：表格单元格，内容以 `para+` 为主（与样例 XML 对齐）。
 */
export const S1000DTableEntry = Node.create({
  name: 'entry',
  content: 'para+',
  isolating: true,
  defining: true,

  addAttributes() {
    return {
      colname: { default: null },
      namest: { default: null },
      nameend: { default: null },
      morerows: { default: null },
      align: { default: null },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'entry',
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false
          return {
            ...readEntryAttrsFromDom(el),
            [SOURCE_XML_ATTR_KEYS]: readEntrySourceXmlAttrKeys(el),
          }
        },
      },
      {
        tag: 'td',
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false
          return {
            ...readEntryAttrsFromDom(el),
            [SOURCE_XML_ATTR_KEYS]: readEntrySourceXmlAttrKeys(el),
          }
        },
      },
      {
        tag: 'th',
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false
          return {
            ...readEntryAttrsFromDom(el),
            [SOURCE_XML_ATTR_KEYS]: readEntrySourceXmlAttrKeys(el),
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'td',
      mergeAttributes(HTMLAttributes, htmlSpanAttrs(HTMLAttributes), {
        class: 's1000d-entry',
      }),
      0,
    ]
  },
})

export const S1000DTableRow = Node.create({
  name: 'row',
  content: 'entry+',
  defining: true,

  parseHTML() {
    return [{ tag: 'row' }, { tag: 'tr' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['tr', mergeAttributes(HTMLAttributes, { class: 's1000d-row' }), 0]
  },
})

export const S1000DTableThead = Node.create({
  name: 'thead',
  content: 'row+',
  defining: true,

  parseHTML() {
    return [{ tag: 'thead' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['thead', mergeAttributes(HTMLAttributes), 0]
  },
})

export const S1000DTableTbody = Node.create({
  name: 'tbody',
  content: 'row+',
  defining: true,

  parseHTML() {
    return [{ tag: 'tbody' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['tbody', mergeAttributes(HTMLAttributes), 0]
  },
})

/**
 * S1000D `tgroup`：内层用真实 `<table>` 渲染以便浏览器排版；与根级 XML `<table>` 区分靠 class。
 */
export const S1000DTgroup = Node.create({
  name: 'tgroup',
  content: 'thead? tbody+',
  defining: true,

  addAttributes() {
    return {
      cols: { default: null },
      colsep: { default: null },
      rowsep: { default: null },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'tgroup',
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false
          return {
            cols: el.getAttribute('cols'),
            colsep: el.getAttribute('colsep'),
            rowsep: el.getAttribute('rowsep'),
            [SOURCE_XML_ATTR_KEYS]: readTgroupSourceXmlAttrKeys(el),
          }
        },
      },
      {
        tag: 'table',
        priority: 65,
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false
          if (!el.classList.contains('s1000d-tgroup-table')) return false
          return {
            cols: el.getAttribute('data-s1000d-tgroup-cols'),
            colsep: el.getAttribute('data-s1000d-tgroup-colsep'),
            rowsep: el.getAttribute('data-s1000d-tgroup-rowsep'),
            [SOURCE_XML_ATTR_KEYS]: readTgroupSourceXmlAttrKeys(el),
          }
        },
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'table',
      mergeAttributes(HTMLAttributes, {
        class: 's1000d-tgroup-table',
        'data-s1000d-tgroup-cols':
          typeof node.attrs.cols === 'string' && node.attrs.cols ? node.attrs.cols : '',
        'data-s1000d-tgroup-colsep':
          typeof node.attrs.colsep === 'string' && node.attrs.colsep
            ? node.attrs.colsep
            : '',
        'data-s1000d-tgroup-rowsep':
          typeof node.attrs.rowsep === 'string' && node.attrs.rowsep
            ? node.attrs.rowsep
            : '',
      }),
      0,
    ]
  },
})

/**
 * S1000D `table`：`title?` + 多个 `tgroup`；外层用容器 div 包住，避免在非标准子节点上使用原生 `<table>` 导致排版错乱。
 */
export const S1000DXmlTable = Node.create({
  name: 'table',
  group: 'block fmftElemGroup',
  content: '(title?) tgroup+',
  defining: true,
  selectable: true,

  addAttributes() {
    return {
      id: { default: null },
    }
  },

  parseHTML() {
    return [
      {
        /** 不可用 `tag: 'div[data-…]'`，部分运行时不会把它当成匹配规则，外壳 div 落选后内层会变成孤立的 `tgroup`，违反 schema */
        tag: 'div',
        priority: 70,
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false
          const marked =
            el.getAttribute('data-s1000d-xml-table') === '1' ||
            el.classList.contains('s1000d-table-wrap')
          if (!marked) return false
          return {
            id: el.getAttribute('id'),
            [SOURCE_XML_ATTR_KEYS]: xmlAttrsPresentOnElement(el, ['id']),
          }
        },
      },
      {
        tag: 'table',
        priority: 55,
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false
          // 由内层 `tgroup` 渲染生成的真实 HTML 表，不归入根级 XML table
          if (el.classList.contains('s1000d-tgroup-table')) return false
          return {
            id: el.getAttribute('id'),
            [SOURCE_XML_ATTR_KEYS]: xmlAttrsPresentOnElement(el, ['id']),
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 's1000d-table-wrap',
        'data-s1000d-xml-table': '1',
      }),
      0,
    ]
  },
})

/** 注册顺序：自底向上 */
export const s1000dTableNodes = [
  S1000DTableEntry,
  S1000DTableRow,
  S1000DTableThead,
  S1000DTableTbody,
  S1000DTgroup,
  S1000DXmlTable,
] as const
