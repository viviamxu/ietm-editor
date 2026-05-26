import type { Editor } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";

export type InsertMultimediaPayload = {
  /** 映射为 `multimediaObject@infoEntityIdent` */
  infoEntityIdent: string;
};

/** 在光标处插入 S1000D `multimedia` / `multimediaObject` 块 */
export function insertMultimediaIntoEditor(
  editor: Editor,
  items: InsertMultimediaPayload[],
): boolean {
  if (items.length === 0) return false;
  const nodes: JSONContent[] = [];
  for (const item of items) {
    const ident = item.infoEntityIdent.trim();
    if (!ident) continue;
    nodes.push({
      type: "multimedia",
      content: [
        {
          type: "multimediaObject",
          attrs: { infoEntityIdent: ident },
        },
      ],
    });
  }
  if (nodes.length === 0) return false;
  return editor.chain().focus().insertContent(nodes).run();
}
