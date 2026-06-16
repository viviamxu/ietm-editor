import type { Schema } from "@tiptap/pm/model";
import { Fragment, Node as PMNode, Slice } from "@tiptap/pm/model";

/** ProseMirror 内部复制会在 HTML 中携带 `data-pm-slice`。 */
export function isInternalEditorPaste(html: string): boolean {
  return /data-pm-slice/i.test(html);
}

/** 外部粘贴时丢弃的媒体相关节点（仅去掉图片本身，保留同段文字）。 */
const PASTE_DISCARDED_NODE_TYPES = new Set([
  "image",
  "graphic",
  "figure",
  "multimedia",
  "multimediaObject",
]);

function isDiscardedPasteNode(node: PMNode): boolean {
  return PASTE_DISCARDED_NODE_TYPES.has(node.type.name);
}

function resetBlockAttrs(attrs: Record<string, unknown>): Record<string, unknown> {
  const next = { ...attrs };
  if (Object.prototype.hasOwnProperty.call(next, "textAlign")) {
    next.textAlign = "left";
  }
  return next;
}

function sanitizeFragment(fragment: Fragment, schema: Schema): Fragment {
  const nodes: PMNode[] = [];

  fragment.forEach((node) => {
    if (isDiscardedPasteNode(node)) return;

    if (node.isText) {
      nodes.push(schema.text(node.text ?? ""));
      return;
    }
    if (node.isLeaf) {
      nodes.push(node.copy());
      return;
    }

    const cleaned = sanitizeFragment(node.content, schema);
    if (cleaned.size === 0 && node.content.size > 0) return;

    nodes.push(
      node.type.create(
        resetBlockAttrs(node.attrs as Record<string, unknown>),
        cleaned,
      ),
    );
  });

  return Fragment.fromArray(nodes);
}

/**
 * 外部粘贴清理：清除行内 mark，丢弃图片/figure/multimedia 节点，保留段落结构。
 */
export function sanitizeExternalPasteSlice(slice: Slice, schema: Schema): Slice {
  return new Slice(
    sanitizeFragment(slice.content, schema),
    slice.openStart,
    slice.openEnd,
  );
}
