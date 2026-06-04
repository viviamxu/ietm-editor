import type { Editor } from "@tiptap/core";
import { Fragment, type Node as PMNode } from "@tiptap/pm/model";
import type { ResolvedPos } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

import {
  LEVELLED_PARA,
  LIST_TYPES,
  PROCEDURAL_STEP,
  TITLE_LEVEL_CAP,
  collectAncestorDepths,
  getInnermostLevelledParaDepth,
  getInnermostProceduralStepDepth,
  isInLevelledParaTitleOrPara,
  isInListNestingContext,
  isInProceduralStepTitleOrPara,
  resolveListItemInList,
} from "./nestingLevelShared";

type ListSinkTarget = {
  listFrom: number;
  itemIndex: number;
};

function resolveListItemContext($pos: ResolvedPos): ListSinkTarget | null {
  const ctx = resolveListItemInList($pos);
  if (!ctx) return null;
  return { listFrom: ctx.listFrom, itemIndex: ctx.itemIndex };
}

function targetFromListItem($pos: ResolvedPos): ListSinkTarget | null {
  const ctx = resolveListItemContext($pos);
  if (!ctx || ctx.itemIndex === 0) return null;
  return ctx;
}

/**
 * 解析应对其执行列表降级的目标：当前 listItem，或列表块外的缝隙（紧前在可降级项内）。
 * 禁止在「第 k 项开头、$pos-1 落在第 k-1 项末尾」时用「列表尾」误降级最后一项。
 */
function resolveListSinkTarget($from: ResolvedPos): ListSinkTarget | null {
  const direct = targetFromListItem($from);
  if (direct) return direct;

  // 已在某个 listItem 内（含首项）— 不再走 tail / nodeBefore 兜底
  if (resolveListItemContext($from)) return null;

  if ($from.pos > 0) {
    const $prev = $from.doc.resolve($from.pos - 1);
    const fromPrevItem = targetFromListItem($prev);
    if (fromPrevItem) return fromPrevItem;
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

/** 降级后将光标放入刚并入上一项的嵌套 listItem 内，便于继续编辑或升级。 */
function selectionAfterListSink(
  doc: PMNode,
  listFrom: number,
  itemIndex: number,
  newChildren: PMNode[],
): TextSelection | null {
  const mergedItem = newChildren[itemIndex - 1];
  if (!mergedItem) return null;

  let mergedStart = listFrom + 1;
  for (let i = 0; i < itemIndex - 1; i++) {
    mergedStart += newChildren[i]!.nodeSize;
  }

  let nestedList: PMNode | null = null;
  let offsetInMerged = 1;
  for (let i = 0; i < mergedItem.childCount; i++) {
    const child = mergedItem.child(i);
    if (LIST_TYPES.has(child.type.name)) {
      nestedList = child;
      break;
    }
    offsetInMerged += child.nodeSize;
  }

  if (!nestedList || nestedList.childCount === 0) {
    const caret = Math.min(mergedStart + 1, doc.content.size);
    if (caret < 0 || caret > doc.content.size) return null;
    return TextSelection.create(doc, caret);
  }

  let caret = mergedStart + offsetInMerged + 1;
  for (let i = 0; i < nestedList.childCount - 1; i++) {
    caret += nestedList.child(i)!.nodeSize;
  }
  caret = Math.min(caret + 1, doc.content.size);
  if (caret < 0 || caret > doc.content.size) return null;
  return TextSelection.create(doc, caret);
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

      const sel = selectionAfterListSink(tr.doc, listFrom, itemIndex, newChildren);
      if (sel) tr.setSelection(sel);
      dispatch(tr);
      return true;
    })
    .run();
}

function wrapHostBlockDeeper(
  editor: Editor,
  hostDepth: number,
  hostTypeName: string,
): boolean {
  return editor
    .chain()
    .focus()
    .command(({ state, tr, dispatch }) => {
      const $from = state.selection.$from;
      if ($from.depth < hostDepth || hostDepth < 0) return false;

      const pos = $from.before(hostDepth);
      const end = $from.after(hostDepth);
      const hostType = state.schema.nodes[hostTypeName];
      if (!hostType) return false;

      if (!dispatch) return true;

      tr.replaceWith(pos, end, hostType.create(null, $from.node(hostDepth)));
      tr.setSelection(
        TextSelection.near(tr.doc.resolve(Math.min(pos + 2, tr.doc.content.size)), 1),
      );
      dispatch(tr);
      return true;
    })
    .run();
}

function wrapLevelledParaDeeper(editor: Editor): boolean {
  const $from = editor.state.selection.$from;
  const lpDepth = getInnermostLevelledParaDepth($from);
  if (lpDepth < 0) return false;
  return wrapHostBlockDeeper(editor, lpDepth, LEVELLED_PARA);
}

function canWrapProceduralStepDeeper($from: ResolvedPos): boolean {
  if (isInListDemoteContext($from)) return false;

  const stepDepth = getInnermostProceduralStepDepth($from);
  if (stepDepth < 0) return false;
  if (collectAncestorDepths($from, PROCEDURAL_STEP).length >= TITLE_LEVEL_CAP) {
    return false;
  }

  return isInProceduralStepTitleOrPara($from);
}

function wrapProceduralStepDeeper(editor: Editor): boolean {
  const $from = editor.state.selection.$from;
  const stepDepth = getInnermostProceduralStepDepth($from);
  if (stepDepth < 0) return false;
  return wrapHostBlockDeeper(editor, stepDepth, PROCEDURAL_STEP);
}

export function canDemoteNesting(editor: Editor): boolean {
  if (!editor.isEditable) return false;
  const $from = editor.state.selection.$from;
  if (resolveListSinkTarget($from)) return true;
  if (canWrapProceduralStepDeeper($from)) return true;
  return canWrapLevelledParaDeeper($from);
}

export function demoteNesting(editor: Editor): boolean {
  if (!editor.isEditable) return false;

  const $from = editor.state.selection.$from;
  const listTarget = resolveListSinkTarget($from);

  if (listTarget) {
    return sinkListItemAtTarget(editor, listTarget);
  }

  if (canWrapProceduralStepDeeper($from)) {
    return wrapProceduralStepDeeper(editor);
  }

  if (canWrapLevelledParaDeeper($from)) {
    return wrapLevelledParaDeeper(editor);
  }

  return false;
}
