import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";

import { getDescriptionSchema } from "../../store/descriptionSchemaStore";
import { isIpdDm } from "../s1000d/dmContentKind";

const IPD_DOC_FMFT_TYPES = new Set(["figure", "multimedia"]);

export type IpdFmftBlockRef = { blockPos: number; block: PMNode };

function findEnclosingDocFmftBlock(
  doc: Editor["state"]["doc"],
  pos: number,
): IpdFmftBlockRef | null {
  const $pos = doc.resolve(pos);
  for (let d = $pos.depth; d > 0; d--) {
    const node = $pos.node(d);
    if (
      IPD_DOC_FMFT_TYPES.has(node.type.name) &&
      $pos.node(d - 1).type.name === "doc"
    ) {
      return { blockPos: $pos.before(d), block: node };
    }
  }
  return null;
}

function findLastDocFmftBlockBeforeCatalog(
  doc: Editor["state"]["doc"],
): IpdFmftBlockRef | null {
  let childPos = 1;
  let last: IpdFmftBlockRef | null = null;
  for (let i = 0; i < doc.childCount; i++) {
    const child = doc.child(i);
    if (child.type.name === "catalogSeqNumberGroup") break;
    if (IPD_DOC_FMFT_TYPES.has(child.type.name)) {
      last = { blockPos: childPos, block: child };
    }
    childPos += child.nodeSize;
  }
  return last;
}

function findDocFmftBlockBeforePos(
  doc: Editor["state"]["doc"],
  pos: number,
): IpdFmftBlockRef | null {
  let childPos = 1;
  let last: IpdFmftBlockRef | null = null;
  for (let i = 0; i < doc.childCount; i++) {
    const child = doc.child(i);
    if (child.type.name === "catalogSeqNumberGroup") break;
    if (IPD_DOC_FMFT_TYPES.has(child.type.name) && childPos <= pos) {
      last = { blockPos: childPos, block: child };
    }
    childPos += child.nodeSize;
  }
  return last;
}

/** 图解类：解析 sibling 插入所参照的 `figure` / `multimedia`（工具栏插入用）。 */
export function resolveIpdTargetFmftBlockForSiblingInsert(
  editor: Editor,
): IpdFmftBlockRef | null {
  if (!isIpdDm(getDescriptionSchema())) return null;

  const { selection, doc } = editor.state;

  if (selection instanceof NodeSelection) {
    const selected = selection.node;
    if (IPD_DOC_FMFT_TYPES.has(selected.type.name)) {
      return { blockPos: selection.from, block: selected };
    }
    if (selected.type.name === "graphic" || selected.type.name === "multimediaObject") {
      return findEnclosingDocFmftBlock(doc, selection.from);
    }
  }

  const enclosing = findEnclosingDocFmftBlock(doc, selection.from);
  if (enclosing) return enclosing;

  if (selection.$from.parent.type.name === "doc") {
    const before = findDocFmftBlockBeforePos(doc, selection.from);
    if (before) return before;
  }

  return findLastDocFmftBlockBeforeCatalog(doc);
}

/** 图解类：在目标 fmft 块之后（或无目标时在 catalog 前）的插入位置。 */
export function resolveIpdSiblingInsertPos(
  editor: Editor,
  target: IpdFmftBlockRef | null,
): number {
  if (target) return target.blockPos + target.block.nodeSize;

  const doc = editor.state.doc;
  let childPos = 1;
  for (let i = 0; i < doc.childCount; i++) {
    const child = doc.child(i);
    if (child.type.name === "catalogSeqNumberGroup") return childPos;
    childPos += child.nodeSize;
  }
  return doc.content.size;
}
