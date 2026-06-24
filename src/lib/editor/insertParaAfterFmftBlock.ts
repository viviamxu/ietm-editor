import type { Editor } from "@tiptap/core";
import { Fragment, type Node as PMNode, type ResolvedPos } from "@tiptap/pm/model";
import { NodeSelection, TextSelection, type Transaction } from "@tiptap/pm/state";

import { getDescriptionSchema } from "../../store/descriptionSchemaStore";
import { containerAllowsTrailingPara } from "../s1000d/schemaContentRuleValidate";

/** `fmftElemGroup` 块：其后可接 S1000D `para`。 */
export const FMFT_BLOCK_TYPES = new Set(["multimedia", "figure", "table"]);

/** `warning` / `caution` / `note` 外壳：在步骤/层级段落后可接 `para`。 */
export const ATTENTION_SHELL_BLOCK_TYPES = new Set([
  "warning",
  "caution",
  "note",
]);

/** 在宿主容器内、其后可接 `para` 的块级兄弟节点。 */
export const HOST_BLOCK_TYPES_NEEDING_PARA_AFTER = new Set([
  ...FMFT_BLOCK_TYPES,
  ...ATTENTION_SHELL_BLOCK_TYPES,
]);

/** @deprecated 使用 {@link containerAllowsTrailingPara}（按 schema `content` 判定）。 */
export const FMFT_PARA_CONTAINER_TYPES = new Set([
  "doc",
  "proceduralStep",
  "levelledPara",
]);

function parentAllowsTrailingPara(parentTypeName: string): boolean {
  return containerAllowsTrailingPara(parentTypeName, getDescriptionSchema());
}

/** 宿主块后可接的 trailing 段类型（含 StarterKit `paragraph` 误落）。 */
const TRAILING_BLOCK_TYPES = new Set(["para", "paragraph"]);

function isTrailingBlockType(typeName: string): boolean {
  return TRAILING_BLOCK_TYPES.has(typeName);
}

function childPos(parentPos: number, parent: PMNode, childIndex: number): number {
  let pos = parentPos + 1;
  for (let i = 0; i < childIndex; i++) {
    pos += parent.child(i).nodeSize;
  }
  return pos;
}

function focusParaAt(editor: Editor, paraPos: number): boolean {
  const cursorPos = Math.min(paraPos + 1, editor.state.doc.content.size);
  const tr = editor.state.tr.setSelection(
    TextSelection.create(editor.state.doc, cursorPos),
  );
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
  return true;
}

function isHostBlockType(typeName: string): boolean {
  return HOST_BLOCK_TYPES_NEEDING_PARA_AFTER.has(typeName);
}

/** NodeView `getPos()` 在文档变更 / 重挂载间隙可能过期；须校验后再 `resolve`。 */
export function isLiveHostBlockAtPos(
  doc: PMNode,
  blockPos: number,
  block: PMNode,
): boolean {
  if (blockPos < 0 || blockPos > doc.content.size) return false;
  const live = doc.nodeAt(blockPos);
  if (!live || live.type.name !== block.type.name) return false;
  const insertPos = blockPos + block.nodeSize;
  return insertPos >= 0 && insertPos <= doc.content.size;
}

function resolveAfterHostBlockPos(
  doc: PMNode,
  blockPos: number,
  block: PMNode,
): ResolvedPos | null {
  if (!isLiveHostBlockAtPos(doc, blockPos, block)) return null;
  try {
    return doc.resolve(blockPos + block.nodeSize);
  } catch {
    return null;
  }
}

/** 在父节点 `insertIndex` 处插入 `para` 后的内容片段（用于 schema 校验）。 */
function parentContentWithParaAt(
  parent: PMNode,
  insertIndex: number,
  para: PMNode,
): Fragment {
  const children: PMNode[] = [];
  for (let i = 0; i < parent.childCount; i++) {
    if (i === insertIndex) children.push(para);
    children.push(parent.child(i));
  }
  if (insertIndex === parent.childCount) children.push(para);
  return Fragment.from(children);
}

