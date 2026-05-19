import type { Editor } from "@tiptap/core";

import type { InsertImagePayload } from "../../types/toolbar";

/** 在光标处插入一张或多张 S1000D `image` 节点 */
export function insertImagesIntoEditor(
  editor: Editor,
  images: InsertImagePayload[],
): boolean {
  if (images.length === 0) return false;
  const nodes = images.map((img) => ({
    type: "image" as const,
    attrs: {
      src: img.src,
      ...(img.alt != null ? { alt: img.alt } : {}),
      ...(img.figureId != null ? { figureId: img.figureId } : {}),
      ...(img.unitOfMeasure != null
        ? { unitOfMeasure: img.unitOfMeasure }
        : {}),
    },
  }));
  return editor.chain().focus().insertContent(nodes).run();
}
