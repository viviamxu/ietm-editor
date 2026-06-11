/** 编辑器节点类型 → S1000D `internalRefTargetType`（节选）。 */
const NODE_TYPE_TO_INTERNAL_REF_TARGET_TYPE: Record<string, string> = {
  figure: "irtt01",
  graphic: "irtt01",
  table: "irtt02",
  para: "irtt03",
  levelledPara: "irtt03",
};

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 由引用目标节点类型推断 `internalRefTargetType`；未知类型返回 `null`。 */
export function resolveInternalRefTargetType(
  targetNodeType: string | null | undefined,
): string | null {
  const key = String(targetNodeType ?? "").trim();
  if (!key) return null;
  return NODE_TYPE_TO_INTERNAL_REF_TARGET_TYPE[key] ?? null;
}

/** 导出 S1000D `<internalRef … />`（与样例 DM 一致的自闭合形式）。 */
export function serializeInternalRefToXml(
  attrs: Record<string, unknown> | null | undefined,
): string {
  const refId = String(attrs?.internalRefId ?? "").trim();
  if (!refId) return "";

  const irrtt = String(attrs?.internalRefTargetType ?? "").trim();
  const irrttAttr = irrtt
    ? ` internalRefTargetType="${escapeXml(irrtt)}"`
    : "";

  return `<internalRef internalRefId="${escapeXml(refId)}"${irrttAttr} />`;
}

/** `internalRef` 节点是否应参与导出（含仅含引用的空段落）。 */
export function internalRefHasExportableContent(
  attrs: Record<string, unknown> | null | undefined,
): boolean {
  return Boolean(String(attrs?.internalRefId ?? "").trim());
}
