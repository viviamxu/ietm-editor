/** SDK 扩展：`<dmRef>` 上用于 DM XML round-trip 的属性名（文档化，非 S1000D 标准）。 */
export const DM_REF_DISPLAY_CODE_ATTR = "data-display-code";
export const DM_REF_TARGET_ID_ATTR = "data-ref-target-id";

function parseDmRefRootDocument(rawXml: string): Document | null {
  try {
    const doc = new DOMParser().parseFromString(rawXml, "application/xml");
    if (doc.querySelector("parsererror")) return null;
    const root = doc.documentElement;
    if (!root || !/^dmref$/i.test(root.localName)) return null;
    return doc;
  } catch {
    return null;
  }
}

function serializeDmRefRoot(root: Element): string {
  return new XMLSerializer().serializeToString(root);
}

export type DmRefEditorAttrs = {
  rawXml: string;
  displayCode: string | null;
  refTargetId: string | null;
};

/**
 * 从 `<dmRef>` XML 与可选载荷合并编辑器 attrs：扩展属性从 XML 根节点剥离，仅存于节点字段。
 */
export function normalizeDmRefEditorAttrs(
  rawXml: string,
  displayCode?: string | null,
  refTargetId?: string | null,
): DmRefEditorAttrs {
  const trimmed = rawXml.trim();
  if (!trimmed) {
    return {
      rawXml: "",
      displayCode: displayCode?.trim() || null,
      refTargetId: refTargetId?.trim() || null,
    };
  }

  const doc = parseDmRefRootDocument(trimmed);
  if (!doc) {
    return {
      rawXml: trimmed,
      displayCode: displayCode?.trim() || null,
      refTargetId: refTargetId?.trim() || null,
    };
  }

  const root = doc.documentElement;
  const fromXmlDisplay = root.getAttribute(DM_REF_DISPLAY_CODE_ATTR)?.trim() || null;
  const fromXmlTarget = root.getAttribute(DM_REF_TARGET_ID_ATTR)?.trim() || null;
  root.removeAttribute(DM_REF_DISPLAY_CODE_ATTR);
  root.removeAttribute(DM_REF_TARGET_ID_ATTR);

  return {
    rawXml: serializeDmRefRoot(root),
    displayCode: displayCode?.trim() || fromXmlDisplay || null,
    refTargetId: refTargetId?.trim() || fromXmlTarget || null,
  };
}

/** 导出 DM XML：将 `displayCode` / `refTargetId` 写入 `<dmRef>` 根节点扩展属性。 */
export function serializeDmRefToXml(attrs: {
  rawXml?: string | null;
  displayCode?: string | null;
  refTargetId?: string | null;
}): string {
  const normalized = normalizeDmRefEditorAttrs(
    String(attrs.rawXml ?? ""),
    attrs.displayCode,
    attrs.refTargetId,
  );
  if (!normalized.rawXml) return "";

  const doc = parseDmRefRootDocument(normalized.rawXml);
  if (!doc) return normalized.rawXml;

  const root = doc.documentElement;
  if (normalized.displayCode) {
    root.setAttribute(DM_REF_DISPLAY_CODE_ATTR, normalized.displayCode);
  } else {
    root.removeAttribute(DM_REF_DISPLAY_CODE_ATTR);
  }
  if (normalized.refTargetId) {
    root.setAttribute(DM_REF_TARGET_ID_ATTR, normalized.refTargetId);
  } else {
    root.removeAttribute(DM_REF_TARGET_ID_ATTR);
  }

  return serializeDmRefRoot(root);
}

/** 从 HTML/XML `<dmRef>` 元素读取 SDK 扩展属性（导入 parseHTML 用）。 */
export function readDmRefEditorAttrsFromElement(el: Element): {
  displayCode: string | null;
  refTargetId: string | null;
} {
  return {
    displayCode: el.getAttribute(DM_REF_DISPLAY_CODE_ATTR)?.trim() || null,
    refTargetId: el.getAttribute(DM_REF_TARGET_ID_ATTR)?.trim() || null,
  };
}
