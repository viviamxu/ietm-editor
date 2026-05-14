/**
 * 记录「源 XML/HTML 元素上实际出现过的」属性名（不含导出到 S1000D XML 的语义），
 * 供属性面板只展示这些字段（`id` / `figureId` 仍始终单独展示）。
 */
export const SOURCE_XML_ATTR_KEYS = 'sourceXmlAttrKeys' as const

export type SourceXmlAttrKeysValue = string[] | null

export function hasXmlAttr(el: Element, name: string): boolean {
  if (el.hasAttribute(name)) return true
  const low = name.toLowerCase()
  return low !== name && el.hasAttribute(low)
}

/** 按 `names` 顺序返回在元素上存在的属性名（用于写入节点 attrs，保持与 XML 声明顺序一致） */
export function xmlAttrsPresentOnElement(
  el: Element,
  names: readonly string[],
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const n of names) {
    if (!hasXmlAttr(el, n)) continue
    if (seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}

function attrValueNonEmpty(v: unknown): boolean {
  if (v == null) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (typeof v === 'number') return !Number.isNaN(v)
  return true
}

/**
 * 在写回任意非主键属性后，维护 `sourceXmlAttrKeys`：
 * - 若已有数组：按出现集合增删键；
 * - 若为旧文档缺失该字段：用当前非空属性值初始化集合后再应用 patch。
 */
export function mergeSourceXmlAttrKeysAfterPatch(input: {
  liveAttrs: Record<string, unknown>
  primaryKey: string | null
  patch: Record<string, unknown>
  schemaAttrKeys: readonly string[]
}): Record<string, unknown> {
  const { liveAttrs, primaryKey, patch, schemaAttrKeys } = input
  if (Object.prototype.hasOwnProperty.call(patch, SOURCE_XML_ATTR_KEYS)) {
    return { ...patch }
  }

  const skip = new Set<string>([
    SOURCE_XML_ATTR_KEYS,
    'class',
    'start',
    ...(primaryKey ? [primaryKey] : []),
  ])

  const next = new Set<string>()
  const prev = liveAttrs[SOURCE_XML_ATTR_KEYS]
  if (Array.isArray(prev)) {
    for (const x of prev) {
      if (typeof x === 'string' && x !== primaryKey) next.add(x)
    }
  } else {
    for (const k of schemaAttrKeys) {
      if (skip.has(k)) continue
      if (k === primaryKey) continue
      if (k === "displayLevel") continue
      if (attrValueNonEmpty(liveAttrs[k])) next.add(k)
    }
  }

  const out: Record<string, unknown> = { ...patch }
  for (const [k, v] of Object.entries(patch)) {
    if (k === SOURCE_XML_ATTR_KEYS) continue
    if (skip.has(k)) continue
    if (k === primaryKey) continue
    if (attrValueNonEmpty(v)) next.add(k)
    else next.delete(k)
  }

  out[SOURCE_XML_ATTR_KEYS] = [...next].sort((a, b) => a.localeCompare(b))
  return out
}

export function shouldShowSecondaryPanelAttr(input: {
  nodeType: string
  attrKey: string
  liveAttrs: Record<string, unknown>
  primaryKey: string | null
}): boolean {
  const { attrKey, liveAttrs, primaryKey } = input
  if (attrKey === SOURCE_XML_ATTR_KEYS) return false
  if (primaryKey && attrKey === primaryKey) return false

  const present = liveAttrs[SOURCE_XML_ATTR_KEYS]
  if (Array.isArray(present)) {
    return present.includes(attrKey)
  }

  /** 编辑器内部级数，默认恒为数值；不得用「非空」兜底显示，否则会冒充源 XML 属性 */
  if (attrKey === "displayLevel") return false

  return attrValueNonEmpty(liveAttrs[attrKey])
}