function parentContentWithoutChildAt(
  parent: PMNode,
  childIndex: number,
): Fragment {
  const children: PMNode[] = [];
  for (let i = 0; i < parent.childCount; i++) {
    if (i !== childIndex) children.push(parent.child(i));
  }
  return Fragment.from(children);
}

/** 从当前选区向上解析刚插入或正在编辑的宿主块位置。 */
export function resolveHostBlockPosFromSelection(
  editor: Editor,
): number | undefined {
  const { selection } = editor.state;
  if (
    selection instanceof NodeSelection &&
    isHostBlockType(selection.node.type.name)
  ) {
    return selection.from;
  }

  const $from = selection.$from;
  for (let d = $from.depth; d > 0; d--) {
    const name = $from.node(d).type.name;
    if (isHostBlockType(name)) return $from.before(d);
  }
  return undefined;
}

/** 在宿主块后插入空 `para`（或聚焦其后已有 `para`）。 */
export function insertParaAfterHostBlock(
  editor: Editor,
  blockPos: number,
  block: PMNode,
  options?: { focus?: boolean },
): boolean {
  const shouldFocus = options?.focus !== false;
  const paraType = editor.state.schema.nodes.para;
  if (!paraType) return false;
  if (!isHostBlockType(block.type.name)) return false;
  if (!isLiveHostBlockAtPos(editor.state.doc, blockPos, block)) return false;

  const insertPos = blockPos + block.nodeSize;
  let $insert: ResolvedPos;
  try {
    $insert = editor.state.doc.resolve(insertPos);
  } catch {
    return false;
  }
  const parent = $insert.parent;
  if (!parentAllowsTrailingPara(parent.type.name)) return false;

  const nextIndex = $insert.index();
  if (nextIndex < parent.childCount) {
    const next = parent.child(nextIndex);
    if (next.type.name === "para") {
      return shouldFocus ? focusParaAt(editor, insertPos) : true;
    }
  }

  const para = paraType.create();
  const contentWithPara = parentContentWithParaAt(parent, nextIndex, para);
  if (!parent.type.validContent(contentWithPara)) return false;

  if (!shouldFocus) {
    const tr = editor.state.tr.insert(insertPos, para);
    editor.view.dispatch(tr);
    return true;
  }

  const tr = editor.state.tr.insert(insertPos, para);
  const cursorPos = Math.min(insertPos + 1, tr.doc.content.size);
  tr.setSelection(TextSelection.create(tr.doc, cursorPos));
  editor.view.dispatch(tr.scrollIntoView());
  editor.view.focus();
  return true;
}

/** @deprecated 名称保留；现亦支持 `warning` / `caution` / `note`。 */
export function insertParaAfterFmftBlock(
  editor: Editor,
  blockPos: number,
  block: PMNode,
): boolean {
  return insertParaAfterHostBlock(editor, blockPos, block);
}

