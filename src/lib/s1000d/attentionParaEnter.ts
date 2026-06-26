import type { Editor } from "@tiptap/core";
import type { Node as PMNode, ResolvedPos } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

type AttentionParaKind = "warningAndCautionPara" | "notePara";

type AttentionParaContext = {
  paraType: AttentionParaKind;
  parentTypeNames: readonly string[];
  leadType: "warningAndCautionLead" | "noteLead";
};

const WARNING_CAUTION_CTX: AttentionParaContext = {
  paraType: "warningAndCautionPara",
  parentTypeNames: ["warning", "caution"],
  leadType: "warningAndCautionLead",
};

const NOTE_CTX: AttentionParaContext = {
  paraType: "notePara",
  parentTypeNames: ["note"],
  leadType: "noteLead",
};

const INLINE_HOST_TYPES = new Set([
  "warningAndCautionLead",
  "attentionListItemPara",
  "noteLead",
]);

/** 仅 lead 行首需拦截 Backspace，列表项由 {@link backspaceAttentionRandomListItem} 处理。 */
const ATTENTION_LEAD_INLINE_HOST_TYPES = new Set([
  "warningAndCautionLead",
  "noteLead",
]);

function resolveAttentionParaContext(
  $from: ResolvedPos,
): AttentionParaContext | null {
  for (const ctx of [WARNING_CAUTION_CTX, NOTE_CTX]) {
    let inPara = false;
    let inParent = false;
    for (let d = $from.depth; d >= 0; d--) {
      const name = $from.node(d).type.name;
      if (name === ctx.paraType) inPara = true;
      if (ctx.parentTypeNames.includes(name)) inParent = true;
    }
    if (inPara && inParent) return ctx;
  }
  return null;
}

function depthOfNode($from: ResolvedPos, typeName: string): number {
  for (let d = $from.depth; d >= 0; d--) {
    if ($from.node(d).type.name === typeName) return d;
  }
  return -1;
}

function buildEmptyAttentionParaNode(
  schema: Editor["schema"],
  ctx: AttentionParaContext,
): PMNode | null {
  const paraType = schema.nodes[ctx.paraType];
  const leadType = schema.nodes[ctx.leadType];
  if (!paraType || !leadType) return null;
  return paraType.create({}, [leadType.create()]);
}

function selectionAtLeadStart(
  doc: PMNode,
  paraPos: number,
  leadType: string,
): TextSelection | null {
  const para = doc.nodeAt(paraPos);
  if (!para) return null;
  let offset = paraPos + 1;
  for (let i = 0; i < para.childCount; i++) {
    const child = para.child(i);
    if (child.type.name === leadType) {
      const caret = offset + 1;
      if (caret < 0 || caret > doc.content.size) return null;
      return TextSelection.create(doc, caret);
    }
    offset += child.nodeSize;
  }
  const caret = paraPos + 1;
  if (caret > doc.content.size) return null;
  return TextSelection.create(doc, caret);
}

function selectionInAttentionListItemPara(
  doc: PMNode,
  itemPos: number,
): TextSelection | null {
  const item = doc.nodeAt(itemPos);
  if (!item || item.type.name !== "attentionRandomListItem") return null;
  const para = item.firstChild;
  if (!para || para.type.name !== "attentionListItemPara") return null;
  const caret = itemPos + 1 + 1;
  if (caret < 0 || caret > doc.content.size) return null;
  return TextSelection.create(doc, caret);
}

function selectionAtEndOfAttentionListItemPara(
  doc: PMNode,
  itemPos: number,
): TextSelection | null {
  const item = doc.nodeAt(itemPos);
  if (!item || item.type.name !== "attentionRandomListItem") return null;
  const para = item.firstChild;
  if (!para || para.type.name !== "attentionListItemPara") return null;
  const caret = itemPos + 1 + 1 + para.content.size;
  if (caret < 0 || caret > doc.content.size) return null;
  return TextSelection.create(doc, caret);
}

function selectionAtEndOfLead(
  doc: PMNode,
  paraPos: number,
  leadType: string,
): TextSelection | null {
  const para = doc.nodeAt(paraPos);
  if (!para) return null;
  let offset = paraPos + 1;
  for (let i = 0; i < para.childCount; i++) {
    const child = para.child(i);
    if (child.type.name === leadType) {
      const caret = offset + 1 + child.content.size;
      if (caret < 0 || caret > doc.content.size) return null;
      return TextSelection.create(doc, caret);
    }
    offset += child.nodeSize;
  }
  return null;
}

type AttentionListContext = {
  ctx: AttentionParaContext;
  listFrom: number;
  listDepth: number;
  itemDepth: number;
  itemIndex: number;
};

