import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";

/** `fmftElemGroup` 块：其后可接 S1000D `para`。 */
export const FMFT_BLOCK_TYPES = new Set(["multimedia", "figure", "table"]);

/** 允许 `para` 跟在 fmft 块后的容器。 */
export const FMFT_PARA_CONTAINER_TYPES = new Set([
  "proceduralStep",
  "levelledPara",
]);

function childPos(parentPos: number, parent: PMNode, childIndex: number): number {
  let pos = parentPos + 1;
  for (let i = 0; i < childIndex; i++) {
    pos += parent.child(i).nodeSize;
  }
  return pos;
}

function focusParaAt(editor: Editor, paraPos: number): boolean {
  const cursorPos = Math.min(paraPos + 1, editor.state.doc.content.size);
  return editor.chain().focus().setTextSelection(cursorPos).run();
}

/** 在 fmft 块后插入空 `para`（或聚焦其后已有 `para`）。 */
export function insertParaAfterFmftBlock(
  editor: Editor,
  blockPos: number,
  block: PMNode,
): boolean {
  const paraType = editor.state.schema.nodes.para;
  if (!paraType) return false;
  if (!FMFT_BLOCK_TYPES.has(block.type.name)) return false;

  const insertPos = blockPos + block.nodeSize;
  const $insert = editor.state.doc.resolve(insertPos);
  const parent = $insert.parent;
  if (!FMFT_PARA_CONTAINER_TYPES.has(parent.type.name)) return false;

  const nextIndex = $insert.index();
  if (nextIndex < parent.childCount) {
    const next = parent.child(nextIndex);
    if (next.type.name === "para") {
      return focusParaAt(editor, insertPos);
    }
  }

  const para = paraType.create();
  if (!parent.type.validContent(parent.content.addToEnd(para))) return false;

  return editor
    .chain()
    .focus()
    .insertContentAt(insertPos, { type: "para", content: [] })
    .run();
}

function resolveFmftBlockFromNodeSelection(
  editor: Editor,
): { pos: number; node: PMNode } | null {
  const { selection, doc } = editor.state;
  if (!(selection instanceof NodeSelection)) return null;

  if (FMFT_BLOCK_TYPES.has(selection.node.type.name)) {
    return { pos: selection.from, node: selection.node };
  }

  if (selection.node.type.name === "multimediaObject") {
    const $pos = doc.resolve(selection.from);
    for (let d = $pos.depth; d > 0; d--) {
      const node = $pos.node(d);
      if (node.type.name === "multimedia") {
        return { pos: $pos.before(d), node };
      }
    }
  }

  return null;
}

/** Enter：选中 fmft 块（或内层 `multimediaObject`）时在其后插入/聚焦 `para`。 */
export function handleFmftBlockEnter(editor: Editor): boolean {
  const found = resolveFmftBlockFromNodeSelection(editor);
  if (!found) return false;
  return insertParaAfterFmftBlock(editor, found.pos, found.node);
}

/** 根据当前选区定位紧邻光标前的 fmft 块。 */
export function findFmftBlockBeforeSelection(
  editor: Editor,
): { pos: number; node: PMNode } | null {
  const { selection } = editor.state;
  if (selection instanceof NodeSelection) {
    return resolveFmftBlockFromNodeSelection(editor);
  }

  const $from = selection.$from;
  for (let d = $from.depth; d > 0; d--) {
    const parent = $from.node(d);
    if (!FMFT_PARA_CONTAINER_TYPES.has(parent.type.name)) continue;

    const index = $from.index(d);
    if (index === 0) continue;

    const prev = parent.child(index - 1);
    if (!FMFT_BLOCK_TYPES.has(prev.type.name)) continue;

    return {
      pos: childPos($from.before(d), parent, index - 1),
      node: prev,
    };
  }
  return null;
}

/** 插入 fmft 块后，确保其后有可编辑的 `para` 并聚焦。 */
export function ensureParaAfterFmftFromSelection(editor: Editor): boolean {
  const found = findFmftBlockBeforeSelection(editor);
  if (!found) return false;
  return insertParaAfterFmftBlock(editor, found.pos, found.node);
}
