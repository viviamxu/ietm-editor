import type { Editor } from "@tiptap/core";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";

const DELETABLE_FMFT_INNER_NODE_TYPES = new Set([
  "graphic",
  "multimediaObject",
]);

/** 删除当前选中的 `figure` / `multimedia` 内子节点（`graphic` 或 `multimediaObject`）。 */
export function deleteSelectedFmftInnerNode(editor: Editor): boolean {
  if (!editor.isEditable) return false;

  const { selection } = editor.state;
  if (!(selection instanceof NodeSelection)) return false;
  if (!DELETABLE_FMFT_INNER_NODE_TYPES.has(selection.node.type.name)) {
    return false;
  }

  const from = selection.from;
  const to = from + selection.node.nodeSize;

  return editor
    .chain()
    .focus()
    .command(({ tr, dispatch }) => {
      if (!dispatch) return true;
      tr.delete(from, to);
      const nearPos = Math.min(from, tr.doc.content.size);
      tr.setSelection(TextSelection.near(tr.doc.resolve(nearPos), -1));
      dispatch(tr);
      return true;
    })
    .run();
}
