import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { ResolvedPos } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

import {
  LEVELLED_PARA,
  LIST_ITEM,
  LIST_TYPES,
  collectAncestorDepths,
  getInnermostLevelledParaDepth,
  getListItemDepth,
  isInLevelledParaTitleOrPara,
  isInListNestingContext,
} from "./nestingLevelShared";

type ListLiftTarget = {
  outerListFrom: number;
  /** 外层 list 中承载嵌套列表的 listItem 下标（抬升项插入其后） */
  parentItemIndex: number;
  /** 内层列表在文档中的起始位置 */
  innerListFrom: number;
  /**
   * 内层列表在外层 listItem 内的子下标；
   * `-1` 表示内层列表与外层 list 同属 levelledPara 子级（平级 ul）。
   */
  innerListChildIndex: number;
  itemIndex: number;
};

function positionOfChildInParent(
  parentStart: number,
  parent: PMNode,
  childIndex: number,
): number {
  let pos = parentStart + 1;
  for (let i = 0; i < childIndex; i++) {
    pos += parent.child(i).nodeSize;
  }
  return pos;
}

function findNestedListIndexInListItem(
  listItem: PMNode,
  innerList: PMNode,
): number {
  for (let i = 0; i < listItem.childCount; i++) {
    if (listItem.child(i) === innerList) return i;
  }
  for (let i = 0; i < listItem.childCount; i++) {
    if (LIST_TYPES.has(listItem.child(i).type.name)) return i;
  }
  return -1;
}

function findPreviousListSiblingStart(
  $pos: ResolvedPos,
  lpDepth: number,
  innerList: PMNode,
): number {
  const lp = $pos.node(lpDepth);
  let innerIdx = -1;
  for (let i = 0; i < lp.childCount; i++) {
    if (lp.child(i) === innerList) {
      innerIdx = i;
      break;
    }
  }
  if (innerIdx <= 0) return -1;

  const lpStart = $pos.before(lpDepth);
  for (let i = innerIdx - 1; i >= 0; i--) {
    if (LIST_TYPES.has(lp.child(i).type.name)) {
      return positionOfChildInParent(lpStart, lp, i);
    }
  }
  return -1;
}

function buildLiftTarget(
  outerListFrom: number,
  parentItemIndex: number,
  innerListFrom: number,
  innerListChildIndex: number,
  itemIndex: number,
): ListLiftTarget {
  return {
    outerListFrom,
    parentItemIndex,
    innerListFrom,
    innerListChildIndex,
    itemIndex,
  };
}

/** 光标在内层 listItem 内（标准嵌套 listItem → list → listItem）。 */
function targetFromNestedListItem($pos: ResolvedPos): ListLiftTarget | null {
  const itemDepth = getListItemDepth($pos);
  if (itemDepth < 0) return null;

  const innerListDepth = itemDepth - 1;
  const innerList = $pos.node(innerListDepth);
  if (!LIST_TYPES.has(innerList.type.name)) return null;

  const itemIndex = $pos.index(itemDepth);
  const innerListFrom = $pos.before(innerListDepth);
  const parentListItemDepth = innerListDepth - 1;
  const parentType = $pos.node(parentListItemDepth).type.name;

  if (parentType === LIST_ITEM) {
    const outerListDepth = parentListItemDepth - 1;
    if (outerListDepth < 0) return null;
    if (!LIST_TYPES.has($pos.node(outerListDepth).type.name)) return null;

    const parentItem = $pos.node(parentListItemDepth);
    const innerListChildIndex = findNestedListIndexInListItem(
      parentItem,
      innerList,
    );
    if (innerListChildIndex < 0) return null;

    return buildLiftTarget(
      $pos.before(outerListDepth),
      $pos.index(parentListItemDepth),
      innerListFrom,
      innerListChildIndex,
      itemIndex,
    );
  }

  if (parentType === LEVELLED_PARA) {
    const lpDepth = parentListItemDepth;
    const outerListFrom = findPreviousListSiblingStart($pos, lpDepth, innerList);
    if (outerListFrom < 0) return null;
    const outerList = $pos.doc.nodeAt(outerListFrom);
    if (!outerList || !LIST_TYPES.has(outerList.type.name)) return null;
    if (outerList.childCount === 0) return null;

    return buildLiftTarget(
      outerListFrom,
      outerList.childCount - 1,
      innerListFrom,
      -1,
      itemIndex,
    );
  }

  return null;
}

