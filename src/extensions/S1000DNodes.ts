import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { InternalRefNodeView } from './s1000d/InternalRefNodeView'
import { S1000DEmphasis } from './s1000dEmphasis'
import { LevelledParaNodeView } from './s1000d/LevelledParaNodeView'
import { WarningNodeView } from './s1000d/WarningNodeView'
import type { ParaAttrs } from './s1000d/types'

export type { ParaAttrs, S1000DEditorJSON } from './s1000d/types'
export { S1000DEmphasis }

/**
 * 判断给定元素是否为我们关心的 S1000D `title` 容器：
 * Schema 允许 `title` 出现在 `levelledPara`、`figure`、`table`（经 `title` 子标签）等处。
 * 借此避免在无父链上下文中误接纳 HTML 文档的 `<title>`。
 */
function isS1000DTitleParent(parent: Element | null): boolean {
  if (!parent) return false
  const ln = parent.localName
  return (
    ln === 'levelledPara' ||
    ln === 'figure' ||
    ln === 'table' ||
    ln === 'sequentialList' ||
    ln === 'randomList' ||
    ln === 'multimedia'
  )
}

/**
 * `warningAndCautionPara`：警告块内的段落式行块，内容为行内片段（对齐 Schema：`text*` 的占位实现）。
 *
 * Phase 1 使用 `inline*`，便于与 Tiptap 默认 `text` 协同；后续可替换为专有 inline 集合（internalRef 等）。
 */
