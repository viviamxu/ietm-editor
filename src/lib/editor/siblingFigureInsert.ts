import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";

import { getDescriptionSchema } from "../../store/descriptionSchemaStore";
import { isIpdDm } from "../s1000d/dmContentKind";

const IPD_DOC_FMFT_TYPES = new Set(["figure", "multimedia"]);

export type FmftBlockRef = { blockPos: number; block: PMNode };

function findEnclosingFigure(
  doc: Editor["state"]["doc"],
  pos: number,
): FmftBlockRef | null {
  const $pos = doc.resolve(pos);
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === "figure") {
      return { blockPos: $pos.before(d), block: $pos.node(d) };
    }
  }
  return null;
}

function findEnclosingDocFmftBlock(
  doc: Editor["state"]["doc"],
  pos: number,
): FmftBlockRef | null {
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
): FmftBlockRef | null {
  let childPos = 1;
  let last: FmftBlockRef | null = null;
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
): FmftBlockRef | null {
  let childPos = 1;
  let last: FmftBlockRef | null = null;
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

function resolveIpdTargetFmftBlockForSiblingInsert(
  editor: Editor,
): FmftBlockRef | null {
  const { selection, doc } = editor.state;

  if (selection instanceof NodeSelection) {
    const selected = selection.node;
    if (IPD_DOC_FMFT_TYPES.has(selected.type.name)) {
      return { blockPos: selection.from, block: selected };
    }
    if (
      selected.type.name === "graphic" ||
      selected.type.name === "multimediaObject"
    ) {
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

function resolveIpdSiblingInsertPos(
  editor: Editor,
  target: FmftBlockRef | null,
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

/** 描述/程序等：解析 sibling 插入所参照的 `figure`（工具栏插入用）。 */
function resolveTargetFigureForSiblingInsert(
  editor: Editor,
): FmftBlockRef | null {
  const { selection, doc } = editor.state;

  if (selection instanceof NodeSelection) {
    const selected = selection.node;
    if (selected.type.name === "figure") {
      return { blockPos: selection.from, block: selected };
    }
    if (selected.type.name === "graphic") {
      return findEnclosingFigure(doc, selection.from);
    }
  }

  return findEnclosingFigure(doc, selection.from);
}

/**
 * 工具栏 sibling 插入：解析参照块。
 * 图解类可参照 `figure` / `multimedia`；其它 DM 仅参照 `figure`。
 */
export function resolveTargetForSiblingFigureInsert(
  editor: Editor,
): FmftBlockRef | null {
  if (isIpdDm(getDescriptionSchema())) {
    return resolveIpdTargetFmftBlockForSiblingInsert(editor);
  }
  return resolveTargetFigureForSiblingInsert(editor);
}

/**
 * sibling `figure` 插入位置；无参照块时返回 `null`（由调用方按当前选区插入）。
 */
export function resolveSiblingFigureInsertPos(
  editor: Editor,
  target: FmftBlockRef | null,
): number | null {
  if (target) return target.blockPos + target.block.nodeSize;
  if (isIpdDm(getDescriptionSchema())) {
    return resolveIpdSiblingInsertPos(editor, null);
  }
  return null;
}
