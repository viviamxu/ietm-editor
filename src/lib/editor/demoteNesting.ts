import type { Editor } from "@tiptap/core";
import { Fragment, type Node as PMNode } from "@tiptap/pm/model";
import type { ResolvedPos } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

import {
  LEVELLED_PARA,
  LIST_TYPES,
  TITLE_LEVEL_CAP,
  collectAncestorDepths,
  getInnermostLevelledParaDepth,
  getListItemDepth,
  isInLevelledParaTitleOrPara,
  isInListNestingContext,
} from "./nestingLevelShared";

type ListSinkTarget = {
  listFrom: number;
  itemIndex: number;
};

function targetFromListItem($pos: ResolvedPos): ListSinkTarget | null {
  const itemDepth = getListItemDepth($pos);
  if (itemDepth < 0) return null;

  const listDepth = itemDepth - 1;
  const listNode = $pos.node(listDepth);
  if (!LIST_TYPES.has(listNode.type.name)) return null;

  const itemIndex = $pos.index(itemDepth);
  if (itemIndex === 0) return null;

  return { listFrom: $pos.before(listDepth), itemIndex };
}

function targetFromListTail($pos: ResolvedPos): ListSinkTarget | null {
  for (let d = $pos.depth; d >= 0; d--) {
    const typeName = $pos.node(d).type.name;
    if (!LIST_TYPES.has(typeName)) continue;
    const list = $pos.node(d);
    if (list.childCount < 2) return null;
    return {
      listFrom: $pos.before(d),
      itemIndex: list.childCount - 1,
    };
  }
  return null;
}

/**
 * 解析应对其执行列表降级的目标：当前 listItem，或列表尾/列表缝隙处的最后一项（非首项）。
 */
function resolveListSinkTarget($from: ResolvedPos): ListSinkTarget | null {
  const direct = targetFromListItem($from);
  if (direct) return direct;

  if ($from.pos > 0) {
    const $prev = $from.doc.resolve($from.pos - 1);
    const fromPrevItem = targetFromListItem($prev);
    if (fromPrevItem) return fromPrevItem;
    const fromPrevTail = targetFromListTail($prev);
    if (fromPrevTail) return fromPrevTail;
  }

  const nodeBefore = $from.nodeBefore;
  if (nodeBefore && LIST_TYPES.has(nodeBefore.type.name) && nodeBefore.childCount >= 2) {
    if ($from.pos > 0) {
      const $prev = $from.doc.resolve($from.pos - 1);
      for (let d = $prev.depth; d >= 0; d--) {
        if ($prev.node(d) === nodeBefore) {
          return {
            listFrom: $prev.before(d),
            itemIndex: nodeBefore.childCount - 1,
          };
        }
      }
    }
  }

  return null;
}

function isInListDemoteContext($from: ResolvedPos): boolean {
  if (isInListNestingContext($from)) return true;
  return resolveListSinkTarget($from) !== null;
}

function canWrapLevelledParaDeeper($from: ResolvedPos): boolean {
  if (isInListDemoteContext($from)) return false;

  const lpDepth = getInnermostLevelledParaDepth($from);
  if (lpDepth < 0) return false;
  if (collectAncestorDepths($from, LEVELLED_PARA).length >= TITLE_LEVEL_CAP) {
    return false;
  }

  return isInLevelledParaTitleOrPara($from);
}

function sinkListItemAtTarget(editor: Editor, target: ListSinkTarget): boolean {
  return editor
    .chain()
    .focus()
    .command(({ state, tr, dispatch }) => {
      const { listFrom, itemIndex } = target;
      if (itemIndex === 0) return false;

      const listNode = state.doc.nodeAt(listFrom);
      if (!listNode || !LIST_TYPES.has(listNode.type.name)) return false;
      if (itemIndex >= listNode.childCount) return false;

      const listTypeName = listNode.type.name;
      const listType = state.schema.nodes[listTypeName];
      if (!listType) return false;

      const currentItem = listNode.child(itemIndex);
      const prevItem = listNode.child(itemIndex - 1);
      const last = prevItem.lastChild;

      const newPrevItem =
        last?.type.name === listTypeName
          ? prevItem.copy(
              prevItem.content.replaceChild(
                prevItem.childCount - 1,
                last.copy(last.content.append(Fragment.from(currentItem))),
              ),
            )
          : prevItem.copy(
              prevItem.content.append(
                Fragment.from(listType.create(null, currentItem)),
              ),
            );

      const newChildren: PMNode[] = [];
      for (let i = 0; i < listNode.childCount; i++) {
        if (i === itemIndex - 1) newChildren.push(newPrevItem);
        else if (i !== itemIndex) newChildren.push(listNode.child(i));
      }

      if (!dispatch) return true;

      const listTo = listFrom + listNode.nodeSize;
      tr.replaceWith(
        listFrom,
        listTo,
        listNode.type.create(listNode.attrs, newChildren),
      );

      const itemStart = listFrom + 1;
      let offset = 0;
      for (let i = 0; i < itemIndex - 1; i++) {
        offset += newChildren[i]!.nodeSize;
      }
      const mapped = tr.mapping.map(itemStart + offset + 1);
      tr.setSelection(
        TextSelection.near(
          tr.doc.resolve(Math.min(mapped, tr.doc.content.size)),
          1,
        ),
      );
      dispatch(tr);
      return true;
    })
    .run();
}

function wrapLevelledParaDeeper(editor: Editor): boolean {
  return editor
    .chain()
    .focus()
    .command(({ state, tr, dispatch }) => {
      const $from = state.selection.$from;
      const lpDepth = getInnermostLevelledParaDepth($from);
      if (lpDepth < 0) return false;
      if (collectAncestorDepths($from, LEVELLED_PARA).length >= TITLE_LEVEL_CAP) {
        return false;
      }

      const pos = $from.before(lpDepth);
      const end = $from.after(lpDepth);
      const lpType = state.schema.nodes.levelledPara;
      if (!lpType) return false;

      if (!dispatch) return true;

      tr.replaceWith(pos, end, lpType.create(null, $from.node(lpDepth)));
      tr.setSelection(
        TextSelection.near(tr.doc.resolve(Math.min(pos + 2, tr.doc.content.size)), 1),
      );
      dispatch(tr);
      return true;
    })
    .run();
}

export function canDemoteNesting(editor: Editor): boolean {
  if (!editor.isEditable) return false;
  const $from = editor.state.selection.$from;
  if (resolveListSinkTarget($from)) return true;
  return canWrapLevelledParaDeeper($from);
}

export function demoteNesting(editor: Editor): boolean {
  if (!editor.isEditable) return false;

  const $from = editor.state.selection.$from;
  const listTarget = resolveListSinkTarget($from);

  if (listTarget) {
    return sinkListItemAtTarget(editor, listTarget);
  }

  if (canWrapLevelledParaDeeper($from)) {
    return wrapLevelledParaDeeper(editor);
  }

  return false;
}
