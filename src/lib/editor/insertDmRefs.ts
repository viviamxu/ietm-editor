import type { Editor, JSONContent } from "@tiptap/core";

import { normalizeDmRefEditorAttrs } from "../s1000d/dmRefXml";
import { SOURCE_XML_ATTR_KEYS } from "../s1000d/sourceXmlAttrKeys";
import type { InsertDmRefPayload } from "../../types/toolbar";

/** 将宿主选中的 DM 引用转为 `dmRef` 节点 JSON。 */
export function buildDmRefJsonFromPayload(item: InsertDmRefPayload): JSONContent {
  const normalized = normalizeDmRefEditorAttrs(
    item.rawXml,
    item.displayCode,
    item.refTargetId,
  );
  return {
    type: "dmRef",
    attrs: {
      rawXml: normalized.rawXml,
      displayCode: normalized.displayCode,
      refTargetId: normalized.refTargetId,
      [SOURCE_XML_ATTR_KEYS]: ["rawXml"],
    },
  };
}

/** 当前选区是否允许插入 `dmRef`（宿主插入前可先校验）。 */
export function canInsertDmRefIntoEditor(
  editor: Editor,
  item: InsertDmRefPayload,
): boolean {
  const rawXml = item.rawXml.trim();
  if (!rawXml || !editor.state.schema.nodes.dmRef) return false;
  return editor.can().insertContent(buildDmRefJsonFromPayload(item));
}

/** 在光标处插入一条或多条 S1000D `dmRef`（`attrs.rawXml` 为完整 `<dmRef>…</dmRef>`）。 */
export function insertDmRefsIntoEditor(
  editor: Editor,
  items: InsertDmRefPayload[],
): boolean {
  const nodes = items
    .filter((item) => item.rawXml.trim())
    .map((item) => buildDmRefJsonFromPayload(item));
  if (nodes.length === 0) return false;
  if (!editor.can().insertContent(nodes.length === 1 ? nodes[0] : nodes)) {
    return false;
  }
  return editor.chain().focus().insertContent(nodes).run();
}
