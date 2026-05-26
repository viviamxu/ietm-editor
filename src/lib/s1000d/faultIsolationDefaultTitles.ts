import type { Node as PMNode } from "@tiptap/pm/model";

/** 从 `title` 节点提取纯文本。 */
export function getTitleTextFromNode(titleNode: PMNode | null | undefined): string {
  if (!titleNode || titleNode.type.name !== "title") return "";
  let text = "";
  titleNode.descendants((n) => {
    if (n.isText) text += n.text ?? "";
  });
  return text.trim();
}
