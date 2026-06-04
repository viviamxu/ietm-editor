import { PROCEDURE_BLOCK_INSPECTABLE_TYPES } from '../s1000d/procedureInspectableTypes'

/** 与 `resolveInspectable`、属性面板、`sourceXmlAttrKeys` 全局扩展共用的可检视节点名列表 */
const BASE_INSPECTABLE_NODE_TYPE_LIST = [
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
  'multimedia',
  'multimediaObject',
  'note',
  'noteLead',
  'notePara',
  'para',
  'paragraph',
  'table',
  'title',
  'tgroup',
  'warning',
  'warningAndCautionLead',
  'warningAndCautionPara',
  /** 故障隔离 */
  'fault',
  'isolationStep',
  'isolationProcedureEnd',
  'choice',
  'yesAnswer',
  'noAnswer',
] as const

export const INSPECTABLE_NODE_TYPE_LIST = [
  ...BASE_INSPECTABLE_NODE_TYPE_LIST,
  ...PROCEDURE_BLOCK_INSPECTABLE_TYPES.filter(
    (name) =>
      !BASE_INSPECTABLE_NODE_TYPE_LIST.includes(
        name as (typeof BASE_INSPECTABLE_NODE_TYPE_LIST)[number],
      ),
  ),
] as const

export const INSPECTABLE_NODE_TYPES = new Set<string>(INSPECTABLE_NODE_TYPE_LIST)