function resolveAttentionListItemContext(
  $pos: ResolvedPos,
): AttentionListContext | null {
  const ctx = resolveAttentionParaContext($pos);
  if (!ctx) return null;
  if ($pos.parent.type.name !== "attentionListItemPara") return null;

  const itemDepth = depthOfNode($pos, "attentionRandomListItem");
  const listDepth = depthOfNode($pos, "attentionRandomList");
  if (itemDepth < 0 || listDepth < 0 || listDepth !== itemDepth - 1) return null;

  const listNode = $pos.node(listDepth);
  const listFrom = $pos.before(listDepth);
  const itemNode = $pos.node(itemDepth);
  const from = $pos.pos;

  let offset = 1;
  for (let i = 0; i < listNode.childCount; i++) {
    const child = listNode.child(i);
    const childStart = listFrom + offset;
    const childEnd = childStart + child.nodeSize;
    offset += child.nodeSize;
    if (child === itemNode || (from >= childStart && from < childEnd)) {
      return { ctx, listFrom, listDepth, itemDepth, itemIndex: i };
    }
  }

  return null;
}

function isEmptyAttentionListItem($from: ResolvedPos, itemDepth: number): boolean {
  const item = $from.node(itemDepth);
  if (item.childCount === 0) return false;
  for (let i = 0; i < item.childCount; i++) {
    const child = item.child(i);
    if (child.type.name !== "attentionListItemPara") return false;
    if (child.textContent.length > 0) return false;
  }
  return true;
}

function paraHasLead(doc: PMNode, paraPos: number, leadType: string): boolean {
  const para = doc.nodeAt(paraPos);
  if (!para) return false;
  for (let i = 0; i < para.childCount; i++) {
    if (para.child(i).type.name === leadType) return true;
  }
  return false;
}

