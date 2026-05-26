import type { Editor } from "@tiptap/core";
import type { Node as PMNode, ResolvedPos } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

import { LIST_TYPES, resolveListItemInList } from "./nestingLevelShared";

/** 当前 listItem 仅含空 `paragraph`，且无嵌套列表（WPS 第二次 Enter 退出场景）。 */
function isEmptyDescriptionListItem($from: ResolvedPos, itemDepth: number): boolean {
  const item = $from.node(itemDepth);
  let sawEmptyParagraph = false;

  for (let i = 0; i < item.childCount; i++) {
    const child = item.child(i);
    if (LIST_TYPES.has(child.type.name)) return false;
    if (child.type.name === "paragraph") {
      if (child.textContent.length > 0) return false;
      sawEmptyParagraph = true;
    }
  }

  return sawEmptyParagraph;
}

/**
 * 在 `orderedList` / `bulletList` 的空列表项按 Enter：删除空项（或整表），
 * 在列表后插入 S1000D `para`（避免默认 lift 生成非法的 `paragraph` 块）。
 */
export function exitDescriptionListAsPara(editor: Editor): boolean {
  const { state } = editor;
  const $from = state.selection.$from;
  const ctx = resolveListItemInList($from);
  if (!ctx) return false;
  if (!isEmptyDescriptionListItem($from, ctx.itemDepth)) return false;

  const paraType = state.schema.nodes.para;
  if (!paraType) return false;

  const list = state.doc.nodeAt(ctx.listFrom);
  if (!list || !LIST_TYPES.has(list.type.name)) return false;

  const listEnd = ctx.listFrom + list.nodeSize;
  const remaining: PMNode[] = [];
  for (let i = 0; i < list.childCount; i++) {
    if (i !== ctx.itemIndex) remaining.push(list.child(i));
  }

  const para = paraType.create();
  let tr = state.tr;

  if (remaining.length === 0) {
    tr = tr.replaceWith(ctx.listFrom, listEnd, para);
    const cursorPos = Math.min(ctx.listFrom + 1, tr.doc.content.size);
    tr.setSelection(TextSelection.near(tr.doc.resolve(cursorPos), -1));
  } else {
    const newList = list.type.create(list.attrs, remaining);
    tr = tr.replaceWith(ctx.listFrom, listEnd, newList);
    const insertPos = ctx.listFrom + newList.nodeSize;
    tr.insert(insertPos, para);
    const cursorPos = Math.min(insertPos + 1, tr.doc.content.size);
    tr.setSelection(TextSelection.near(tr.doc.resolve(cursorPos), -1));
  }

  editor.view.dispatch(tr.scrollIntoView());
  return true;
}
