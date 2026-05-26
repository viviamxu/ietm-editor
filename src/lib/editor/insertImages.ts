import type { Editor, JSONContent } from "@tiptap/core";

import type { InsertImagePayload } from "../../types/toolbar";

/** 将插入参数转为 S1000D `figure`（`title?` + `graphic`），与导入/XML 结构一致。 */
export function buildFigureJsonFromImagePayload(
  img: InsertImagePayload,
): JSONContent {
  const iei = img.figureId?.trim() || "ICN-UNKNOWN";
  const titleText = img.alt?.trim() ?? "";
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
          src: img.src?.trim() ?? "",
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
  return editor.chain().focus().insertContent(nodes).run();
}