function resolveHostBlockFromNodeSelection(
  editor: Editor,
): { pos: number; node: PMNode } | null {
  const { selection, doc } = editor.state;
  if (!(selection instanceof NodeSelection)) return null;

  if (isHostBlockType(selection.node.type.name)) {
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

function isCursorInsideParaAfterHostBlock(
  editor: Editor,
  blockPos: number,
  block: PMNode,
): boolean {
  const { selection } = editor.state;
  if (!(selection instanceof NodeSelection) && !selection.empty) return false;

  const insertPos = blockPos + block.nodeSize;
  let $insert: ResolvedPos;
  try {
    if (!isLiveHostBlockAtPos(editor.state.doc, blockPos, block)) return false;
    $insert = editor.state.doc.resolve(insertPos);
  } catch {
    return false;
  }
  const parent = $insert.parent;
  const nextIndex = $insert.index();
  if (nextIndex >= parent.childCount) return false;
  if (!isTrailingBlockType(parent.child(nextIndex).type.name)) return false;

  const $from = selection.$from;
  for (let d = $from.depth; d > 0; d--) {
    if (!isTrailingBlockType($from.node(d).type.name)) continue;
    if ($from.before(d) === insertPos) return true;
  }
  return false;
}

function hostBlockNeedsParaAfter(
  doc: PMNode,
  blockPos: number,
  block: PMNode,
): boolean {
  const $insert = resolveAfterHostBlockPos(doc, blockPos, block);
  if (!$insert) return false;
  const parent = $insert.parent;
  const nextIndex = $insert.index();
  if (nextIndex >= parent.childCount) return true;
  return !isTrailingBlockType(parent.child(nextIndex).type.name);
}

/**
 * 是否展示「点击此处继续输入」：父容器 schema 允许 trailing `para`，且其后尚无 `para`。
 * 例如 `safetyRqmts`（仅 `attentionElemGroup+`）下 warning/note 返回 false。
 */
export function shouldShowHostBlockContinueHint(
  doc: PMNode,
  blockPos: number,
  block: PMNode,
): boolean {
  if (!isHostBlockType(block.type.name)) return false;
  const $insert = resolveAfterHostBlockPos(doc, blockPos, block);
  if (!$insert) return false;
  if (!parentAllowsTrailingPara($insert.parent.type.name)) return false;
  return hostBlockNeedsParaAfter(doc, blockPos, block);
}

/** `safetyRqmts` 内每个 warning / caution / note 底缘均可展示继续输入提示。 */
export function shouldShowSafetyAttentionContinueHint(
  doc: PMNode,
  blockPos: number,
  block: PMNode,
): boolean {
  if (!ATTENTION_SHELL_BLOCK_TYPES.has(block.type.name)) return false;
  const $insert = resolveAfterHostBlockPos(doc, blockPos, block);
  if (!$insert) return false;
  return $insert.parent.type.name === "safetyRqmts";
}

/**
 * Enter：选中宿主块（表/图/warning 等），或光标位于块后间隙时，
 * 插入/聚焦 trailing `para`。已在块后 `para` 内编辑时不拦截。
 */
export function handleFmftBlockEnter(editor: Editor): boolean {
  const fromNode = resolveHostBlockFromNodeSelection(editor);
  if (fromNode) {
    return insertParaAfterHostBlock(editor, fromNode.pos, fromNode.node);
  }

  const found = findHostBlockBeforeSelection(editor);
  if (!found) return false;
  if (isCursorInsideParaAfterHostBlock(editor, found.pos, found.node)) {
    return false;
  }

  return insertParaAfterHostBlock(editor, found.pos, found.node);
}

/** 根据当前选区定位紧邻光标前的宿主块。 */
export function findHostBlockBeforeSelection(
  editor: Editor,
): { pos: number; node: PMNode } | null {
  const { selection } = editor.state;
  if (selection instanceof NodeSelection) {
    return resolveHostBlockFromNodeSelection(editor);
  }

  const $from = selection.$from;
  for (let d = $from.depth; d > 0; d--) {
    const parent = $from.node(d);
    if (!parentAllowsTrailingPara(parent.type.name)) continue;

    const index = $from.index(d);
    if (index === 0) continue;

    const prev = parent.child(index - 1);
    if (!isHostBlockType(prev.type.name)) continue;

    return {
      pos: childPos($from.before(d), parent, index - 1),
      node: prev,
    };
  }
  return null;
}

/** @deprecated 使用 {@link findHostBlockBeforeSelection} */
export function findFmftBlockBeforeSelection(
  editor: Editor,
): { pos: number; node: PMNode } | null {
  return findHostBlockBeforeSelection(editor);
}

export function ensureParaAfterHostFromSelection(editor: Editor): boolean {
  const found = findHostBlockBeforeSelection(editor);
  if (!found) return false;
  return insertParaAfterHostBlock(editor, found.pos, found.node);
}

/** @deprecated */
export function ensureParaAfterFmftFromSelection(editor: Editor): boolean {
  return ensureParaAfterHostFromSelection(editor);
}

function findLastHostBlockInParent(
  parentPos: number,
  parent: PMNode,
): { pos: number; node: PMNode } | null {
  let childPos = parentPos + 1;
  let last: { pos: number; node: PMNode } | null = null;
  for (let i = 0; i < parent.childCount; i++) {
    const child = parent.child(i);
    if (isHostBlockType(child.type.name)) {
      last = { pos: childPos, node: child };
    }
    childPos += child.nodeSize;
  }
  return last;
}

function findLastHostBlockNeedingParaInParent(
  doc: PMNode,
  parentPos: number,
  parent: PMNode,
): { pos: number; node: PMNode } | null {
  let childPos = parentPos + 1;
  let last: { pos: number; node: PMNode } | null = null;
  for (let i = 0; i < parent.childCount; i++) {
    const child = parent.child(i);
    if (
      isHostBlockType(child.type.name) &&
      hostBlockNeedsParaAfter(doc, childPos, child)
    ) {
      last = { pos: childPos, node: child };
    }
    childPos += child.nodeSize;
  }
  return last;
}

/** 根据文档位置定位宿主块（插入点或容器内最后一个同类块）。 */
export function resolveHostBlockPosNear(
  editor: Editor,
  nearPos: number,
): number | undefined {
  const doc = editor.state.doc;
  const safePos = Math.min(Math.max(0, nearPos), doc.content.size);
  const at = doc.nodeAt(safePos);
  if (at && isHostBlockType(at.type.name)) {
    return safePos;
  }

  const $pos = doc.resolve(safePos);
  for (let d = $pos.depth; d > 0; d--) {
    const parent = $pos.node(d);
    if (!parentAllowsTrailingPara(parent.type.name)) continue;
    const last = findLastHostBlockInParent($pos.before(d), parent);
    if (last) return last.pos;
  }
  return undefined;
}

/** @deprecated 使用 {@link resolveHostBlockPosNear} */
export function resolveFmftBlockPosNear(
  editor: Editor,
  nearPos: number,
): number | undefined {
  return resolveHostBlockPosNear(editor, nearPos);
}

/** 在已知宿主块位置后补 `para`；未给出位置时回退到选区/容器内推断。 */
export function ensureParaAfterHostInsert(
  editor: Editor,
  hostBlockPos?: number,
): boolean {
  if (hostBlockPos != null) {
    const block = editor.state.doc.nodeAt(hostBlockPos);
    if (block && isHostBlockType(block.type.name)) {
      return insertParaAfterHostBlock(editor, hostBlockPos, block);
    }
  }
  return ensureParaAfterHostNearSelection(editor);
}

/** @deprecated */
export function ensureParaAfterFmftInsert(
  editor: Editor,
  fmftBlockPos?: number,
): boolean {
  return ensureParaAfterHostInsert(editor, fmftBlockPos);
}

export function ensureParaAfterHostNearSelection(editor: Editor): boolean {
  if (ensureParaAfterHostFromSelection(editor)) return true;

  const { selection, doc } = editor.state;
  const $pos = doc.resolve(Math.min(selection.from, doc.content.size));

  for (let d = $pos.depth; d > 0; d--) {
    const parent = $pos.node(d);
    if (!parentAllowsTrailingPara(parent.type.name)) continue;

    const last = findLastHostBlockNeedingParaInParent(
      doc,
      $pos.before(d),
      parent,
    );
    if (last) {
      return insertParaAfterHostBlock(editor, last.pos, last.node);
    }
  }

  return false;
}

/** @deprecated */
export function ensureParaAfterFmftNearSelection(editor: Editor): boolean {
  return ensureParaAfterHostNearSelection(editor);
}

const NESTED_BLOCK_AFTER_TRAILING_PARA = new Set([
  "proceduralStep",
  "levelledPara",
]);

function isEmptyTrailingBlockNode(block: PMNode): boolean {
  return block.textContent.length === 0;
}

function resolveTrailingBlockDepth($from: ResolvedPos): number {
  for (let d = $from.depth; d > 0; d--) {
    if (isTrailingBlockType($from.node(d).type.name)) return d;
  }
  return -1;
}

function selectionAfterHostBlock(
  tr: Transaction,
  found: { pos: number; node: PMNode },
) {
  const afterHost = Math.min(found.pos + found.node.nodeSize, tr.doc.content.size);
  return tr.setSelection(TextSelection.near(tr.doc.resolve(afterHost), -1));
}

function focusFirstEditableInNestedBlock(
  editor: Editor,
  blockPos: number,
  block: PMNode,
): boolean {
  let childPos = blockPos + 1;
  for (let i = 0; i < block.childCount; i++) {
    const child = block.child(i);
    if (child.type.name === "para") {
      return focusParaAt(editor, childPos);
    }
    if (child.type.name === "title") {
      const caret = Math.min(childPos + 1, editor.state.doc.content.size);
      return editor.chain().focus().setTextSelection(caret).run();
    }
    if (NESTED_BLOCK_AFTER_TRAILING_PARA.has(child.type.name)) {
      return focusFirstEditableInNestedBlock(editor, childPos, child);
    }
    childPos += child.nodeSize;
  }
  const caret = Math.min(blockPos + 1, editor.state.doc.content.size);
  return editor.chain().focus().setTextSelection(caret).run();
}

/** 事务删除宿主块后的空 trailing `para`（schema 合法时）。 */
function deleteTrailingParaAfterHostBlock(
  editor: Editor,
  found: { pos: number; node: PMNode },
  paraStart: number,
  para: PMNode,
  container: PMNode,
  paraIndex: number,
): boolean {
  const contentWithout = parentContentWithoutChildAt(container, paraIndex);
  if (!container.type.validContent(contentWithout)) return false;

  const paraEnd = paraStart + para.nodeSize;
  const nextIndex = paraIndex + 1;
  const hadNested =
    nextIndex < container.childCount &&
    NESTED_BLOCK_AFTER_TRAILING_PARA.has(
      container.child(nextIndex).type.name,
    );

  let tr = editor.state.tr.delete(paraStart, paraEnd);

  if (hadNested) {
    const nextPos = paraStart;
    const nextNode = tr.doc.nodeAt(nextPos);
    editor.view.dispatch(tr.scrollIntoView());
    if (nextNode) {
      return focusFirstEditableInNestedBlock(editor, nextPos, nextNode);
    }
    return true;
  }

  tr = selectionAfterHostBlock(tr, found);
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

/**
 * Backspace：位于宿主块（表 / warning 等）后 `para` 行首时，
 * 空段按 schema 安全删除；非空段行首则拦截，避免 `selectNodeBackward` 选中 isolating 块。
 */
export function handleTrailingParaAfterHostBackspace(editor: Editor): boolean {
  const found = findHostBlockBeforeSelection(editor);
  if (!found) return false;
  if (!isCursorInsideParaAfterHostBlock(editor, found.pos, found.node)) {
    return false;
  }

  const { selection } = editor.state;
  if (selection instanceof NodeSelection) return false;

  const $from = selection.$from;
  const trailingDepth = resolveTrailingBlockDepth($from);
  if (trailingDepth < 0) return false;

  const trailingBlock = $from.node(trailingDepth);
  const trailingStart = $from.before(trailingDepth);
  if (trailingStart !== found.pos + found.node.nodeSize) return false;

  const parentName = $from.parent.type.name;
  if (isTrailingBlockType(parentName) && $from.parentOffset > 0) {
    return false;
  }

  const containerDepth = trailingDepth - 1;
  const trailingIndex = $from.index(containerDepth);
  const container = $from.node(containerDepth);

  if (isEmptyTrailingBlockNode(trailingBlock)) {
    deleteTrailingParaAfterHostBlock(
      editor,
      found,
      trailingStart,
      trailingBlock,
      container,
      trailingIndex,
    );
    return true;
  }

  return true;
}
