import type { ParaAttrs } from '../../extensions/s1000d/types'
import { s1000dIdAttributeConfig } from './s1000dIdAttribute'
import {
  SOURCE_XML_ATTR_KEYS,
  xmlAttrsPresentOnElement,
} from './sourceXmlAttrKeys'

/** 与 S1000D `<para>` 往返一致的属性名（`para` / 列表内 `paragraph` 共用） */
export const PARA_XML_ATTR_NAMES = [
  'id',
  'securityClassification',
  'caveat',
  'derivativeClassificationRefId',
  'reasonForUpdateRefIds',
] as const

export function readParaAttrsFromDom(el: Element) {
  return {
    id: el.getAttribute('id') ?? el.getAttribute('data-s1000d-element-id'),
    securityClassification: el.getAttribute('securityClassification'),
    caveat: el.getAttribute('caveat'),
    derivativeClassificationRefId: el.getAttribute(
      'derivativeClassificationRefId',
    ),
    reasonForUpdateRefIds: el.getAttribute('reasonForUpdateRefIds'),
    [SOURCE_XML_ATTR_KEYS]: xmlAttrsPresentOnElement(el, [
      ...PARA_XML_ATTR_NAMES,
    ]),
  }
}

/** `para` 与列表 `paragraph` 共用的 schema 属性定义 */
export function s1000dParaAttributeSpec(): Record<
  keyof ParaAttrs,
  { default: string | null }
> {
  return {
    id: s1000dIdAttributeConfig(),
    securityClassification: { default: null },
    caveat: { default: null },
    derivativeClassificationRefId: { default: null },
    reasonForUpdateRefIds: { default: null },
  }
}
