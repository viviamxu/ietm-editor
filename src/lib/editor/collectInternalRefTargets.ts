import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

/** 弹框表格一行：可引用的 S1000D 元素 */
export interface InternalRefTargetRow {
  /** 表格行唯一键（文档位置 + 类型） */
  key: string;
  id: string;
  /** 标签名（节点类型名，如 para、figure） */
  type: string;
  /** 该节点及其子树的纯文本 */
  context: string;
}

const EXCLUDED_NODE_TYPES = new Set(["internalRef", "doc", "text"]);

function readNodeId(node: ProseMirrorNode): string | null {
  if (!("id" in (node.type.spec.attrs ?? {}))) return null;
  const raw = node.attrs.id;
  if (raw == null) return null;
  const id = String(raw).trim();
  return id.length > 0 ? id : null;
}

function normalizeContext(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * 遍历编辑器正文，收集所有带 `id` 的 S1000D 节点（排除 `internalRef` 等非目标节点）。
 */
export function collectInternalRefTargets(
  editor: Editor,
): InternalRefTargetRow[] {
  const rows: InternalRefTargetRow[] = [];

  editor.state.doc.descendants((node, pos) => {
    if (EXCLUDED_NODE_TYPES.has(node.type.name)) return;
    if (node.isText) return;

    const id = readNodeId(node);
    if (!id) return;

    rows.push({
      key: `${pos}-${node.type.name}`,
      id,
      type: node.type.name,
      context: normalizeContext(node.textContent) || "—",
    });
  });

  return rows;
}
