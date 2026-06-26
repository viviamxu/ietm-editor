import type { Editor, JSONContent } from "@tiptap/core";
import { Fragment, Node as PMNode, type ResolvedPos } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

import {
  buildMinimalCrewConditionJson,
  buildMinimalCrewDrillStepJson,
  canInsertCrewStepLevelBlockAtCursor,
  canInsertElseIfAtCursor,
  insertCrewConditionAtCursor,
} from "./crewInsert";
import { resolveCrewConditionAtPos } from "./crewConditionDelete";

const IF_ELSE_IF_TYPES = new Set(["if", "elseIf"]);
const CONDITION_TYPES = new Set(["if", "elseIf", "case"]);

function isIfElseIfType(typeName: string): boolean {
  return IF_ELSE_IF_TYPES.has(typeName);
}

function isConditionType(typeName: string): boolean {
  return CONDITION_TYPES.has(typeName);
}

function selectionInCaseCond(
  doc: PMNode,
  nodePos: number,
): TextSelection | null {
  const node = doc.nodeAt(nodePos);
  if (!node) return null;

  let offset = nodePos + 1;
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type.name === "caseCond") {
      const caret = Math.min(offset + 1, doc.content.size);
      if (caret < 0 || caret > doc.content.size) return null;
      return TextSelection.create(doc, caret);
    }
    offset += child.nodeSize;
  }
  return null;
}

function posAfterParentChild(
  parentPos: number,
  parent: PMNode,
  childIndex: number,
): number {
  let pos = parentPos + 1;
  for (let i = 0; i <= childIndex; i++) {
    pos += parent.child(i).nodeSize;
  }
  return pos;
}

/** 相邻 if / elseIf 链在父节点内的起止下标（须以 `if` 开头）。 */
export function resolveIfElseIfChainRange(
  doc: PMNode,
  blockPos: number,
): {
  parent: PMNode;
  parentPos: number;
  startIndex: number;
  endIndex: number;
} | null {
  const resolved = resolveCrewConditionAtPos(doc, blockPos);
  if (!resolved) return null;

  const { block, blockPos: actualPos } = resolved;
  if (!isIfElseIfType(block.type.name)) return null;

  const $pos = doc.resolve(actualPos);
  const parent = $pos.parent;
  let index = $pos.index();

  while (index > 0 && parent.child(index - 1).type.name === "elseIf") {
    index -= 1;
  }

  if (parent.child(index).type.name !== "if") return null;

  const startIndex = index;
  let endIndex = index;
  while (
    endIndex + 1 < parent.childCount &&
    parent.child(endIndex + 1).type.name === "elseIf"
  ) {
    endIndex += 1;
  }

  return {
    parent,
    parentPos: $pos.before($pos.depth),
    startIndex,
    endIndex,
  };
}

/** 相邻 `case` 链在父节点内的起止下标。 */
export function resolveCaseChainRange(
  doc: PMNode,
  blockPos: number,
): {
  parent: PMNode;
  parentPos: number;
  startIndex: number;
  endIndex: number;
} | null {
  const resolved = resolveCrewConditionAtPos(doc, blockPos);
  if (!resolved) return null;

  const { block, blockPos: actualPos } = resolved;
  if (block.type.name !== "case") return null;

  const $pos = doc.resolve(actualPos);
  const parent = $pos.parent;
  let index = $pos.index();

  while (index > 0 && parent.child(index - 1).type.name === "case") {
    index -= 1;
  }

  let endIndex = index;
  while (
    endIndex + 1 < parent.childCount &&
    parent.child(endIndex + 1).type.name === "case"
  ) {
    endIndex += 1;
  }

  return {
    parent,
    parentPos: $pos.before($pos.depth),
    startIndex: index,
    endIndex,
  };
}

function canInsertNodeAtParentIndex(
  parent: PMNode,
  insertIndex: number,
  child: PMNode,
): boolean {
  const siblings: PMNode[] = [];
  for (let i = 0; i < parent.childCount; i++) {
    if (i === insertIndex) siblings.push(child);
    siblings.push(parent.child(i));
  }
  if (insertIndex === parent.childCount) siblings.push(child);
  return parent.type.validContent(Fragment.from(siblings));
}

function selectionInCrewDrillStepTitle(
  doc: PMNode,
  stepPos: number,
): TextSelection | null {
  const node = doc.nodeAt(stepPos);
  if (!node || node.type.name !== "crewDrillStep") return null;

  let offset = stepPos + 1;
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child.type.name === "title") {
      const caret = Math.min(offset + 1, doc.content.size);
      if (caret < 0 || caret > doc.content.size) return null;
      return TextSelection.create(doc, caret);
    }
    offset += child.nodeSize;
  }

  const fallback = Math.min(stepPos + 2, doc.content.size);
  if (fallback < 0 || fallback > doc.content.size) return null;
  return TextSelection.create(doc, fallback);
}

