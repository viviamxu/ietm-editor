import type { Editor, JSONContent } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";

import { getDescriptionSchema } from "../../store/descriptionSchemaStore";
import { isIpdDm } from "../s1000d/dmContentKind";

const IPD_DOC_FMFT_TYPES = new Set(["figure", "multimedia"]);

export type FmftBlockRef = { blockPos: number; block: PMNode };

/** schema 或正文结构（含 `catalogSeqNumberGroup`）判定图解类插入语境。 */
function isIpdLikeDoc(doc: Editor["state"]["doc"]): boolean {
  if (isIpdDm(getDescriptionSchema())) return true;
  for (let i = 0; i < doc.childCount; i++) {
    if (doc.child(i).type.name === "catalogSeqNumberGroup") return true;
  }
  return false;
}

/** 物料表边界：优先第一个非空 `catalogSeqNumberGroup`，否则第一个空表。 */
function findFirstCatalogSeqNumberGroupBoundary(
  doc: Editor["state"]["doc"],
): { childPos: number } | null {
  let childPos = 1;
  let firstEmpty: { childPos: number } | null = null;

  for (let i = 0; i < doc.childCount; i++) {
    const child = doc.child(i);
    if (child.type.name !== "catalogSeqNumberGroup") {
      childPos += child.nodeSize;
      continue;
    }
    if (child.childCount > 0) return { childPos };
    if (!firstEmpty) firstEmpty = { childPos };
    childPos += child.nodeSize;
  }

  return firstEmpty;
}

function isCatalogSeqNumberGroupBoundary(child: PMNode): boolean {
  return child.type.name === "catalogSeqNumberGroup" && child.childCount > 0;
}

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
  const boundary = findFirstCatalogSeqNumberGroupBoundary(doc);
  const stopPos = boundary?.childPos ?? doc.content.size + 1;

  let childPos = 1;
  let last: FmftBlockRef | null = null;
  for (let i = 0; i < doc.childCount; i++) {
    const child = doc.child(i);
    if (childPos >= stopPos) break;
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
    if (isCatalogSeqNumberGroupBoundary(child)) break;
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

/** 图解类：插在最后一个 `figure`/`multimedia` 之后（物料表边界之前）。 */
function resolveIpdFmftSiblingInsertPos(editor: Editor): number {
  const last = findLastDocFmftBlockBeforeCatalog(editor.state.doc);
  if (last) return last.blockPos + last.block.nodeSize;

  const boundary = findFirstCatalogSeqNumberGroupBoundary(editor.state.doc);
  return boundary?.childPos ?? editor.state.doc.content.size;
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
  if (isIpdLikeDoc(editor.state.doc)) {
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
  if (isIpdLikeDoc(editor.state.doc)) {
    return resolveIpdFmftSiblingInsertPos(editor);
  }
  if (target) return target.blockPos + target.block.nodeSize;
  return null;
}

/** 工具栏 sibling 插入：`figure` / `multimedia` 等 fmft 块（图解类插在物料表前）。 */
export function insertSiblingFmftNodesFromToolbar(
  editor: Editor,
  nodes: JSONContent | JSONContent[],
): boolean {
  const doc = editor.state.doc;
  const insertPos = isIpdLikeDoc(doc)
    ? resolveIpdFmftSiblingInsertPos(editor)
    : resolveSiblingFigureInsertPos(
        editor,
        resolveTargetForSiblingFigureInsert(editor),
      );

  if (insertPos != null) {
    return editor.chain().focus().insertContentAt(insertPos, nodes).run();
  }
  return editor.chain().focus().insertContent(nodes).run();
}
