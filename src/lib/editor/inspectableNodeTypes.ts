/** 与 `resolveInspectable`、属性面板、`sourceXmlAttrKeys` 全局扩展共用的可检视节点名列表 */
export const INSPECTABLE_NODE_TYPE_LIST = [
  'attentionListItemPara',
  'attentionRandomListItem',
  'attentionRandomList',
  'caution',
  'dmRef',
  'entry',
  'figure',
  'graphic',
  'image',
  'internalRef',
  'levelledPara',
  'note',
  'notePara',
  'para',
  'table',
  'title',
  'tgroup',
  'warning',
  'warningAndCautionLead',
  'warningAndCautionPara',
] as const

export const INSPECTABLE_NODE_TYPES = new Set<string>(INSPECTABLE_NODE_TYPE_LIST)