function insertBlockJsonAt(
  editor: Editor,
  insertPos: number,
  json: JSONContent,
  selectAtPos: (doc: PMNode, pos: number) => TextSelection | null,
): boolean {
  let child: PMNode;
  try {
    child = PMNode.fromJSON(editor.state.schema, json);
  } catch {
    return false;
  }

  const doc = editor.state.doc;
  let $insert;
  try {
    $insert = doc.resolve(insertPos);
  } catch {
    return false;
  }

  if (!canInsertNodeAtParentIndex($insert.parent, $insert.index(), child)) {
    return false;
  }

  return editor
    .chain()
    .focus()
    .command(({ tr, dispatch }) => {
      if (!dispatch) return true;
      tr.insert(insertPos, child);
      const sel = selectAtPos(tr.doc, insertPos);
      if (sel) tr.setSelection(sel);
      dispatch(tr);
      return true;
    })
    .run();
}

function insertConditionJsonAt(
  editor: Editor,
  insertPos: number,
  json: JSONContent,
): boolean {
  return insertBlockJsonAt(editor, insertPos, json, selectionInCaseCond);
}

/** 在 if/elseIf 链末尾插入同级 `elseIf`（显式位置，不依赖光标）。 */
export function canInsertSiblingElseIfAfterChain(
  editor: Editor,
  blockPos: number,
): boolean {
  const doc = editor.state.doc;
  const range = resolveIfElseIfChainRange(doc, blockPos);
  if (!range) return false;

  const { parent, endIndex } = range;
  if (!editor.schema.nodes.elseIf) return false;

  let child: PMNode;
  try {
    child = PMNode.fromJSON(
      editor.schema,
      buildMinimalCrewConditionJson("elseIf"),
    );
  } catch {
    return false;
  }

  return canInsertNodeAtParentIndex(parent, endIndex + 1, child);
}

export function insertSiblingElseIfAfterChain(
  editor: Editor,
  blockPos: number,
): boolean {
  if (!editor.isEditable) return false;

  const doc = editor.state.doc;
  if (!canInsertSiblingElseIfAfterChain(editor, blockPos)) return false;

  const range = resolveIfElseIfChainRange(doc, blockPos);
  if (!range) return false;

  const insertPos = posAfterParentChild(
    range.parentPos,
    range.parent,
    range.endIndex,
  );

  return insertConditionJsonAt(
    editor,
    insertPos,
    buildMinimalCrewConditionJson("elseIf"),
  );
}

function resolveInnermostIfElseIfBlockPos($from: ResolvedPos): number | null {
  for (let d = $from.depth; d > 0; d--) {
    const name = $from.node(d).type.name;
    if (name === "if" || name === "elseIf") {
      return $from.before(d);
    }
  }
  return null;
}

/**
 * 顶栏 ElseIf：优先按光标插入；若在 If/ElseIf 内且光标位置不允许，则与块菜单
 * 「ElseIf（接在链后）」相同，在当前 If 链末尾插入同级 ElseIf。
 */
export function insertElseIfFromToolbar(editor: Editor): boolean {
  if (!canInsertCrewStepLevelBlockAtCursor(editor)) return false;
  if (!editor.state.schema.nodes.elseIf) return false;

  if (canInsertElseIfAtCursor(editor)) {
    return insertCrewConditionAtCursor(editor, "elseIf");
  }

  const blockPos = resolveInnermostIfElseIfBlockPos(
    editor.state.selection.$from,
  );
  if (
    blockPos != null &&
    canInsertSiblingElseIfAfterChain(editor, blockPos)
  ) {
    return insertSiblingElseIfAfterChain(editor, blockPos);
  }

  return false;
}

/** 在 if/elseIf 链末尾插入同级新 `if` 链（显式位置，不依赖光标）。 */
export function canInsertSiblingIfAfterChain(
  editor: Editor,
  blockPos: number,
): boolean {
  const doc = editor.state.doc;
  const range = resolveIfElseIfChainRange(doc, blockPos);
  if (!range) return false;

  const { parent, endIndex } = range;
  if (!editor.schema.nodes.if) return false;

  let child: PMNode;
  try {
    child = PMNode.fromJSON(
      editor.schema,
      buildMinimalCrewConditionJson("if"),
    );
  } catch {
    return false;
  }

  return canInsertNodeAtParentIndex(parent, endIndex + 1, child);
}

