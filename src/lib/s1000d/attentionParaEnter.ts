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
  if (insertAttentionListItemOnEnter(editor)) return true;
  return false;
}
