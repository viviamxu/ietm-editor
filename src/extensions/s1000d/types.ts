import type { JSONContent } from '@tiptap/core'

/**
 * S1000D 正文在 Tiptap 中的 JSON 根结构（与 `editor.getJSON()` 一致），
 * 用于后续 `serializeASTToXML` 等纯函数的入参类型约束。
 */
export type S1000DEditorJSON = JSONContent

/** `para` 节点上可能出现的业务属性（与样例 XML 对齐，可逐步扩展） */
export interface ParaAttrs {
  id?: string | null
  securityClassification?: string | null
  caveat?: string | null
  derivativeClassificationRefId?: string | null
  reasonForUpdateRefIds?: string | null
}