/**
 * 光标在外层 listItem 内、嵌套列表之后（或块缝隙），抬升该嵌套列表最后一项。
 */
function targetFromOuterListItemWithNestedList(
  $pos: ResolvedPos,
): ListLiftTarget | null {
  const itemDepth = getListItemDepth($pos);
  if (itemDepth < 0) return null;

  const listDepth = itemDepth - 1;
  if (!LIST_TYPES.has($pos.node(listDepth).type.name)) return null;

  const parentItem = $pos.node(itemDepth);
  let innerList: PMNode | null = null;
  let innerListChildIndex = -1;
  for (let i = 0; i < parentItem.childCount; i++) {
    const child = parentItem.child(i);
    if (LIST_TYPES.has(child.type.name)) {
      innerList = child;
      innerListChildIndex = i;
      break;
    }
  }
  if (!innerList || innerList.childCount === 0) return null;

  const listItemStart = $pos.before(itemDepth);
  const innerListFrom = positionOfChildInParent(
    listItemStart,
    parentItem,
    innerListChildIndex,
  );

  return buildLiftTarget(
    $pos.before(listDepth),
    $pos.index(itemDepth),
    innerListFrom,
    innerListChildIndex,
    innerList.childCount - 1,
  );
}

/** `nodeBefore` 为嵌套列表，光标在其后且位于外层 listItem 内。 */
function targetFromNodeBeforeNestedList(
  $from: ResolvedPos,
  innerList: PMNode,
): ListLiftTarget | null {
  const itemDepth = getListItemDepth($from);
  if (itemDepth < 0) return null;

  const listDepth = itemDepth - 1;
  if (!LIST_TYPES.has($from.node(listDepth).type.name)) return null;

  const parentItem = $from.node(itemDepth);
  const innerListChildIndex = findNestedListIndexInListItem(
    parentItem,
    innerList,
  );
  if (innerListChildIndex < 0) return null;

  if ($from.pos > 0) {
    const $prev = $from.doc.resolve($from.pos - 1);
    const nested = targetFromNestedListItem($prev);
    if (nested) return nested;
  }

  const listItemStart = $from.before(itemDepth);
  const innerListFrom = positionOfChildInParent(
    listItemStart,
    parentItem,
    innerListChildIndex,
  );

  return buildLiftTarget(
    $from.before(listDepth),
    $from.index(itemDepth),
    innerListFrom,
    innerListChildIndex,
    innerList.childCount - 1,
  );
}

/**
 * 解析列表升级目标：内层 listItem、外层 listItem 嵌套列表尾、pos-1 / nodeBefore 回退。
 */
function resolveListLiftTarget($from: ResolvedPos): ListLiftTarget | null {
  const direct = targetFromNestedListItem($from);
  if (direct) return direct;

  const inOuterAfterNested = targetFromOuterListItemWithNestedList($from);
  if (inOuterAfterNested) return inOuterAfterNested;

  if ($from.pos > 0) {
    const $prev = $from.doc.resolve($from.pos - 1);
    const fromPrevItem = targetFromNestedListItem($prev);
    if (fromPrevItem) return fromPrevItem;
    const fromPrevOuter = targetFromOuterListItemWithNestedList($prev);
    if (fromPrevOuter) return fromPrevOuter;
  }

  const nodeBefore = $from.nodeBefore;
  if (nodeBefore && LIST_TYPES.has(nodeBefore.type.name) && nodeBefore.childCount > 0) {
    return targetFromNodeBeforeNestedList($from, nodeBefore);
  }

  return null;
}

function canUnwrapLevelledParaShallower($from: ResolvedPos): boolean {
  if (isInListNestingContext($from)) return false;

  const lpDepths = collectAncestorDepths($from, LEVELLED_PARA);
  if (lpDepths.length < 2) return false;

  return isInLevelledParaTitleOrPara($from);
}