/** 删除空的 `attentionRandomList` 或其中一项，并把光标移回 lead 或相邻列表项。 */
function removeEmptyAttentionRandomListItem(editor: Editor): boolean {
  const { state } = editor;
  const $from = state.selection.$from;
  const listCtx = resolveAttentionListItemContext($from);
  if (!listCtx) return false;
  if (!isEmptyAttentionListItem($from, listCtx.itemDepth)) return false;

  const list = state.doc.nodeAt(listCtx.listFrom);
  if (!list || list.type.name !== "attentionRandomList") return false;

  const listEnd = listCtx.listFrom + list.nodeSize;
  const paraDepth = listCtx.listDepth - 1;
  const paraPos = $from.before(paraDepth);

  if (list.childCount === 1) {
    let tr = state.tr.delete(listCtx.listFrom, listEnd);
    if (!paraHasLead(tr.doc, paraPos, listCtx.ctx.leadType)) {
      const leadType = editor.schema.nodes[listCtx.ctx.leadType];
      if (!leadType) return false;
      tr = tr.insert(paraPos + 1, leadType.create());
      tr.setSelection(TextSelection.create(tr.doc, paraPos + 2));
    } else {
      const sel = selectionAtEndOfLead(tr.doc, paraPos, listCtx.ctx.leadType);
      if (sel) tr = tr.setSelection(sel);
    }
    editor.view.dispatch(tr.scrollIntoView());
    return true;
  }

  const remaining: PMNode[] = [];
  for (let i = 0; i < list.childCount; i++) {
    if (i !== listCtx.itemIndex) remaining.push(list.child(i));
  }
  const newList = list.type.create(list.attrs, remaining);
  let tr = state.tr.replaceWith(listCtx.listFrom, listEnd, newList);

  const targetItemIndex = listCtx.itemIndex > 0 ? listCtx.itemIndex - 1 : 0;
  let itemPos = listCtx.listFrom + 1;
  for (let i = 0; i < targetItemIndex; i++) {
    itemPos += remaining[i]!.nodeSize;
  }

  const sel =
    listCtx.itemIndex > 0
      ? selectionAtEndOfAttentionListItemPara(tr.doc, itemPos)
      : selectionInAttentionListItemPara(tr.doc, itemPos);
  if (sel) tr = tr.setSelection(sel);
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

function buildEmptyListItem(schema: Editor["schema"]): PMNode | null {
  const itemType = schema.nodes.attentionRandomListItem;
  const paraType = schema.nodes.attentionListItemPara;
  if (!itemType || !paraType) return null;
  return itemType.create({}, [paraType.create()]);
}

/** Enter：在 lead 末尾拆出下一条 `warningAndCautionPara` / `notePara`。 */
function splitAttentionParaOnEnter(editor: Editor): boolean {
  const { $from } = editor.state.selection;
  const ctx = resolveAttentionParaContext($from);
  if (!ctx) return false;
  if ($from.parent.type.name !== ctx.leadType) return false;

  const paraDepth = depthOfNode($from, ctx.paraType);
  if (paraDepth < 0) return false;

  const newPara = buildEmptyAttentionParaNode(editor.schema, ctx);
  if (!newPara) return false;

  const insertPos = $from.after(paraDepth);
  let tr = editor.state.tr.insert(insertPos, newPara);
  const sel = selectionAtLeadStart(tr.doc, insertPos, ctx.leadType);
  if (sel) tr = tr.setSelection(sel);
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

/** Enter：在 attention 列表项内插入下一条 `attentionRandomListItem`。 */
function insertAttentionListItemOnEnter(editor: Editor): boolean {
  const { $from } = editor.state.selection;
  const ctx = resolveAttentionParaContext($from);
  if (!ctx) return false;
  if ($from.parent.type.name !== "attentionListItemPara") return false;

  const itemDepth = depthOfNode($from, "attentionRandomListItem");
  if (itemDepth < 0) return false;

  const newItem = buildEmptyListItem(editor.schema);
  if (!newItem) return false;

  const insertPos = $from.after(itemDepth);
  let tr = editor.state.tr.insert(insertPos, newItem);
  const sel = selectionInAttentionListItemPara(tr.doc, insertPos);
  if (sel) tr = tr.setSelection(sel);
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

/** Shift+Enter：段内换行（`hardBreak`）。 */
export function hardBreakInAttentionInline(editor: Editor): boolean {
  const { $from } = editor.state.selection;
  if (!INLINE_HOST_TYPES.has($from.parent.type.name)) return false;
  if (!resolveAttentionParaContext($from)) return false;
  return editor.chain().focus().setHardBreak().run();
}

/** Enter：warning/caution/note 内分段或列表项。 */
export function handleAttentionParaEnter(editor: Editor): boolean {
  if (splitAttentionParaOnEnter(editor)) return true;
  if (exitAttentionRandomListOnEnter(editor)) return true;
  if (insertAttentionListItemOnEnter(editor)) return true;
  return false;
}

/** Enter：空 `attentionRandomListItem` 时退出列表（与描述类列表行为一致）。 */
export function exitAttentionRandomListOnEnter(editor: Editor): boolean {
  if (!editor.isEditable) return false;
  if (!editor.state.selection.empty) return false;
  return removeEmptyAttentionRandomListItem(editor);
}

/** Backspace：空 `attentionRandomListItem` 行首时删除该项或整表。 */
export function backspaceAttentionRandomListItem(editor: Editor): boolean {
  if (!editor.isEditable) return false;
  if (!editor.state.selection.empty) return false;

  const { $from } = editor.state.selection;
  if ($from.parent.type.name !== "attentionListItemPara") return false;
  if ($from.parentOffset !== 0) return false;

  return removeEmptyAttentionRandomListItem(editor);
}

function isInAttentionInlineHost($from: ResolvedPos): boolean {
  if (!INLINE_HOST_TYPES.has($from.parent.type.name)) return false;
  return resolveAttentionParaContext($from) != null;
}

/**
 * Delete：位于 attention 内联宿主末尾且无后续同级节点时拦截，
 * 避免默认 `joinForward` 删除空 `warningAndCautionLead` 并跳出 isolating 块。
 */
export function handleAttentionInlineDelete(editor: Editor): boolean {
  if (!editor.isEditable) return false;
  if (!editor.state.selection.empty) return false;

  const { $from } = editor.state.selection;
  if (!isInAttentionInlineHost($from)) return false;

  const atEnd = $from.parentOffset >= $from.parent.content.size;
  if (!atEnd) return false;

  const grandParent = $from.node($from.depth - 1);
  const indexInGrandParent = $from.index($from.depth - 1);
  if (indexInGrandParent + 1 < grandParent.childCount) return false;

  return true;
}

/**
 * Backspace：位于 attention 内联宿主行首且无前置同级节点时拦截，
 * 避免默认行为选中或跳出 isolating 的 warning/caution/note 块。
 */
export function handleAttentionInlineBackspace(editor: Editor): boolean {
  if (!editor.isEditable) return false;
  if (!editor.state.selection.empty) return false;

  const { $from } = editor.state.selection;
  if (!ATTENTION_LEAD_INLINE_HOST_TYPES.has($from.parent.type.name)) return false;
  if (!resolveAttentionParaContext($from)) return false;
  if ($from.parentOffset > 0) return false;

  const indexInGrandParent = $from.index($from.depth - 1);
  if (indexInGrandParent > 0) return false;

  return true;
}
