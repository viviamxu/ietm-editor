import type { JSONContent } from '@tiptap/core'

/** 可将 `paragraph` 替换为 `para` 的父节点（与 S1000D schema / listItem 一致） */
export const PARA_BLOCK_PARENT_TYPES = new Set([
  'doc',
  'levelledPara',
  'listItem',
  'entry',
])

/** 误出现在 `doc` 根下、应改为 `para` 的块类型（曾为 `group: block` 的嵌套节点） */
export const INVALID_DOC_ROOT_BLOCK_TYPES = new Set([
  'paragraph',
  'attentionListItemPara',
  'attentionRandomListItem',
  'attentionRandomList',
  'warningAndCautionLead',
  'warningAndCautionPara',
  'noteLead',
  'notePara',
  'title',
])

export function canMigrateParagraphUnderParent(parentType: string): boolean {
  return PARA_BLOCK_PARENT_TYPES.has(parentType)
}

function shouldMigrateTypeToPara(type: string | undefined, parentType?: string): boolean {
  if (!type) return false
  if (type === 'paragraph' && parentType && canMigrateParagraphUnderParent(parentType)) {
    return true
  }
  if (parentType === 'doc' && INVALID_DOC_ROOT_BLOCK_TYPES.has(type)) {
    return true
  }
  return false
}

/** 将 JSON 文档树中的非法根块 / `paragraph` 改为 `para`（供 setContent / initialContent 使用） */
export function migrateParagraphInJson(doc: JSONContent): JSONContent {
  function walk(node: JSONContent, parentType?: string): JSONContent {
    let type = node.type
    if (shouldMigrateTypeToPara(type, parentType)) {
      type = 'para'
    }
    if (!node.content?.length) {
      return type === node.type ? node : { ...node, type }
    }
    const content = node.content.map((child) => walk(child, type))
    return { ...node, type, content }
  }
  return walk(doc)
}