export function insertSiblingIfAfterChain(
  editor: Editor,
  blockPos: number,
): boolean {
  if (!editor.isEditable) return false;

  const doc = editor.state.doc;
  if (!canInsertSiblingIfAfterChain(editor, blockPos)) return false;

  const range = resolveIfElseIfChainRange(doc, blockPos);
  if (!range) return false;

  const insertPos = posAfterParentChild(
    range.parentPos,
    range.parent,
    range.endIndex,
  );

  return insertConditionJsonAt(
    editor,
    insertPos,
    buildMinimalCrewConditionJson("if"),
  );
}

/** 在条件块体内末尾插入嵌套 `if` / `case`。 */
export function canInsertNestedConditionInBlock(
  editor: Editor,
  blockPos: number,
  type: "if" | "case",
): boolean {
  const doc = editor.state.doc;
  const resolved = resolveCrewConditionAtPos(doc, blockPos);
  if (!resolved) return false;
  if (!isConditionType(resolved.block.type.name)) return false;

  if (!editor.schema.nodes[type]) return false;

  let child: PMNode;
  try {
    child = PMNode.fromJSON(
      editor.schema,
      buildMinimalCrewConditionJson(type),
    );
  } catch {
    return false;
  }

  const insertPos = resolved.blockPos + resolved.block.nodeSize - 1;
  try {
    const $insert = doc.resolve(insertPos);
    return $insert.parent.type.validContent(
      $insert.parent.content.addToEnd(child),
    );
  } catch {
    return false;
  }
}

export function insertNestedConditionInBlock(
  editor: Editor,
  blockPos: number,
  type: "if" | "case",
): boolean {
  if (!editor.isEditable) return false;

  const doc = editor.state.doc;
  if (!canInsertNestedConditionInBlock(editor, blockPos, type)) return false;

  const resolved = resolveCrewConditionAtPos(doc, blockPos);
  if (!resolved) return false;

  const insertPos = resolved.blockPos + resolved.block.nodeSize - 1;
  return insertConditionJsonAt(
    editor,
    insertPos,
    buildMinimalCrewConditionJson(type),
  );
}

/** 在 `case` 链末尾插入同级 `case`。 */
export function canInsertSiblingCaseAfterChain(
  editor: Editor,
  blockPos: number,
): boolean {
  const doc = editor.state.doc;
  const range = resolveCaseChainRange(doc, blockPos);
  if (!range) return false;

  if (!editor.schema.nodes.case) return false;

  let child: PMNode;
  try {
    child = PMNode.fromJSON(
      editor.schema,
      buildMinimalCrewConditionJson("case"),
    );
  } catch {
    return false;
  }

  return canInsertNodeAtParentIndex(range.parent, range.endIndex + 1, child);
}

export function insertSiblingCaseAfterChain(
  editor: Editor,
  blockPos: number,
): boolean {
  if (!editor.isEditable) return false;

  const doc = editor.state.doc;
  if (!canInsertSiblingCaseAfterChain(editor, blockPos)) return false;

  const range = resolveCaseChainRange(doc, blockPos);
  if (!range) return false;

  const insertPos = posAfterParentChild(
    range.parentPos,
    range.parent,
    range.endIndex,
  );

  return insertConditionJsonAt(
    editor,
    insertPos,
    buildMinimalCrewConditionJson("case"),
  );
}

/** 在条件块（if / elseIf / case）体内末尾插入 `crewDrillStep`。 */
export function canInsertCrewDrillStepInBlock(
  editor: Editor,
  blockPos: number,
): boolean {
  const doc = editor.state.doc;
  const resolved = resolveCrewConditionAtPos(doc, blockPos);
  if (!resolved) return false;
  if (!isConditionType(resolved.block.type.name)) return false;
  if (!editor.schema.nodes.crewDrillStep) return false;

  let child: PMNode;
  try {
    child = PMNode.fromJSON(
      editor.schema,
      buildMinimalCrewDrillStepJson(),
    );
  } catch {
    return false;
  }

  const insertPos = resolved.blockPos + resolved.block.nodeSize - 1;
  try {
    const $insert = doc.resolve(insertPos);
    return canInsertNodeAtParentIndex($insert.parent, $insert.index(), child);
  } catch {
    return false;
  }
}

export function insertCrewDrillStepInBlock(
  editor: Editor,
  blockPos: number,
): boolean {
  if (!editor.isEditable) return false;

  const doc = editor.state.doc;
  if (!canInsertCrewDrillStepInBlock(editor, blockPos)) return false;

  const resolved = resolveCrewConditionAtPos(doc, blockPos);
  if (!resolved) return false;

  const insertPos = resolved.blockPos + resolved.block.nodeSize - 1;
  return insertBlockJsonAt(
    editor,
    insertPos,
    buildMinimalCrewDrillStepJson(),
    selectionInCrewDrillStepTitle,
  );
}
