import type { Editor, JSONContent } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";

import { SOURCE_XML_ATTR_KEYS } from "../s1000d/sourceXmlAttrKeys";
import type { InsertImagePayload } from "../../types/toolbar";

/** 将插入参数转为 S1000D `figure`（`title?` + `graphic`），与导入/XML 结构一致。 */
export function buildFigureJsonFromImagePayload(
  img: InsertImagePayload,
): JSONContent {
  const iei = img.figureId?.trim() || "ICN-UNKNOWN";
  const titleText = img.alt?.trim() ?? "";
  const src = img.src?.trim() ?? "";
  return {
    type: "figure",
    attrs: { id: `fig-${iei}` },
    content: [
      {
        type: "title",
        content: titleText ? [{ type: "text", text: titleText }] : [],
      },
      {
        type: "graphic",
        attrs: {
          infoEntityIdent: iei,
          src,
          [SOURCE_XML_ATTR_KEYS]: src
            ? ["infoEntityIdent", "src"]
            : ["infoEntityIdent"],
        },
      },
    ],
  };
}

/** 在光标处插入一张或多张 S1000D `figure`（内含 `graphic`；兼容旧称 insertImages）。 */
export function insertImagesIntoEditor(
  editor: Editor,
  images: InsertImagePayload[],
): boolean {
  if (images.length === 0) return false;
  const nodes = images.map(buildFigureJsonFromImagePayload);

  const { selection } = editor.state;
  if (selection instanceof NodeSelection) {
    const insertPos = selection.from + selection.node.nodeSize;
    return editor.chain().focus().insertContentAt(insertPos, nodes).run();
  }

  return editor.chain().focus().insertContent(nodes).run();
}
