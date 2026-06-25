import type { Editor } from "@tiptap/core";
import { Fragment, Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

const CREW_CONDITION_TYPES = new Set(["if", "elseIf", "case"]);

function isCrewConditionType(typeName: string): boolean {
  return CREW_CONDITION_TYPES.has(typeName);
}

function siblingsWithoutIndex(parent: PMNode, index: number): PMNode[] {
  const siblings: PMNode[] = [];
  for (let i = 0; i < parent.childCount; i++) {
    if (i !== index) siblings.push(parent.child(i));
  }
  return siblings;
}

/** 解析 `if` / `elseIf` / `case` 及其文档起始位置。 */
export function resolveCrewConditionAtPos(
  doc: PMNode,
  pos: number,
): { block: PMNode; blockPos: number } | null {
  try {
    const atPos = doc.nodeAt(pos);
    if (atPos && isCrewConditionType(atPos.type.name)) {
      return { block: atPos, blockPos: pos };
    }

    const $pos = doc.resolve(pos);
    const after = $pos.nodeAfter;
    if (after && isCrewConditionType(after.type.name)) {
      return { block: after, blockPos: pos };
    }

    for (let d = $pos.depth; d > 0; d--) {
      if (!isCrewConditionType($pos.node(d).type.name)) continue;
      const blockPos = $pos.before(d);
      const block = doc.nodeAt(blockPos);
      if (block && isCrewConditionType(block.type.name)) {
        return { block, blockPos };
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** 是否允许删除整块 `if` / `elseIf` / `case`（含其子步骤）。 */
export function canDeleteCrewCondition(doc: PMNode, blockPos: number): boolean {
  const resolved = resolveCrewConditionAtPos(doc, blockPos);
  if (!resolved) return false;

  try {
    const { blockPos: actualPos } = resolved;
    const $pos = doc.resolve(actualPos);
    const parent = $pos.parent;
    const siblings = siblingsWithoutIndex(parent, $pos.index());
    return parent.type.validContent(Fragment.from(siblings));
  } catch {
    return false;
  }
}

/** 删除整块 `if` / `elseIf` / `case`。 */
export function deleteCrewConditionAtPos(
  editor: Editor,
  blockPos: number,
): boolean {
  if (!editor.isEditable) return false;

  const doc = editor.state.doc;
  if (!canDeleteCrewCondition(doc, blockPos)) return false;

  const resolved = resolveCrewConditionAtPos(doc, blockPos);
  if (!resolved) return false;

  const { block, blockPos: actualPos } = resolved;

  return editor
    .chain()
    .focus()
    .command(({ tr, dispatch }) => {
      if (!dispatch) return true;

      tr.delete(actualPos, actualPos + block.nodeSize);
      const insertPos = Math.min(tr.mapping.map(actualPos), tr.doc.content.size);
      tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos), -1));
      dispatch(tr);
      return true;
    })
    .run();
}