export const WarningAndCautionPara = Node.create({
  name: 'warningAndCautionPara',
  group: 'block',

  content: 'inline*',

  parseHTML() {
    return [
      {
        tag: 'warningAndCautionPara',
        getAttrs: () => ({}),
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'warningAndCautionPara',
      mergeAttributes(HTMLAttributes),
      0,
    ]
  },
})

/**
 * S1000D `warning`：块级注意单元，子节点必须为至少一个 `warningAndCautionPara`。
 * 视图层使用 `ReactNodeViewRenderer` 提供可辨识的 WYSIWYG 外壳。
 */
export const S1000DWarning = Node.create({
  name: 'warning',
  group: 'block',
  content: 'warningAndCautionPara+',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'warning' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['warning', mergeAttributes(HTMLAttributes), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(WarningNodeView)
  },
})

/**
 * S1000D `title`：标题行块，Schema 为 `(text)*`；此处建模为 `inline*` 以支持后续行内标记扩展。
 */
export const S1000DTitle = Node.create({
  name: 'title',
  group: 'block',
  content: 'inline*',

  parseHTML() {
    return [
      {
        tag: 'title',
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false
          return isS1000DTitleParent(el.parentElement) ? {} : false
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['title', mergeAttributes(HTMLAttributes), 0]
  },
})

/**
 * S1000D `para`：描述类正文的主要段落块；允许多种行内（Phase 1 仅 `inline*`，与 Schema 中 text 组对齐的第一步）。
 * 透传样例 XML 中出现的安全/衍生分类等属性，便于往返 XML。
 */
export const S1000DPara = Node.create({
  name: 'para',
  group: 'block',
  content: 'inline*',

  addAttributes(): Record<keyof ParaAttrs, { default: string | null }> {
    return {
      id: { default: null },
      securityClassification: { default: null },
      caveat: { default: null },
      derivativeClassificationRefId: { default: null },
      reasonForUpdateRefIds: { default: null },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'para',
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false
          return {
            id: el.getAttribute('id'),
            securityClassification: el.getAttribute('securityClassification'),
            caveat: el.getAttribute('caveat'),
            derivativeClassificationRefId: el.getAttribute(
              'derivativeClassificationRefId',
            ),
            reasonForUpdateRefIds: el.getAttribute('reasonForUpdateRefIds'),
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['para', mergeAttributes(HTMLAttributes), 0]
  },
})

/**
 * 从浏览器 DOM 读取 internalRef 的属性（序列化后经 HTML 可能为小写）。
 */
function readInternalRefAttrsFromDom(el: Element) {
  return {
    internalRefId:
      el.getAttribute('internalRefId') ?? el.getAttribute('internalrefid'),
    internalRefTargetType:
      el.getAttribute('internalRefTargetType') ??
      el.getAttribute('internalreftargettype'),
  }
}

/** `dmRef` 行内占位：段落内整块 DM 引用若按块解析会破坏 `para` — 先吞成原子占位，后续可换完整 Node。 */
export const S1000DDmRef = Node.create({
  name: 'dmRef',
  group: 'inline',
  inline: true,
  atom: true,

  parseHTML() {
    return [{ tag: 'dmref' }, { tag: 'dmRef' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 's1000d-dmref-chip',
        'data-s1000d-dm-ref': '1',
      }),
    ]
  },
})

/**
 * S1000D `internalRef`：内部引用；兼容 `internalRef`/`internalref`/`span[data-s1000d-internal-ref]`。
 */
export const S1000DInternalRef = Node.create({
  name: 'internalRef',
  group: 'inline',
  inline: true,
  atom: true,
  draggable: false,

  addAttributes() {
    return {
      internalRefId: { default: null },
      internalRefTargetType: { default: null },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-s1000d-internal-ref="1"]',
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false
          const fromChip = readInternalRefAttrsFromDom(el)
          return {
            internalRefId:
              el.getAttribute('data-internal-ref-id') ??
              fromChip.internalRefId,
            internalRefTargetType:
              el.getAttribute('data-internal-ref-target-type') ??
              fromChip.internalRefTargetType,
          }
        },
      },
      {
        tag: 'internalRef',
        getAttrs: (el) => readInternalRefAttrsFromDom(el),
      },
      {
        tag: 'internalref',
        getAttrs: (el) => readInternalRefAttrsFromDom(el),
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as {
      internalRefId?: string | null
      internalRefTargetType?: string | null
    }
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-s1000d-internal-ref': '1',
        'data-internal-ref-id': attrs.internalRefId ?? '',
        'data-internal-ref-target-type': attrs.internalRefTargetType ?? '',
        class: 's1000d-internal-ref',
      }),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(InternalRefNodeView)
  },
})

/**
 * S1000D `graphic`：`figure` 下的媒体引用占位（无文本子节点）。
 */
export const S1000DGraphic = Node.create({
  name: 'graphic',
  atom: true,
  group: 'block',
  selectable: true,

  addAttributes() {
    return {
      infoEntityIdent: { default: null },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'graphic',
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false
          return {
            infoEntityIdent:
              el.getAttribute('infoEntityIdent') ??
              el.getAttribute('infoentityident'),
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['graphic', mergeAttributes(HTMLAttributes)]
  },
})

/**
 * S1000D `figure`：块级，`title?` + 至少一个 `graphic`。
 */
export const S1000DFigure = Node.create({
  name: 'figure',
  group: 'block',
  content: '(title?) graphic+',
  defining: true,

  addAttributes() {
    return {
      id: { default: null },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'figure',
        getAttrs: (el) => {
          if (!el || !(el instanceof Element)) return false
          return { id: el.getAttribute('id') }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['figure', mergeAttributes(HTMLAttributes), 0]
  },
})

/**
 * S1000D `levelledPara`：可嵌套的结构化段落容器。
 * Schema：`title (warning|note|para|fmft|table)* levelledPara*`
 * 当前实现含 Bike 示例所需：`para | warning | levelledPara | figure`。
 */
export const LevelledPara = Node.create({
  name: 'levelledPara',
  group: 'block',
  content: '(title?) (para | warning | levelledPara | figure)*',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'levelledPara' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['levelledPara', mergeAttributes(HTMLAttributes), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(LevelledParaNodeView)
  },
})

/** S1000D 描述类节点注册顺序（子类型先于引用它们的容器）。 */
export const s1000dPhase1Nodes = [
  S1000DEmphasis,
  WarningAndCautionPara,
  S1000DWarning,
  S1000DTitle,
  S1000DPara,
  S1000DDmRef,
  S1000DInternalRef,
  S1000DGraphic,
  S1000DFigure,
  LevelledPara,
] as const

/**
 * 使用浏览器原生 `DOMParser` 解析整段 DM XML 字符串，抽出首个 `<content>` 元素以备后续映射到编辑器。
 *
 * **注意**：本函数不写编辑器状态，只做 DOM 截取，保持「解析」与「状态更新」单向分离。
 *
 * @param xmlString DM 全文（可含 DOCTYPE、`identAndStatusSection`）；若缺失 `content` 则返回 `null`
 */
export function extractContentElementFromDmXml(xmlString: string): Element | null {
  const trimmed = xmlString.replace(/^\uFEFF/, '')
  const dmStart = trimmed.search(/<\s*dmodule\b/i)
  const toParse = dmStart >= 0 ? trimmed.slice(dmStart) : trimmed

  const doc = new DOMParser().parseFromString(toParse, 'application/xml')
  const parserError = doc.querySelector('parsererror')
  if (parserError) return null

  const dmodule =
    doc.documentElement.localName === 'dmodule'
      ? doc.documentElement
      : doc.querySelector('dmodule')
  if (!dmodule) return null

  const contentEl = Array.from(dmodule.children).find(
    (c) => c.localName === 'content',
  )
  return contentEl ?? null
}

/**
 * 从 DM 正文字符串中取出可用于 `editor.setContent` 的片段：
 * 截取 `<content>` → `<description>` 的**直接子节点**，序列化为连续 XML 字符串（无 `<description>` 外壳）。
 * Tiptap 将按各扩展的 `parseHTML` 导入；**不向编辑器注入** `identAndStatusSection`。
 */
export function getDescriptionInnerXmlFromDmXml(xmlString: string): string | null {
  const contentRoot = extractContentElementFromDmXml(xmlString)
  if (!contentRoot) return null
  const description = Array.from(contentRoot.children).find(
    (c) => c.localName === 'description',
  )
  if (!description) return null
  const serializer = new XMLSerializer()
  const parts: string[] = []
  for (const child of Array.from(description.children)) {
    parts.push(serializer.serializeToString(child))
  }
  return parts.length > 0 ? parts.join('') : null
}
