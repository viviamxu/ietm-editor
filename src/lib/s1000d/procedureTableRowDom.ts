import type { Node as PMNode } from "@tiptap/pm/model";

/** 程序类表格行 PM 节点（隐藏宿主 + 可见 Arco Table 行共用）。 */
export const PROCEDURE_TABLE_ROW_NODE_TYPES = new Set([
  "supportEquipDescr",
  "supplyDescr",
  "spareDescr",
  "personnel",
]);

export function readPmNodeElementId(node: PMNode): string | null {
  if (!("id" in (node.type.spec.attrs ?? {}))) return null;
  const raw = node.attrs.id;
  if (raw == null) return null;
  const id = String(raw).trim();
  return id.length > 0 ? id : null;
}

/** Arco `Table` `onRow`：绑定文档位置与元素 id，供内部引用跳转定位可见行。 */
export function procedureTableRowDomProps(input: {
  pos: number;
  elementId?: string | null;
}): Record<string, string> {
  const out: Record<string, string> = {
    "data-s1000d-doc-pos": String(input.pos),
    className: "s1000d-procedure-table-row",
  };
  const id = input.elementId?.trim();
  if (id) {
    out["data-s1000d-element-id"] = id;
  }
  return out;
}
