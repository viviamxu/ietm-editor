import type { JSONContent } from '@tiptap/core'

/** 可将误用的 `paragraph` 替换为 `para` 的父节点（不含 `listItem`，列表保留 `paragraph`） */
export const PARA_BLOCK_PARENT_TYPES = new Set([
  'doc',
  'levelledPara',
  'proceduralStep',
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
  'proceduralStep',
  'reqCondGroup',
  'reqCondNoRef',
  'reqCond',
  'noConds',
  'reqPersons',
  'personnel',
  'personCategory',
  'personSkill',
  'trade',
  'estimatedTime',
  'reqSupportEquips',
  'noSupportEquips',
  'supportEquipDescrGroup',
  'supportEquipDescr',
  'reqSupplies',
  'noSupplies',
  'supplyDescrGroup',
  'supplyDescr',
  'reqSpares',
  'noSpares',
  'spareDescrGroup',
  'spareDescr',
  'reqSafety',
  'noSafety',
  'safetyRqmts',
  'identNumber',
  'partAndSerialNumber',
  'partNumber',
  'name',
  'natoStockNumber',
  'reqQuantity',
  'remarks',
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

/** 列表项内应使用 `paragraph`（带 S1000D 属性），非 `para` */
export function migrateListItemParaToParagraphInJson(
  doc: JSONContent,
): JSONContent {
  function walk(node: JSONContent, parentType?: string): JSONContent {
    let type = node.type
    if (type === 'para' && parentType === 'listItem') {
      type = 'paragraph'
    }
    if (!node.content?.length) {
      return type === node.type ? node : { ...node, type }
    }
    const content = node.content.map((child) => walk(child, type))
    return { ...node, type, content }
  }
  return walk(doc)
}

/** 将 JSON 文档树中的非法根块 / 非列表 `paragraph` 改为 `para` */
export function migrateParagraphInJson(doc: JSONContent): JSONContent {
  const normalized = migrateListItemParaToParagraphInJson(doc)
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
  return walk(normalized)
}