function liftListItemAtTarget(editor: Editor, target: ListLiftTarget): boolean {
  return editor
    .chain()
    .focus()
    .command(({ state, tr, dispatch }) => {
      const {
        outerListFrom,
        parentItemIndex,
        innerListFrom,
        innerListChildIndex,
        itemIndex,
      } = target;

      const outerList = state.doc.nodeAt(outerListFrom);
      const innerList = state.doc.nodeAt(innerListFrom);
      if (!outerList || !innerList) return false;
      if (!LIST_TYPES.has(outerList.type.name)) return false;
      if (!LIST_TYPES.has(innerList.type.name)) return false;
      if (itemIndex >= innerList.childCount) return false;
      if (parentItemIndex >= outerList.childCount) return false;

      const listItemType = state.schema.nodes.listItem;
      if (!listItemType) return false;

      const currentItem = innerList.child(itemIndex);

      const innerChildren: PMNode[] = [];
      for (let i = 0; i < innerList.childCount; i++) {
        if (i !== itemIndex) innerChildren.push(innerList.child(i));
      }

      const newInnerList =
        innerChildren.length > 0
          ? innerList.type.create(innerList.attrs, innerChildren)
          : null;

      const finalOuter: PMNode[] = [];
      if (innerListChildIndex >= 0) {
        const parentItem = outerList.child(parentItemIndex);
        const parentChildren: PMNode[] = [];
        for (let i = 0; i < parentItem.childCount; i++) {
          if (i === innerListChildIndex) {
            if (newInnerList) parentChildren.push(newInnerList);
          } else {
            parentChildren.push(parentItem.child(i));
          }
        }
        const newParentItem = listItemType.create(
          parentItem.attrs,
          parentChildren,
        );
        for (let i = 0; i < outerList.childCount; i++) {
          if (i < parentItemIndex) {
            finalOuter.push(outerList.child(i));
          } else if (i === parentItemIndex) {
            finalOuter.push(newParentItem);
            finalOuter.push(currentItem);
          } else {
            finalOuter.push(outerList.child(i));
          }
        }
        if (!dispatch) return true;
        tr.replaceWith(
          outerListFrom,
          outerListFrom + outerList.nodeSize,
          outerList.type.create(outerList.attrs, finalOuter),
        );
      } else {
        for (let i = 0; i < outerList.childCount; i++) {
          finalOuter.push(outerList.child(i));
          if (i === parentItemIndex) finalOuter.push(currentItem);
        }
        const newOuterList = outerList.type.create(outerList.attrs, finalOuter);
        const innerListEnd = innerListFrom + innerList.nodeSize;
        if (!dispatch) return true;
        if (newInnerList) {
          tr.replaceWith(
            outerListFrom,
            outerListFrom + outerList.nodeSize,
            newOuterList,
          );
          tr.replaceWith(innerListFrom, innerListEnd, newInnerList);
        } else {
          tr.replaceWith(outerListFrom, innerListEnd, newOuterList);
        }
      }

      let liftedOffset = 1;
      for (let i = 0; i <= parentItemIndex; i++) {
        liftedOffset += finalOuter[i]!.nodeSize;
      }
      const mapped = tr.mapping.map(outerListFrom + liftedOffset);
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

function unwrapLevelledParaShallower(editor: Editor): boolean {
  return editor
    .chain()
    .focus()
    .command(({ state, tr, dispatch }) => {
      const $from = state.selection.$from;
      const lpDepth = getInnermostLevelledParaDepth($from);
      if (lpDepth < 0) return false;
      if (collectAncestorDepths($from, LEVELLED_PARA).length < 2) return false;

      const innerLp = $from.node(lpDepth);
      const pos = $from.before(lpDepth);
      const end = $from.after(lpDepth);

      if (!dispatch) return true;

      tr.replaceWith(pos, end, innerLp.content);
      const mapped = tr.mapping.map(Math.min(pos + 1, tr.doc.content.size));
      tr.setSelection(TextSelection.near(tr.doc.resolve(mapped), 1));
      dispatch(tr);
      return true;
    })
    .run();
}

export function canPromoteNesting(editor: Editor): boolean {
  if (!editor.isEditable) return false;
  const $from = editor.state.selection.$from;
  if (resolveListLiftTarget($from)) return true;
  return canUnwrapLevelledParaShallower($from);
}

export function promoteNesting(editor: Editor): boolean {
  if (!editor.isEditable) return false;

  const $from = editor.state.selection.$from;
  const listTarget = resolveListLiftTarget($from);

  if (listTarget) {
    return liftListItemAtTarget(editor, listTarget);
  }

  if (canUnwrapLevelledParaShallower($from)) {
    return unwrapLevelledParaShallower(editor);
  }

  return false;
}
