import type { Editor, JSONContent } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

export function selectionAtLeadInInsertedBlock(
  doc: PMNode,
  blockPos: number,
): TextSelection | null {
  const block = doc.nodeAt(blockPos);
  if (!block) return null;

  const shellType = block.type.name;
  const leadType =
    shellType === "note"
      ? "noteLead"
      : shellType === "warning" || shellType === "caution"
        ? "warningAndCautionLead"
        : null;
  if (!leadType) return null;

  const paraType =
    shellType === "note" ? "notePara" : "warningAndCautionPara";
  const para = block.firstChild;
  if (!para || para.type.name !== paraType) return null;

  let pos = blockPos + 1 + 1;
  for (let i = 0; i < para.childCount; i++) {
    const child = para.child(i);
    if (child.type.name === leadType) {
      const caret = Math.min(pos + 1, doc.content.size);
      return TextSelection.create(doc, caret);
    }
    pos += child.nodeSize;
  }

  const caret = Math.min(blockPos + 1 + 1, doc.content.size);
  return TextSelection.create(doc, caret);
}

/** 将光标放进指定 `warning` / `caution` / `note` 块的引导文。 */
export function focusAttentionBlockAtPos(
  editor: Editor,
  blockPos: number,
): boolean {
  const sel = selectionAtLeadInInsertedBlock(editor.state.doc, blockPos);
  if (!sel) return false;
  return editor.chain().focus().setTextSelection(sel).run();
}

/** 在指定 attention 块之后插入 warning / caution / note，并聚焦到新块引导文。 */
export function insertAttentionAfterBlock(
  editor: Editor,
  afterBlockPos: number,
  node: JSONContent,
): boolean {
  const block = editor.state.doc.nodeAt(afterBlockPos);
  if (!block) return false;

  const insertPos = afterBlockPos + block.nodeSize;
  if (!editor.can().insertContentAt(insertPos, node)) return false;

  return editor
    .chain()
    .focus()
    .insertContentAt(insertPos, node)
    .command(({ tr, dispatch }) => {
      const mapped = tr.mapping.map(insertPos);
      const sel = selectionAtLeadInInsertedBlock(tr.doc, mapped);
      if (!sel) return true;
      if (!dispatch) return true;
      tr.setSelection(sel);
      dispatch(tr);
      return true;
    })
    .run();
}
