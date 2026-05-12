/** S1000D `internalRefTargetType`（节选）；未知枚举值回退为原始码字符串。 */
const INTERNAL_REF_TARGET_TYPE_LABELS: Record<string, string> = {
  irtt01: '图 Figure',
  irtt02: '表 Table',
  irtt03: '段落 Para',
}

export function describeInternalRefTargetType(code?: string | null): string {
  if (!code) return '内部引用'
  return INTERNAL_REF_TARGET_TYPE_LABELS[code] ?? code
}
